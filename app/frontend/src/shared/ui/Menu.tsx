import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Presence, usePresenceClass } from './presence'

/** Disclosure menu (button + popover of links/buttons). Closes on Escape (focus back to the button), click outside, or `close()`. */
export function Menu({ label, trigger, className, align = 'right', children }: {
  label: string
  trigger: ReactNode
  className?: string
  align?: 'left' | 'right'
  children: (close: () => void) => ReactNode
}) {
  const [open, setOpen] = useState(false)
  const root = useRef<HTMLDivElement>(null)
  const btn = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    if (!open) return
    const out = (e: MouseEvent) => { if (!root.current?.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', out)
    return () => document.removeEventListener('mousedown', out)
  }, [open])
  return (
    <div className="menu" ref={root} onKeyDown={(e) => { if (e.key === 'Escape' && open) { setOpen(false); btn.current?.focus() } }}>
      <button ref={btn} type="button" className={className} aria-label={label} aria-expanded={open} aria-haspopup="true" onClick={() => setOpen(!open)}>{trigger}</button>
      <Presence open={open} exitMs={120}><MenuPop align={align}>{children(() => setOpen(false))}</MenuPop></Presence>
    </div>
  )
}

function MenuPop({ align, children }: { align: 'left' | 'right'; children: ReactNode }) {
  const phase = usePresenceClass()
  return <div className={`menu-pop menu-${align} ${phase}`}>{children}</div>
}
