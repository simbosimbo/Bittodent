import { api } from '../../shared/api/http'

export type DentistRow = { dentist_id: string | null; name: string; external: number; external_pending: number; external_rejected: number
  rp0: number; rp0_pending: number; discounts: number; discount_total_rp: number; full_discounts: number; self_approved: number
  unbilled_visits: number; batal: number; closed_without_invoice: number
  // unit D (DEVIATIONS #58): each correction kind in its own column; rp0 = approved 100% discount only, Rp0 tariff lines = tariff_zero
  full_discount_rp: number; tariff_zero: number; tariff_zero_pending: number
  corr_salah_kode: number; corr_salah_situs: number; corr_salah_provider: number; corr_tidak_dikerjakan: number; corr_total_rp: number
  corr_pending: number; corr_rejected: number; corr_outside_window: number; corr_owner_approved: number; corr_self_approved: number
  cn_partial: number; cn_partial_rp: number; cn_full: number; cn_full_rp: number; cn_pending: number; cn_pending_rp: number; cn_approved: number
  refunds: number; refund_rp: number; refund_pending: number; refund_pending_rp: number
  voids: number; void_rp: number; void_pending: number; void_pending_rp: number; reversal_self_approved: number }
export type AlertKind = 'tanpa_tagihan' | 'luar_setelah_datang' | 'rp0_menunggu' | 'disetujui_sendiri' | 'batal_tanpa_tagihan'
  | 'koreksi_menunggu' | 'pembalikan_menunggu' | 'pembalikan_disetujui_sendiri' | 'tarif_nol' | 'tinjau_koreksi_lama'
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

/** KL07-KL09 revenue report of the active branch (owner only). Revenue = money received; per dokter/tindakan = billed lines in the period. */
export type Period = 'today' | '7d' | 'month'
export type RevenueReport = { period: Period; from: string; to: string; branch: { id: string; name: string }
  revenue_rp: number; prev_revenue_rp: number; transactions: number; receivable_rp: number; receivable_patients: number
  daily: { date: string; amount_rp: number }[]
  by_method: { kind: string; bank_name: string | null; amount_rp: number; count: number }[]
  by_doctor: { doctor_id: string | null; name: string; procedures: number; patients: number; amount_rp: number }[]
  by_procedure: { name: string; count: number; amount_rp: number }[]
  receivables: { patient_name: string; days: number; items: string[]; amount_rp: number }[]
  shift_differences: { user_name: string; closed_at: string; difference_rp: number; reason: string | null }[] }
export const revenueReport = (period: Period) => api<RevenueReport>(`/api/reports/revenue?period=${period}`)
