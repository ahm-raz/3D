import { useEffect } from 'react'
import Experience from './components/Experience'
import Overlay from './components/Overlay'
import { useHero } from './store'

export default function App() {
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && useHero.getState().back()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return (
    <main className="relative h-full w-full bg-ink">
      <Experience />
      <Overlay />
    </main>
  )
}
