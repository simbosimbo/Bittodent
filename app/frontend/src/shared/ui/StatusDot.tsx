import type { ReactNode } from 'react'

/** Status as a coloured dot + neutral text (no bordered chip). `status` picks the dot colour (app.css `.bt-status[data-status]`). */
export function StatusDot({ status, children, className }: { status: string; children: ReactNode; className?: string }) {
  return <span className={'bt-status' + (className ? ' ' + className : '')} data-status={status}><i aria-hidden="true" />{children}</span>
}
