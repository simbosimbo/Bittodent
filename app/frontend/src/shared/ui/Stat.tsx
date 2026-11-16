import { Card } from '@heroui/react'
import type { ReactNode } from 'react'

/** KPI card: label, big number, optional note and icon (icon hidden on a phone). A region named by its label. */
export function Stat({ label, value, note, icon, className }: { label: string; value: ReactNode; note?: ReactNode; icon?: ReactNode; className?: string }) {
  return (
    <Card className={'bt-stat' + (className ? ' ' + className : '')} role="region" aria-label={label}>
      <span className="bt-stat-head"><span className="bt-stat-label">{label}</span>{icon && <span className="bt-stat-icon">{icon}</span>}</span>
      <strong className="bt-stat-value">{value}</strong>
      {note && <span className="bt-stat-note">{note}</span>}
    </Card>
  )
}
