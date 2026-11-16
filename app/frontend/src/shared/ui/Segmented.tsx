import { useId, type ReactNode } from 'react'
import { ToggleButton, ToggleButtonGroup } from '@heroui/react'

/** One-of-n setting as a segmented control (React Aria radiogroup + radios). `showLabel` prints the label beside it. */
export function Segmented<K extends string | number>({ label, showLabel = false, value, options, onChange, className }: {
  label: string; showLabel?: boolean; value: K; options: readonly (readonly [K, ReactNode])[]; onChange: (k: K) => void; className?: string
}) {
  const id = useId()
  const group = (
    <ToggleButtonGroup aria-label={showLabel ? undefined : label} aria-labelledby={showLabel ? id : undefined} selectionMode="single" disallowEmptySelection
      className={'bt-seg' + (className ? ' ' + className : '')} selectedKeys={[String(value)]}
      onSelectionChange={(keys) => { const k = options.find(([o]) => keys.has(String(o))); if (k) onChange(k[0]) }}>
      {options.map(([k, text], i) => <ToggleButton key={String(k)} id={String(k)}>{i > 0 && <ToggleButtonGroup.Separator />}{text}</ToggleButton>)}
    </ToggleButtonGroup>
  )
  return showLabel ? <div className="bt-seg-field"><span className="bt-seg-label" id={id}>{label}</span>{group}</div> : group
}
