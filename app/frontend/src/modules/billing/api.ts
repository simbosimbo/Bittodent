import { api } from '../../shared/api/http'

export type Adjustment = { id: string; kind: string; amount_rp: number; reason: string; created_at: string
  status: 'applied' | 'pending' | 'approved' | 'rejected'; self_approved_sole_owner: boolean }
/** Clinic-owned payment destination (unit 5): the only payment methods; owner manages them. */
export type PaymentAccount = { id: string; branch_id: string | null; name: string; kind: 'tunai' | 'qris' | 'edc' | 'transfer'
  bank_name: string | null; account_last4: string | null; is_active: boolean }
export type Payment = { id: string; payment_account_id: string; amount_rp: number; paid_at: string
  account: Pick<PaymentAccount, 'name' | 'kind' | 'bank_name' | 'account_last4'> }
export type DocStatus = 'applied' | 'pending' | 'approved' | 'rejected'
/** Nota Kredit (unit B): own document per line, numbered NK-YYYY-000001; full = waits for an owner. */
export type CreditNote = { id: string; number: string; invoice_line_id: string; procedure_correction_id: string | null; amount_rp: number
  is_full: boolean; reason_type: string; reason: string; created_at: string; status: DocStatus; self_approved_sole_owner: boolean }
/** A clinical correction (salah_kode/situs/provider) touched this billed line: the cashier decides (credit note, bill corrected code, reviewed). */
export type CorrectionReview = { id: string; procedure_correction_id: string; reason_type: string; new_procedure_id: string
  billable_code: string | null; status: 'perlu_tinjau' | 'selesai' }
export type InvoiceLine = { id: string; procedure_code: string; procedure_name: string; tooth: number | null; price_rp: number
  credited_rp: number; credit_note_numbers: string[]; tariff_zero: 'pending' | 'approved' | null; correction_reviews: CorrectionReview[] }
export type Invoice = { id: string; visit_id: string; branch_id: string; status: 'terbuka' | 'lunas' | 'void'
  lines_rp: number; adjustments_rp: number; credit_notes_rp: number; payments_rp: number; balance_rp: number
  lines: InvoiceLine[]; credit_notes: CreditNote[]; voids: { id: string; reason: string; created_at: string; status: DocStatus }[]
  adjustments: Adjustment[]; payments: Payment[] }
export type PendingReversals = {
  credit_notes: { id: string; number: string; invoice_id: string; visit_id: string; amount_rp: number; reason_type: string; reason: string
    created_at: string; line: { procedure_code: string; procedure_name: string; tooth: number | null; price_rp: number } }[]
  voids: { id: string; invoice_id: string; visit_id: string; reason: string; created_at: string }[] }

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
/** 201 = partial, applied; 202 = covers the rest of the line, waits for an owner (billing.approve_reversal). */
export const addCreditNote = (invoiceId: string, body: { invoice_line_id: string; amount_rp: number; reason_type: string; reason: string
  procedure_correction_id?: string | null }) => api<Invoice>(`/api/invoices/${invoiceId}/credit-notes`, { method: 'POST', body })
export const decideCreditNote = (id: string, decision: 'approve' | 'reject') =>
  api<Invoice>(`/api/credit-notes/${id}/${decision}`, { method: 'POST', body: {} })
/** Only without payments. 201 = void now (no billed line); 202 = waits for an owner. */
export const voidInvoice = (invoiceId: string, reason: string) => api<Invoice>(`/api/invoices/${invoiceId}/void`, { method: 'POST', body: { reason } })
export const decideVoid = (id: string, decision: 'approve' | 'reject') => api<Invoice>(`/api/invoice-voids/${id}/${decision}`, { method: 'POST', body: {} })
export const pendingReversals = () => api<PendingReversals>('/api/billing/reversals/pending')
/** "Tagih kode yang benar": new line for the corrected procedure at today's tariff; the old line stays. Idempotent. */
export const billFromCorrection = (invoiceId: string, correctionId: string) =>
  api<Invoice>(`/api/invoices/${invoiceId}/lines/from-correction/${correctionId}`, { method: 'POST', body: {} })
export const reviewCorrection = (id: string, reason: string) => api<Invoice>(`/api/line-corrections/${id}/review`, { method: 'POST', body: { reason } })
/** Owner (billing.approve_zero): a Rp0 tariff line is a tariff anomaly, not a correction. */
export const approveZeroTariff = (lineId: string) => api<Invoice>(`/api/invoice-lines/${lineId}/approve-zero-tariff`, { method: 'POST', body: {} })
