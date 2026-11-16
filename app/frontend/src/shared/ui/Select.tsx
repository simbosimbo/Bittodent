import { NativeSelect } from '@heroui-pro/react/native-select'
import type { ComponentPropsWithoutRef, ReactNode } from 'react'

/** Native <select> on HeroUI Pro NativeSelect (full width by default). Options stay plain <option>s; `wrapClassName` sizes the wrapper. */
export function Select({ fullWidth = true, wrapClassName, ...props }: ComponentPropsWithoutRef<'select'> & { children: ReactNode; fullWidth?: boolean; wrapClassName?: string }) {
  return <NativeSelect fullWidth={fullWidth} {...{ className: wrapClassName }}><NativeSelect.Trigger {...props} /></NativeSelect>
}
