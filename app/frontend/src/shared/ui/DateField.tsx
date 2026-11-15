import type { InputHTMLAttributes } from 'react'
import { fmtYmdShort } from '../format'
import { useIsMobile } from '../useIsMobile'

/** placeholder = phone label while empty (date inputs ignore the attribute; never rendered on desktop). */
type Props = Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'value'> & { value: string }

/**
 * Native date input. On a phone the browser-locale text ("11/15/2026") is covered by an Indonesian label ("15 Nov 2026");
 * tapping still opens the native picker (the label ignores pointer events). Desktop: the plain input, unchanged.
 */
export function DateField({ value, className, placeholder = 'Pilih tanggal', ...props }: Props) {
  const mobile = useIsMobile()
  if (!mobile) return <input type="date" value={value} className={className} {...props} />
  return (
    <span className={'date-field' + (className ? ' ' + className : '')}>
      <input type="date" value={value} {...props} />
      <span className="date-field-text" aria-hidden="true">{value ? fmtYmdShort(value) : placeholder}</span>
    </span>
  )
}
