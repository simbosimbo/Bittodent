import { api } from '../../shared/api/http'

export type DentistRow = { dentist_id: string | null; name: string; external: number; external_pending: number; external_rejected: number
  rp0: number; rp0_pending: number; discounts: number; discount_total_rp: number; full_discounts: number; self_approved: number
  unbilled_visits: number; batal: number; closed_without_invoice: number }
export type AlertKind = 'tanpa_tagihan' | 'luar_setelah_datang' | 'rp0_menunggu' | 'disetujui_sendiri' | 'batal_tanpa_tagihan'
export type Alert = { kind: AlertKind; at: string | null; dentist_id: string | null; dentist_name: string | null; patient_id: string | null
  patient_name: string | null; visit_id: string | null; ref_id: string; detail: Record<string, unknown> }
export type Totals = Omit<DentistRow, 'dentist_id' | 'name'>
export type IntegrityReport = { from: string; to: string; timezone: string; dentists: DentistRow[]; totals: Totals; average: Totals; alerts: Alert[] }
export type AuditRow = { id: string; occurred_at: string; actor_type: string; actor_id: string | null; actor_name: string | null; action: string
  entity_type: string; entity_id: string | null; branch_id: string | null; detail: Record<string, unknown> | null }
export type AuditPage = { data: AuditRow[]; page: number; last_page: number; total: number; per_page: number }

const qs = (p: Record<string, string | number | undefined>) =>
  new URLSearchParams(Object.entries(p).filter(([, v]) => v !== undefined && v !== '').map(([k, v]) => [k, String(v)])).toString()

/** Owner only (reporting.read). Opening is audited server-side. */
export const integrityReport = (from?: string, to?: string) => api<IntegrityReport>(`/api/reports/integrity?${qs({ from, to })}`)
/** Owner only (audit.read). Read only: the API has no update/delete for audit rows. */
export const auditEvents = (p: { page?: number; from?: string; to?: string; action?: string; entity_type?: string }) =>
  api<AuditPage>(`/api/audit-events?${qs(p)}`)
