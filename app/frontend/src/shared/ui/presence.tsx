import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react'

export const reducedMotion = () =>
  typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches

/** Keep a node mounted through its exit transition. In tests (and reduced motion) exit is instant so existing assertions stay sync. */
export function usePresence(open: boolean, exitMs = 200) {
  const [present, setPresent] = useState(open)
  const [on, setOn] = useState(false)
  useEffect(() => {
    if (open) {
      setPresent(true)
      setOn(false)
      const id = requestAnimationFrame(() => requestAnimationFrame(() => setOn(true)))
      return () => cancelAnimationFrame(id)
    }
    setOn(false)
    if (import.meta.env.MODE === 'test' || reducedMotion()) {
      setPresent(false)
      return
    }
    const t = window.setTimeout(() => setPresent(false), exitMs)
    return () => clearTimeout(t)
  }, [open, exitMs])
  return { present, className: on ? 'is-open' : 'is-leave' }
}

const PresenceClass = createContext('is-open')
export const usePresenceClass = () => useContext(PresenceClass)

/** Holds the last open children while the leave transition runs, then unmounts. */
export function Presence({ open, exitMs = 200, children }: { open: boolean; exitMs?: number; children: ReactNode }) {
  const { present, className } = usePresence(open, exitMs)
  const held = useRef<ReactNode>(null)
  if (open) held.current = children
  if (!present) return null
  return <PresenceClass.Provider value={className}>{open ? children : held.current}</PresenceClass.Provider>
}

/** Fade + 8px rise of the main area on hash change. First paint is already in place (no flash). */
export function PageStage({ route, children }: { route: string; children: ReactNode }) {
  const prev = useRef(route)
  const [, setTick] = useState(0)
  const changed = prev.current !== route
  if (changed) prev.current = route
  useEffect(() => {
    if (!changed) return
    const id = requestAnimationFrame(() => requestAnimationFrame(() => setTick((n) => n + 1)))
    return () => cancelAnimationFrame(id)
  }, [route, changed])
  return <div className={`page-stage${changed ? '' : ' is-in'}`}>{children}</div>
}
