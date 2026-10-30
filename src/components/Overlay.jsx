import { useEffect, useRef } from 'react'
import { useHero } from '../store'
import { useHotspots } from './GlassesModel'
import { CONFIG } from '../config'
import { CHARACTER } from './characters'
import { FRAME_BY_ID } from './glasses'
import FrameSelector from './FrameSelector'

export default function Overlay() {
  const phase = useHero((s) => s.phase)
  const hovered = useHero((s) => s.hovered)
  const explore = useHero((s) => s.explore)
  const back = useHero((s) => s.back)
  const detail = phase === 'detail'
  const frame = FRAME_BY_ID[useHero((s) => s.frame)]
  const HOTSPOTS = useHotspots()
  const EYEWEAR = frame.id === 'shield' ? 'visor' : 'glasses'
  const selector = CONFIG.frameSelector

  return (
    <div className="pointer-events-none fixed inset-0 z-10 select-none">
      {/* ---------------- nav ---------------- */}
      <header data-hero className="absolute inset-x-0 top-0 flex items-center justify-between px-5 pt-5 md:px-10 md:pt-7">
        <div className="flex items-baseline gap-1 text-[15px] font-semibold tracking-[0.32em]">
          VANTA<span className="text-[9px] text-signal">®</span>
        </div>
        <nav className="pointer-events-auto hidden gap-9 text-[13px] text-bone/60 md:flex">
          {['Work', 'Optics', 'Process', 'Studio'].map((l) => (
            <a key={l} href="#" className="transition-colors hover:text-bone">
              {l}
            </a>
          ))}
        </nav>
        <span className="rounded-full border border-bone/15 px-3 py-1 font-mono text-[10px] tracking-[0.2em] text-bone/60">
          SS—26
        </span>
      </header>

      {/* ---------------- hero copy ---------------- */}
      <div data-hero className="absolute inset-x-0 bottom-0 h-3/5 bg-linear-to-t from-ink via-ink/70 to-transparent md:hidden" />
      <section className={`absolute left-5 right-5 max-w-xl md:bottom-14 md:left-10 ${selector ? 'bottom-36' : 'bottom-8'}`}>
        <p data-hero className="flex items-center gap-3 font-mono text-[10px] uppercase tracking-[0.3em] text-bone/55 md:text-[11px]">
          <span className="h-px w-8 bg-signal" /> Case study 07 — WebGL / R3F / GSAP
        </p>
        <h1 data-hero className="mt-5 text-[2.75rem] font-light leading-[0.92] tracking-[-0.035em] md:text-7xl">
          How I build <span className="font-serif italic tracking-[-0.01em] text-signal">3D animated</span> sites
        </h1>
        <p data-hero className="mt-5 max-w-md text-sm leading-relaxed text-bone/55 md:mt-6 md:text-[15px]">
          Custom shaders, choreographed timelines and a camera that behaves like a lens — not a viewport. Hover the {EYEWEAR},
          or step inside.
        </p>
        <div data-hero className="mt-7 flex items-center gap-5 md:mt-9">
          <button
            onClick={explore}
            disabled={phase !== 'idle'}
            className="group pointer-events-auto relative inline-flex items-center gap-3 overflow-hidden rounded-full bg-bone px-6 py-3.5 text-[12px] font-medium tracking-[0.22em] text-ink transition-transform duration-300 hover:scale-[1.03] disabled:cursor-default"
          >
            <span className="absolute inset-0 translate-y-full bg-signal transition-transform duration-500 ease-[cubic-bezier(.2,.8,.2,1)] group-hover:translate-y-0" />
            <span className="relative transition-colors duration-300 group-hover:text-bone">EXPLORE DESIGN</span>
            <span className="relative transition-all duration-300 group-hover:translate-x-1 group-hover:text-bone">→</span>
          </button>
          <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-bone/40">or click the {EYEWEAR}</span>
        </div>
      </section>

      <aside data-hero className={`absolute right-10 hidden flex-col items-end gap-1.5 ${selector ? 'top-24' : 'bottom-14'} font-mono text-[10px] uppercase tracking-[0.2em] text-bone/40 lg:flex`}>
        <span>{CHARACTER.credit.length ? 'Scanned human · glasses procedural' : 'Procedural mesh · 0 assets'}</span>
        <span>Frost pass · GLSL</span>
        <span>Lens · fresnel / reflections</span>
        <CursorReadout />
      </aside>

      <HoverTag visible={hovered && phase === 'idle'} />

      {selector && <FrameSelector />}

      {/* license attribution for third-party assets (required by CC BY) */}
      {CHARACTER.credit.length > 0 && (
        <p className="absolute bottom-2 left-1/2 flex -translate-x-1/2 gap-3 whitespace-nowrap font-mono text-[9px] tracking-[0.12em] text-bone/30">
          {CHARACTER.credit.map((c) => (
            <a key={c.text} href={c.href} target="_blank" rel="noreferrer" className="pointer-events-auto transition-colors hover:text-bone/60">
              {c.text}
            </a>
          ))}
        </p>
      )}

      {/* spec callouts — GlassesModel projects their 3D anchors and sets transform/opacity */}
      {HOTSPOTS.map((h) => (
        <div key={h.idx} data-hotspot className="hotspot absolute left-0 top-0">
          <div className="-mt-[5px] -ml-[5px] flex items-center gap-2">
            <span className="relative flex h-2.5 w-2.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-signal/60" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-signal" />
            </span>
            <span className="h-px w-10 bg-bone/40" />
            <span className="rounded-full bg-ink/60 px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.2em] text-bone/85">
              <span className="text-ember">{h.idx}</span> {h.label}
            </span>
          </div>
        </div>
      ))}

      {/* ---------------- feature mode ---------------- */}
      <div>
        <div className="absolute left-5 top-20 md:left-10 md:top-28">
          <p data-feature className="flex items-center gap-3 font-mono text-[10px] uppercase tracking-[0.3em] text-signal md:text-[11px]">
            <span className="h-1.5 w-1.5 rounded-full bg-signal" /> Performance optics — {frame.name}
          </p>
          <h2 data-feature className="mt-3 text-4xl font-light leading-[0.9] tracking-[-0.04em] md:text-[5.5rem]">
            VANTA <span className="font-serif italic text-bone/60">—</span> 3D GLASSES
          </h2>
        </div>

        <dl className="absolute right-5 top-1/2 hidden w-64 -translate-y-1/2 flex-col md:right-10 md:flex">
          {frame.meta.specs.map(([k, v]) => (
            <div data-feature key={k} className="flex items-baseline justify-between border-t border-bone/10 py-3">
              <dt className="font-mono text-[10px] uppercase tracking-[0.2em] text-bone/40">{k}</dt>
              <dd className="text-[13px] text-bone/85">{v}</dd>
            </div>
          ))}
        </dl>

        <div className="absolute bottom-8 left-5 right-5 flex items-end justify-between md:bottom-12 md:left-10 md:right-10">
          <button
            data-feature
            onClick={back}
            tabIndex={detail ? 0 : -1}
            className={`${detail ? 'pointer-events-auto' : ''} inline-flex items-center gap-3 rounded-full border border-bone/20 px-5 py-3 font-mono text-[11px] uppercase tracking-[0.22em] text-bone/80 transition-colors hover:border-signal hover:text-bone`}
          >
            ← Return
          </button>
          <p data-feature className="hidden font-mono text-[10px] uppercase tracking-[0.25em] text-bone/40 md:block">
            Drag to rotate 360° · Esc to exit
          </p>
          <div data-feature className="text-right">
            <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-bone/40">Pre-order</p>
            <p className="font-serif text-3xl italic">{frame.meta.price}</p>
          </div>
        </div>
      </div>
    </div>
  )
}

/** Live cursor coordinates — written straight to the DOM, no re-renders. */
function CursorReadout() {
  const el = useRef(null)
  useEffect(() => {
    const onMove = (e) => {
      if (!el.current) return
      const x = (e.clientX / window.innerWidth) * 2 - 1
      const y = -(e.clientY / window.innerHeight) * 2 + 1
      el.current.textContent = `X ${x.toFixed(3)}  Y ${y.toFixed(3)}`
    }
    window.addEventListener('pointermove', onMove)
    return () => window.removeEventListener('pointermove', onMove)
  }, [])
  return (
    <span ref={el} className="mt-2 text-bone/60">
      X 0.000 Y 0.000
    </span>
  )
}

/** Small pill that trails the cursor while the visor is hovered. */
function HoverTag({ visible }) {
  const el = useRef(null)
  useEffect(() => {
    const onMove = (e) => {
      if (el.current) el.current.style.transform = `translate(${e.clientX + 18}px, ${e.clientY + 14}px)`
    }
    window.addEventListener('pointermove', onMove)
    return () => window.removeEventListener('pointermove', onMove)
  }, [])
  return (
    <div ref={el} className="fixed left-0 top-0">
      <span
        className={`inline-flex items-center gap-2 rounded-full bg-signal px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.2em] text-bone shadow-[0_0_30px_rgba(255,42,42,0.45)] transition-all duration-300 ${
          visible ? 'scale-100 opacity-100' : 'scale-75 opacity-0'
        }`}
      >
        Click to detach
      </span>
    </div>
  )
}
