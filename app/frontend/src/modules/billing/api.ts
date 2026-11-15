import { api } from '../../shared/api/http'

export type Adjustment = { id: string; kind: string; amount_rp: number; reason: string; created_at: string
  status: 'applied' | 'pending' | 'approved' | 'rejected'; self_approved_sole_owner: boolean }
/** Clinic-owned payment destination (unit 5): the only payment methods; owner manages them. */
export type PaymentAccount = { id: string; branch_id: string | null; name: string; kind: 'tunai' | 'qris' | 'edc' | 'transfer'
  bank_name: string | null; account_last4: string | null; is_active: boolean }
export type Payment = { id: string; payment_account_id: string; amount_rp: number; paid_at: string
  account: Pick<PaymentAccount, 'name' | 'kind' | 'bank_name' | 'account_last4'> }
export type Invoice = { id: string; visit_id: string; branch_id: string; status: 'terbuka' | 'lunas'
  lines_rp: number; adjustments_rp: number; payments_rp: number; balance_rp: number
  lines: { id: string; procedure_code: string; procedure_name: string; tooth: number | null; price_rp: number }[]
  adjustments: Adjustment[]; payments: Payment[] }

export const invoiceForVisit = (visitId: string) => api<Invoice>(`/api/visits/${visitId}/invoice`)
/** 201 = applied; 202 = brings the balance to Rp0, waits for an owner (unit 4). */
export const addAdjustment = (invoiceId: string, body: { kind: string; amount_rp: number; reason: string }) =>
  api<Invoice>(`/api/invoices/${invoiceId}/adjustments`, { method: 'POST', body })
/** Owner only (billing.approve_zero). 403 conflict_of_interest: own work while another owner exists. */
export const decideAdjustment = (adjustmentId: string, decision: 'approve' | 'reject', reason?: string) =>
  api<Invoice>(`/api/invoice-adjustments/${adjustmentId}/${decision}`, { method: 'POST', body: { reason: reason || null } })
export const paymentAccounts = () => api<PaymentAccount[]>('/api/payment-accounts')
/** One payment into a clinic account; a split = several calls. request_key makes a resend safe (no double payment). */
export const addPayment = (invoiceId: string, body: { payment_account_id: string; amount_rp: number; request_key: string }) =>
  api<Invoice>(`/api/invoices/${invoiceId}/payments`, { method: 'POST', body })
