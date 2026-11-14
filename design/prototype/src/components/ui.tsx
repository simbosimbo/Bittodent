import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react'
import { useEffect, useId, useRef } from 'react'
import { Icon, type IconName } from './Icon'

type BtnVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'quiet'
export function Button({ variant = 'secondary', icon, size, className = '', children, ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: BtnVariant; icon?: IconName; size?: 'sm' | 'md' }) {
  return (
    <button type="button" className={`btn btn-${variant} ${size === 'sm' ? 'btn-sm' : ''} ${className}`} {...rest}>
      {icon && <Icon name={icon} size={18} />}
      {children}
    </button>
  )
}

export type BadgeTone = 'neutral' | 'primary' | 'success' | 'warning' | 'danger' | 'info' | 'draft' | 'locked' | 'offline'
export function Badge({ tone = 'neutral', icon, children, title }: { tone?: BadgeTone; icon?: IconName; children: ReactNode; title?: string }) {
  return <span className={`badge badge-${tone}`} title={title}>{icon && <Icon name={icon} size={14} />}{children}</span>
}
// Lencana baku dari brief. Dipakai di semua modul supaya teksnya selalu sama.
export const DraftAiBadge = () => <Badge tone="draft" icon="sparkle">Draf AI, perlu persetujuan dokter</Badge>
export const LockedBadge = () => <Badge tone="locked" icon="lock">Terkunci</Badge>
export const OfflineBadge = () => <Badge tone="offline" icon="wifiOff">Offline</Badge>
export const UnsyncedBadge = ({ n = 2 }: { n?: number } = {}) => <Badge tone="warning">Belum sinkron ({n} antrean)</Badge>
export const ClaimPendingBadge = () => <Badge tone="info">Menunggu klaim</Badge>
export const QrisBadge = () => <Badge tone="warning" icon="alert">QRIS — perlu konfirmasi Jerome</Badge>

export function Field({ label, hint, error, children, required }: { label: string; hint?: string; error?: string; children: (id: string) => ReactNode; required?: boolean }) {
  const id = useId()
  return (
    <div className="field">
      <label htmlFor={id}>{label}{required && <span className="req" aria-hidden> *</span>}</label>
      {children(id)}
      {hint && !error && <small className="hint">{hint}</small>}
      {error && <small className="err" role="alert">{error}</small>}
    </div>
  )
}
export const Input = (p: InputHTMLAttributes<HTMLInputElement>) => <input className="input" {...p} />
export const Select = (p: SelectHTMLAttributes<HTMLSelectElement>) => <select className="input" {...p} />
export const Textarea = (p: TextareaHTMLAttributes<HTMLTextAreaElement>) => <textarea className="input" {...p} />

export function Switch({ checked, onChange, label, disabled }: { checked: boolean; onChange: (v: boolean) => void; label: string; disabled?: boolean }) {
  return (
    <label className={`switch ${disabled ? 'is-disabled' : ''}`}>
      <input type="checkbox" role="switch" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
      <span className="switch-track" aria-hidden><span className="switch-thumb" /></span>
      <span className="switch-label">{label}</span>
    </label>
  )
}

export function Modal({ title, onClose, children, footer, wide }: { title: string; onClose: () => void; children: ReactNode; footer?: ReactNode; wide?: boolean }) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null
    ref.current?.querySelector<HTMLElement>('input,textarea,button:not(.modal-x)')?.focus()
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', k)
    return () => { window.removeEventListener('keydown', k); prev?.focus() }
  }, [onClose])
  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`modal ${wide ? 'modal-wide' : ''}`} role="dialog" aria-modal="true" aria-label={title} ref={ref}>
        <header className="modal-head"><h2>{title}</h2><button className="icon-btn modal-x" onClick={onClose} aria-label="Tutup"><Icon name="x" /></button></header>
        <div className="modal-body">{children}</div>
        {footer && <footer className="modal-foot">{footer}</footer>}
      </div>
    </div>
  )
}

export function Card({ title, actions, children, className = '' }: { title?: ReactNode; actions?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`card ${className}`}>
      {(title || actions) && <header className="card-head">{title && <h3>{title}</h3>}{actions && <div className="card-actions">{actions}</div>}</header>}
      {children}
    </section>
  )
}
export function Seg<T extends string>({ value, options, onChange, label }: { value: T; options: { v: T; label: string }[]; onChange: (v: T) => void; label: string }) {
  return (
    <div className="seg" role="radiogroup" aria-label={label}>
      {options.map((o) => <button key={o.v} type="button" role="radio" aria-checked={value === o.v} className={value === o.v ? 'on' : ''} onClick={() => onChange(o.v)}>{o.label}</button>)}
    </div>
  )
}
