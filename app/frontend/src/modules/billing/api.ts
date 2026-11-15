import { api } from '../../shared/api/http'

export type Adjustment = { id: string; kind: string; amount_rp: number; reason: string; created_at: string
  status: 'applied' | 'pending' | 'approved' | 'rejected'; self_approved_sole_owner: boolean }
export type Invoice = { id: string; visit_id: string; lines_rp: number; adjustments_rp: number; balance_rp: number
  lines: { id: string; procedure_code: string; procedure_name: string; tooth: number | null; price_rp: number }[]; adjustments: Adjustment[] }

export const invoiceForVisit = (visitId: string) => api<Invoice>(`/api/visits/${visitId}/invoice`)
/** 201 = applied; 202 = brings the balance to Rp0, waits for an owner (unit 4). */
export const addAdjustment = (invoiceId: string, body: { kind: string; amount_rp: number; reason: string }) =>
  api<Invoice>(`/api/invoices/${invoiceId}/adjustments`, { method: 'POST', body })
/** Owner only (billing.approve_zero). 403 conflict_of_interest: own work while another owner exists. */
export const decideAdjustment = (adjustmentId: string, decision: 'approve' | 'reject', reason?: string) =>
  api<Invoice>(`/api/invoice-adjustments/${adjustmentId}/${decision}`, { method: 'POST', body: { reason: reason || null } })
