import { useMemo } from 'react'
import { useHero } from '../store'
import { FRAMES } from './glasses'

/**
 * Frame picker along the bottom of the hero. Thumbnails are SVGs drawn from each
 * style's real lens outline, so the card always matches the 3D frame.
 * Visible while idle and in the product view; hidden during the transitions.
 */
const toPath = (pts, dx) => pts.map((p, i) => `${i ? 'L' : 'M'}${(p.x + dx).toFixed(3)},${(-p.y).toFixed(3)}`).join(' ') + ' Z'

function thumbPaths(frame) {
  const t = frame.thumb
  if (t.visor) {
    return { lenses: ['M-0.92,-0.15 Q0,-0.24 0.92,-0.15 L0.92,0.13 Q0,0.21 -0.92,0.13 Z'], bridge: '', temples: 'M-0.92,-0.08 L-1.02,-0.06 M0.92,-0.08 L1.02,-0.06' }
  }
  const lenses = [-1, 1].map((s) => toPath(t.outer(s), s * t.lensX))
  const inner = t.lensX - 0.34
  const y = -(t.hingeY ?? 0.07)
  return {
    lenses,
    bridge: `M${-inner - 0.02},-0.06 Q0,-0.17 ${inner + 0.02},-0.06`,
    temples: `M${-t.hinge},${y} L-1.02,${y + 0.02} M${t.hinge},${y} L1.02,${y + 0.02}`,
  }
}

function Thumb({ frame, active }) {
  const paths = useMemo(() => thumbPaths(frame), [frame])
  const gid = `lens-${frame.id}`
  return (
    <svg viewBox="-1.08 -0.4 2.16 0.8" className="h-9 w-full" aria-hidden="true">
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={frame.swatch[0]} />
          <stop offset="1" stopColor={frame.swatch[1]} />
        </linearGradient>
      </defs>
      <g fill="none" strokeLinejoin="round" strokeLinecap="round" stroke={active ? '#ecebe6' : 'rgba(236,235,230,0.65)'}>
        {paths.lenses.map((d) => (
          <path key={d.slice(0, 24)} d={d} fill={`url(#${gid})`} fillOpacity={active ? 0.95 : 0.7} strokeWidth={frame.thumb.metal ? 0.025 : 0.05} />
        ))}
        {paths.bridge && <path d={paths.bridge} strokeWidth="0.035" />}
        <path d={paths.temples} strokeWidth="0.03" />
      </g>
    </svg>
  )
}

export default function FrameSelector() {
  const phase = useHero((s) => s.phase)
  const current = useHero((s) => s.frame)
  const selectFrame = useHero((s) => s.selectFrame)
  const visible = phase === 'idle' || phase === 'detail'
  const detail = phase === 'detail'
  const index = FRAMES.findIndex((f) => f.id === current)

  const position = detail
    ? 'bottom-24 left-1/2 -translate-x-1/2 md:bottom-28'
    : 'bottom-4 left-1/2 -translate-x-1/2 md:bottom-10 md:left-auto md:right-10 md:translate-x-0 2xl:left-1/2 2xl:right-auto 2xl:-translate-x-1/2'

  return (
    <div
      className={`absolute ${position} w-[calc(100%-2rem)] max-w-max transition-all duration-500 ease-out md:w-auto ${
        visible ? 'translate-y-0 opacity-100' : 'pointer-events-none translate-y-4 opacity-0'
      }`}
    >
      <p className="mb-2 flex items-center justify-between gap-6 font-mono text-[9px] uppercase tracking-[0.28em] text-bone/45">
        <span>Select frame</span>
        <span>
          <span className="text-bone/80">{String(index + 1).padStart(2, '0')}</span> / {String(FRAMES.length).padStart(2, '0')}
        </span>
      </p>
      <div role="radiogroup" aria-label="Glasses frame" className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none]">
        {FRAMES.map((f) => {
          const active = f.id === current
          return (
            <button
              key={f.id}
              type="button"
              role="radio"
              aria-checked={active}
              tabIndex={visible ? 0 : -1}
              onClick={() => selectFrame(f.id)}
              className={`group flex w-[5.25rem] shrink-0 flex-col items-center gap-1.5 rounded-xl border px-2 pb-2 pt-2.5 transition-all duration-300 ${
                visible ? 'pointer-events-auto' : ''
              } ${
                active
                  ? 'border-signal/80 bg-signal/10 shadow-[0_0_24px_rgba(255,42,42,0.25)]'
                  : 'border-bone/10 bg-ink/50 hover:-translate-y-0.5 hover:border-bone/30'
              }`}
            >
              <Thumb frame={f} active={active} />
              <span className={`font-mono text-[9px] uppercase tracking-[0.18em] ${active ? 'text-bone' : 'text-bone/50 group-hover:text-bone/80'}`}>
                {f.name}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
