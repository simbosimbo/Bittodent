// App-wide toast (role=status, never traps focus). Optional undo; gone after 5 s. Schedule still has its own for local actions.
import { useEffect, useRef, useState } from 'react'

type ToastMsg = { id: number; text: string; undo?: () => void; undoLabel?: string }
let next = 1
const listeners = new Set<(t: ToastMsg | null) => void>()
let current: ToastMsg | null = null

export function say(text: string, undo?: () => void, undoLabel = 'Urungkan') {
  current = { id: next++, text, undo, undoLabel: undo ? undoLabel : undefined }
  listeners.forEach((fn) => fn(current))
}

export function ToastHost() {
  const [toast, setToast] = useState<ToastMsg | null>(null)
  useEffect(() => {
    listeners.add(setToast)
    return () => { listeners.delete(setToast) }
  }, [])
  if (!toast) return null
  return <Toast key={toast.id} text={toast.text} undo={toast.undo} undoLabel={toast.undoLabel} onDone={() => { current = null; setToast(null) }} />
}

/** Short status message above the bottom nav; optional undo; gone after 5 s. Never traps focus. */
export function Toast({ text, undo, undoLabel = 'Urungkan', onDone }: { text: string; undo?: () => void; undoLabel?: string; onDone: () => void }) {
  const done = useRef(onDone)
  done.current = onDone
  useEffect(() => {
    const t = setTimeout(() => done.current(), 5000)
    return () => clearTimeout(t)
  }, [])
  return (
    <div className="toast" role="status">
      <span>{text}{undo && ' ·'}</span>
      {undo && <button type="button" className="btn btn-ghost" onClick={() => { onDone(); undo() }}>{undoLabel}</button>}
    </div>
  )
}
