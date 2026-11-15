import type { InputHTMLAttributes } from 'react'
import { fmtYmdShort } from '../format'
import { useIsMobile } from '../useIsMobile'

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'value'> & { value: string }

/**
 * Native date input. On a phone the browser-locale text ("11/15/2026") is covered by an Indonesian label ("15 Nov 2026");
 * tapping still opens the native picker (the label ignores pointer events). Desktop: the plain input, unchanged.
 */
export function DateField({ value, className, ...props }: Props) {
  const mobile = useIsMobile()
  if (!mobile) return <input type="date" value={value} className={className} {...props} />
  return (
    <span className={'date-field' + (className ? ' ' + className : '')}>
      <input type="date" value={value} {...props} />
      <span className="date-field-text" aria-hidden="true">{value ? fmtYmdShort(value) : 'Pilih tanggal'}</span>
    </span>
  )
}
