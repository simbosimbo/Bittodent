import { useEffect, useId, useRef, type ReactNode, type RefObject } from 'react'
import { usePresenceClass } from './presence'

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

/**
 * Modal behaviour for a dialog element while `on`: focus moves in (an [autofocus] child or the first control),
 * Tab stays inside, Escape calls onClose, the page behind does not scroll, focus returns to the opener on close.
 */
export function useDialog(ref: RefObject<HTMLElement | null>, onClose: () => void, on = true) {
  const close = useRef(onClose)
  close.current = onClose
  useEffect(() => {
    const el = ref.current
    if (!on || !el) return
    const opener = document.activeElement as HTMLElement | null
    const items = () => [...el.querySelectorAll<HTMLElement>(FOCUSABLE)]
    if (!el.contains(document.activeElement)) (el.querySelector<HTMLElement>('[autofocus]') ?? items()[0] ?? el).focus()
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); close.current(); return }
      if (e.key !== 'Tab') return
      const f = items()
      if (f.length === 0) return e.preventDefault()
      const [first, last] = [f[0], f[f.length - 1]]
      if (!el.contains(document.activeElement)) { e.preventDefault(); first.focus() }
      else if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus() }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus() }
    }
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = overflow
      if (opener?.isConnected) opener.focus()
    }
  }, [ref, on])
}

/** Mobile bottom sheet (same .sheet / .sheet-backdrop look as the "Lainnya" sheet) as a modal dialog with a 44px "Tutup". */
export function Sheet({ title, onClose, className = '', children }: { title: ReactNode; onClose: () => void; className?: string; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  const id = useId()
  const phase = usePresenceClass()
  useDialog(ref, onClose)
  return (
    <>
      <div className={`sheet-backdrop ${phase}`} onClick={onClose} />
      <div ref={ref} className={`sheet ${className} ${phase}`} role="dialog" aria-modal="true" aria-labelledby={id} tabIndex={-1}>
        <div className="sheet-handle" aria-hidden="true" />
        <div className="sheet-head">
          <h2 id={id}>{title}</h2>
          <button type="button" className="btn btn-ghost sheet-close" onClick={onClose}>Tutup</button>
        </div>
        {children}
      </div>
    </>
  )
}
