import { Icon } from './Icon'

export function PinPad({ value, onChange, onSubmit, disabled, length = 6 }: { value: string; onChange: (v: string) => void; onSubmit: (v: string) => void; disabled?: boolean; length?: number }) {
  const press = (d: string) => { if (value.length < length) { const v = value + d; onChange(v); if (v.length === length) setTimeout(() => onSubmit(v), 150) } }
  return (
    <div className="pinpad">
      <div className="pin-dots" aria-label={`${value.length} dari ${length} angka`} role="status">
        {Array.from({ length }, (_, i) => <span key={i} className={i < value.length ? 'on' : ''} />)}
      </div>
      <div className="pin-keys">
        {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => <button key={d} disabled={disabled} onClick={() => press(d)}>{d}</button>)}
        <span />
        <button disabled={disabled} onClick={() => press('0')}>0</button>
        <button disabled={disabled || !value} onClick={() => onChange(value.slice(0, -1))} aria-label="Hapus satu angka"><Icon name="x" /></button>
      </div>
    </div>
  )
}
