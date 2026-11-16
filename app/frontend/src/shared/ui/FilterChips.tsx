import { ToggleButton } from '@heroui/react'
import type { ReactNode } from 'react'

type Option<K> = readonly [K, ReactNode] | readonly [K, ReactNode, string]

/** One-of-n list filter as a row of toggle chips (group + pressed buttons). Third tuple item = aria-label when the text is abbreviated. */
export function FilterChips<K extends string>({ label, value, options, onChange, className }: {
  label: string; value: K; options: readonly Option<K>[]; onChange: (k: K) => void; className?: string
}) {
  return (
    <div role="group" aria-label={label} className={'bt-chips' + (className ? ' ' + className : '')}>
      {options.map(([k, text, aria]) => (
        <ToggleButton key={k} className="bt-chip" isSelected={k === value} aria-label={aria} onChange={() => onChange(k)}>{text}</ToggleButton>
      ))}
    </div>
  )
}
