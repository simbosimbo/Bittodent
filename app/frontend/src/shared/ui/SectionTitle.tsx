import type { ReactNode } from 'react'

/** Section heading with a count: "Belum bayar · 3". */
export function SectionTitle({ id, count, children }: { id?: string; count?: number; children: ReactNode }) {
  return <h2 id={id} className="bt-section">{children}{count !== undefined && <> <span className="bt-count">· {count}</span></>}</h2>
}
