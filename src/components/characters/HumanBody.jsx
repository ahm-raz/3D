import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import { clone as cloneSkinned } from 'three/addons/utils/SkeletonUtils.js'
import { rig } from '../../store'
import { ScanHead, SCAN_CREDIT } from './HumanHead'

/**
 * Full human: the photoreal head scan on a rigged body (Ready Player Me sample
 * avatar — its own head, eyes, hair and legs are hidden). The left arm is posed
 * with the real skeleton: the hand turns palm-to-temple, thumb and index close
 * on the glasses' temple arm, and two-bone IK keeps that pinch on the frame
 * (rig.arm.target, written by GlassesModel) while the hand eases the glasses off.
 *
 * Finger poses are built once at load; per frame we solve the arm (three bones)
 * and slerp between rest and the solved pose by rig.arm.raise / rig.arm.grip.
 */
const URL = '/models/rpm-avatar/avatar.glb'
// matched by material name (GLTFLoader renames meshes, materials keep their names)
const HIDDEN = ['Wolf3D_Eye', 'Wolf3D_Skin', 'Wolf3D_Teeth', 'Wolf3D_Beard', 'Wolf3D_Headwear', 'Wolf3D_Outfit_Bottom', 'Wolf3D_Outfit_Footwear']
// metres → head space: ×9.4 matches the scan's head-to-shoulder proportion; neckline (y 1.52 m) lands just under
// the scan's trimmed neck (y −1.35), neck centre z −0.033 m → −0.38
const FIT = { scale: 9.4, position: [0, -15.64, -0.07] }

// Holding the glasses: fingers run forward along the temple arm (tipped up), palm against the temple,
// so the index lies on top of the arm and the thumb comes up under it. World = head space here (the
// character is never rotated), so these are fixed directions.
const HAND_FWD = new THREE.Vector3(-0.1, 0.55, 0.83).normalize() // wrist → knuckles
const HAND_PALM = new THREE.Vector3(-1, -0.12, 0.08) // palm normal, towards the head
const ELBOW_POLE = new THREE.Vector3(0.6, -0.3, 0.75) // elbow forward and out (shoulder height), not a sideways chicken wing

// finger curl per joint (degrees, knuckle → tip); thumb is solved to meet the index separately
const REST_CURL = { Index: [10, 14, 8], Middle: [12, 16, 10], Ring: [14, 18, 10], Pinky: [16, 18, 10] }
const GRIP_CURL = { Index: [34, 52, 28], Middle: [48, 66, 38], Ring: [60, 72, 42], Pinky: [68, 72, 42] }
const THUMB_GAP = 0.009 // metres between thumb pad and index pad — the temple arm sits in it

const _a = new THREE.Vector3()
const _b = new THREE.Vector3()
const _w = new THREE.Vector3()
const _q = new THREE.Quaternion()
const _p = new THREE.Quaternion()
const deg = THREE.MathUtils.degToRad

/** Rotate `bone` (in world space) so the direction bone→child points along `dir`. */
function aim(bone, child, dir) {
  bone.updateWorldMatrix(true, true)
  const cur = child.getWorldPosition(_b).sub(bone.getWorldPosition(_a)).normalize()
  const delta = new THREE.Quaternion().setFromUnitVectors(cur, dir.clone().normalize())
  const world = delta.multiply(bone.getWorldQuaternion(_q))
  bone.quaternion.copy(bone.parent.getWorldQuaternion(_p).invert().multiply(world))
  bone.updateWorldMatrix(false, true)
}

/** Spin `bone` about `axis` so `from` (a world vector it carries) lines up with `to` around that axis. */
function roll(bone, axis, from, to) {
  const ax = axis.clone().normalize()
  const f = from.clone().projectOnPlane(ax).normalize()
  const t = to.clone().projectOnPlane(ax).normalize()
  const angle = Math.atan2(ax.dot(new THREE.Vector3().crossVectors(f, t)), f.dot(t))
  const world = new THREE.Quaternion().setFromAxisAngle(ax, angle).multiply(bone.getWorldQuaternion(_q))
  bone.quaternion.copy(bone.parent.getWorldQuaternion(_p).invert().multiply(world))
  bone.updateWorldMatrix(false, true)
}

function twoBoneElbow(S, T, l1, l2, pole) {
  const dir = T.clone().sub(S)
  const d = Math.min(dir.length(), (l1 + l2) * 0.999)
  dir.normalize()
  const a = (l1 * l1 - l2 * l2 + d * d) / (2 * d)
  const h = Math.sqrt(Math.max(l1 * l1 - a * a, 0))
  const ortho = pole.clone().sub(dir.clone().multiplyScalar(pole.dot(dir))).normalize()
  return S.clone().addScaledVector(dir, a).addScaledVector(ortho, h)
}

const wp = (o) => o.getWorldPosition(new THREE.Vector3())

/** Rotate `bone` by `angle` about a world-space `axis`. */
function turn(bone, axis, angle) {
  const world = new THREE.Quaternion().setFromAxisAngle(axis, angle).multiply(bone.getWorldQuaternion(_q))
  bone.quaternion.copy(bone.parent.getWorldQuaternion(_p).invert().multiply(world))
  bone.updateWorldMatrix(false, true)
}

/** Palm normal of a hand in world space (left: knuckle line × pinky→index, mirrored for the right). */
function palmNormal(hand, middle, index, pinky, side) {
  const f = wp(middle).sub(wp(hand))
  const across = wp(index).sub(wp(pinky))
  return (side > 0 ? f.cross(across) : across.cross(f)).normalize()
}

/** Bend each finger's three joints towards the palm. */
function curl(fingers, curls, palm) {
  for (const [name, joints] of Object.entries(fingers)) {
    for (let k = 0; k < 3; k++) {
      const seg = wp(joints[k + 1]).sub(wp(joints[k])).normalize()
      turn(joints[k], seg.cross(palm).normalize(), deg(curls[name][k]))
    }
  }
}

/** CCD: swing the thumb joints until its tip reaches `target`. */
function reachThumb(thumb, target) {
  for (let it = 0; it < 16; it++) {
    for (let k = 2; k >= 0; k--) {
      const j = wp(thumb[k])
      const toTip = wp(thumb[3]).sub(j).normalize()
      const toTarget = target.clone().sub(j).normalize()
      const q = new THREE.Quaternion().setFromUnitVectors(toTip, toTarget)
      const axis = new THREE.Vector3(q.x, q.y, q.z)
      if (axis.lengthSq() < 1e-10) continue
      turn(thumb[k], axis.normalize(), 2 * Math.acos(Math.min(q.w, 1)) * 0.6)
    }
  }
}

function buildAvatar(source) {
  const scene = cloneSkinned(source)
  scene.traverse((o) => {
    if (!o.isMesh) return
    if (HIDDEN.includes(o.material?.name)) o.visible = false
    o.frustumCulled = false // skinned bounds don't follow the posed arm
    if (o.material?.name === 'Wolf3D_Outfit_Top') {
      o.material = o.material.clone()
      o.material.color.set('#2b2b30') // dark suit to match the black/red art direction
      o.material.roughness = 0.7
    }
    if (o.material?.name === 'Wolf3D_Body') {
      o.material = o.material.clone()
      o.material.color.set('#b9a79d') // pull the hands toward the scan's moody skin tone
    }
  })

  const b = (n) => scene.getObjectByName(n)
  const fingersOf = (side) =>
    Object.fromEntries(['Index', 'Middle', 'Ring', 'Pinky'].map((f) => [f, [1, 2, 3, 4].map((i) => b(`${side}Hand${f}${i}`))]))
  const L = { arm: b('LeftArm'), fore: b('LeftForeArm'), hand: b('LeftHand'), fingers: fingersOf('Left'), thumb: [1, 2, 3, 4].map((i) => b(`LeftHandThumb${i}`)) }
  const R = { arm: b('RightArm'), fore: b('RightForeArm'), hand: b('RightHand'), fingers: fingersOf('Right') }
  const arm = [L.arm, L.fore, L.hand]
  scene.updateMatrixWorld(true)

  // rest: both arms relaxed at the sides, fingers softly curled
  aim(L.arm, L.fore, new THREE.Vector3(0.18, -1, 0.02))
  aim(L.fore, L.hand, new THREE.Vector3(0.06, -1, 0.16))
  aim(R.arm, R.fore, new THREE.Vector3(-0.18, -1, 0.02))
  aim(R.fore, R.hand, new THREE.Vector3(-0.06, -1, 0.16))
  const palmOf = (H, side) => palmNormal(H.hand, H.fingers.Middle[0], H.fingers.Index[0], H.fingers.Pinky[0], side)
  curl(R.fingers, REST_CURL, palmOf(R, -1))
  const lPalm = palmOf(L, 1)
  // the hand's own axes (knuckle direction, palm normal) in its local space — used to orient it exactly
  const hq = L.hand.getWorldQuaternion(new THREE.Quaternion()).invert()
  const fL = wp(L.fingers.Middle[0]).sub(wp(L.hand)).normalize().applyQuaternion(hq)
  const nL = lPalm.clone().applyQuaternion(hq)
  const basisL = new THREE.Matrix4().makeBasis(fL, nL.sub(fL.clone().multiplyScalar(nL.dot(fL))).normalize(), new THREE.Vector3().crossVectors(fL, nL))

  const leftFingerBones = [...Object.values(L.fingers).flatMap((j) => j.slice(0, 3)), ...L.thumb.slice(0, 3)]
  const snap = (bones) => bones.map((o) => o.quaternion.clone())
  const restArm = snap(arm)
  const restFingers = snap(leftFingerBones)
  curl(L.fingers, REST_CURL, lPalm)
  const relaxed = snap(leftFingerBones)

  // grip: index/middle wrap over the temple arm, thumb comes up underneath to meet the index pad
  leftFingerBones.forEach((o, i) => o.quaternion.copy(restFingers[i]))
  curl(L.fingers, GRIP_CURL, lPalm)
  const [i3, i4] = [wp(L.fingers.Index[2]), wp(L.fingers.Index[3])]
  const pad = i3.lerp(i4, 0.55)
  reachThumb(L.thumb, pad.clone().addScaledVector(lPalm, THUMB_GAP))
  const gripped = snap(leftFingerBones)
  // the pinch point (between thumb and index pads), in the hand's local space
  const pinch = L.hand.worldToLocal(pad.addScaledVector(lPalm, THUMB_GAP / 2))
  leftFingerBones.forEach((o, i) => o.quaternion.copy(relaxed[i]))

  // world orientation the hand takes while holding the frame
  const fwd = HAND_FWD.clone()
  const palm = HAND_PALM.clone().sub(fwd.clone().multiplyScalar(HAND_PALM.dot(fwd))).normalize()
  const basisD = new THREE.Matrix4().makeBasis(fwd, palm, new THREE.Vector3().crossVectors(fwd, palm))
  const holdQ = new THREE.Quaternion().setFromRotationMatrix(basisD.multiply(basisL.transpose()))

  const solved = arm.map(() => new THREE.Quaternion())
  /** Arm IK: put the pinch point on `target` (world) with the hand at holdQ, blend from rest by `raise`. */
  function pose(raise, grip, target) {
    arm.forEach((o, i) => o.quaternion.copy(restArm[i]))
    leftFingerBones.forEach((o, i) => o.quaternion.slerpQuaternions(relaxed[i], gripped[i], grip))
    if (raise < 1e-3) return
    L.arm.updateWorldMatrix(true, true)
    // wrist = pinch target minus the (oriented, scaled) wrist→pinch offset
    const s = L.hand.getWorldScale(_w).x
    const W = target.clone().sub(pinch.clone().multiplyScalar(s).applyQuaternion(holdQ))
    const S = wp(L.arm)
    const l1 = wp(L.fore).distanceTo(S)
    const l2 = wp(L.hand).distanceTo(wp(L.fore))
    aim(L.arm, L.fore, twoBoneElbow(S, W, l1, l2, ELBOW_POLE).sub(S))
    const foreDir = W.clone().sub(wp(L.fore))
    aim(L.fore, L.hand, foreDir)
    // twist the forearm towards the hand's final roll so the wrist doesn't candy-wrap
    roll(L.fore, foreDir, nL.clone().applyQuaternion(L.hand.getWorldQuaternion(_q)), palm)
    L.hand.quaternion.copy(L.hand.parent.getWorldQuaternion(_p).invert().multiply(holdQ))
    arm.forEach((o, i) => {
      solved[i].copy(o.quaternion)
      o.quaternion.slerpQuaternions(restArm[i], solved[i], raise)
    })
  }

  pose(0, 0, null)
  return { scene, pose, spine: b('Spine2') }
}

function Body() {
  const { scene: source } = useGLTF(URL)
  const avatar = useMemo(() => buildAvatar(source), [source])
  const breathe = useRef(avatar.spine.quaternion.clone())

  useFrame((state) => {
    // subtle breathing so the body isn't a statue
    avatar.spine.quaternion.copy(breathe.current).multiply(_q.setFromAxisAngle(_a.set(1, 0, 0), Math.sin(state.clock.elapsedTime * 1.3) * 0.012))
    avatar.pose(rig.arm.raise, rig.arm.grip, rig.arm.target)
  })

  return <primitive object={avatar.scene} scale={FIT.scale} position={FIT.position} />
}

export const HUMAN = {
  Head: ScanHead,
  Body,
  pivotY: -0.9, // head turns about the top of the neck
  scale: 0.82,
  arm: null, // the avatar's own skeleton does the gesture
  gripsGlasses: true, // its hand holds the frame and eases it off the face
  // chest-up shot (desktop puts the figure in the right third, mobile centres it above the copy)
  framing: (aspect) =>
    aspect > 1.15 ? { cam: [0, -1.2, 11.8], look: [-1.85, -1.5, 0] } : { cam: [0, -1.2, 14.5], look: [0, -2.4, 0] },
  credit: [SCAN_CREDIT, { text: 'Body: Ready Player Me sample avatar', href: 'https://readyplayer.me' }],
}

useGLTF.preload(URL)
