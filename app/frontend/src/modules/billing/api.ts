import { api } from '../../shared/api/http'

export type Adjustment = { id: string; kind: string; amount_rp: number; reason: string; created_at: string
  status: 'applied' | 'pending' | 'approved' | 'rejected'; self_approved_sole_owner: boolean }
/** Clinic-owned payment destination (unit 5): the only payment methods; owner manages them. */
export type PaymentAccount = { id: string; branch_id: string | null; name: string; kind: 'tunai' | 'qris' | 'edc' | 'transfer' | 'bpjs' | 'asuransi'
  bank_name: string | null; account_last4: string | null; is_active: boolean }
export type Payment = { id: string; payment_account_id: string; amount_rp: number; paid_at: string; refunded_rp: number
  account: Pick<PaymentAccount, 'name' | 'kind' | 'bank_name' | 'account_last4'> }
export type DocStatus = 'applied' | 'pending' | 'approved' | 'rejected'
/** Nota Kredit (unit B): own document per line, numbered NK-YYYY-000001; full = waits for an owner. */
export type CreditNote = { id: string; number: string; invoice_line_id: string; procedure_correction_id: string | null; amount_rp: number
  is_full: boolean; reason_type: string; reason: string; created_at: string; status: DocStatus; self_approved_sole_owner: boolean; refunded_rp: number }
/** Refund (unit C): back to the original payment's clinic account, allocated to a credit note; always waits for an owner. */
export type Refund = { id: string; credit_note_id: string; payment_id: string; payment_account_id: string; method: PaymentAccount['kind']
  amount_rp: number; reason: string; created_at: string; status: 'pending' | 'approved' | 'rejected'; self_approved_sole_owner: boolean }
/** A clinical correction (salah_kode/situs/provider) touched this billed line: the cashier decides (credit note, bill corrected code, reviewed). */
export type CorrectionReview = { id: string; procedure_correction_id: string; reason_type: string; new_procedure_id: string
  billable_code: string | null; status: 'perlu_tinjau' | 'selesai' }
export type InvoiceLine = { id: string; procedure_code: string; procedure_name: string; tooth: number | null; price_rp: number
  credited_rp: number; credit_note_numbers: string[]; tariff_zero: 'pending' | 'approved' | null; correction_reviews: CorrectionReview[] }
export type Invoice = { id: string; visit_id: string; branch_id: string; status: 'terbuka' | 'lunas' | 'void'
  patient_name?: string | null; created_at?: string
  lines_rp: number; adjustments_rp: number; credit_notes_rp: number; payments_rp: number; refunds_rp: number; balance_rp: number; overpaid_rp: number
  lines: InvoiceLine[]; credit_notes: CreditNote[]; voids: { id: string; reason: string; created_at: string; status: DocStatus }[]
  adjustments: Adjustment[]; payments: Payment[]; refunds: Refund[] }
export type PendingReversals = {
  credit_notes: { id: string; number: string; invoice_id: string; visit_id: string; amount_rp: number; reason_type: string; reason: string
    created_at: string; line: { procedure_code: string; procedure_name: string; tooth: number | null; price_rp: number } }[]
  voids: { id: string; invoice_id: string; visit_id: string; reason: string; created_at: string }[]
  refunds: { id: string; invoice_id: string; visit_id: string; amount_rp: number; reason: string; created_at: string; credit_note_number: string | null
    account: Pick<PaymentAccount, 'name' | 'kind' | 'bank_name' | 'account_last4'> }[] }

export const invoiceForVisit = (visitId: string) => api<Invoice>(`/api/visits/${visitId}/invoice`)
/** One request for many visits (Jadwal "Belum bayar"); visits without an invoice (or outside the branch) are absent. */
export const invoiceStatuses = (visitIds: string[]) =>
  api<{ statuses: Record<string, Invoice['status']> }>(`/api/billing/invoice-status?visit_ids=${visitIds.map(encodeURIComponent).join(',')}`)
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
/** Refund (202, pending): account = the original payment's account (server-checked); amount <= credit note, payment and overpayment left. */
export const addRefund = (invoiceId: string, body: { payment_id: string; credit_note_id: string; amount_rp: number; reason: string }) =>
  api<Invoice>(`/api/invoices/${invoiceId}/refunds`, { method: 'POST', body })
/** Owner (billing.approve_reversal); same conflict-of-interest rule as credit notes. */
export const decideRefund = (id: string, decision: 'approve' | 'reject') => api<Invoice>(`/api/refunds/${id}/${decision}`, { method: 'POST', body: {} })
export type DailyRevenue = { date: string; branch_id: string; amount_rp: number; payment_count: number }

// Payments collected today (Asia/Jakarta) in the active branch (server-side session); integer rupiah.
export const getDailyRevenue = () => api<DailyRevenue>('/api/billing/daily-revenue')

/** Kasir worklist (#69): every open invoice of the active branch + today's; newest first. */
export type KasirRow = { id: string; visit_id: string; patient_id: string; patient_name: string | null; status: Invoice['status']; created_at: string
  payer_type?: 'umum' | 'asuransi' | 'bpjs'; items?: string[]
  lines_rp: number; adjustments_rp: number; credit_notes_rp: number; payments_rp: number; refunds_rp: number; balance_rp: number }
/** KL06 cashier shift (own, active branch). methods = per kind (+ bank for edc/transfer); live while open, frozen at close. */
export type ShiftMethod = { kind: PaymentAccount['kind']; bank_name: string | null; amount_rp: number; count: number }
export type Shift = { id: string; opening_cash_rp: number; opened_at: string; closed_at: string | null; counted_cash_rp: number | null
  difference_rp: number | null; reason: string | null; methods: ShiftMethod[]; cash_in_rp: number; expected_cash_rp: number; total_rp: number }
export const currentShift = () => api<{ shift: Shift | null }>('/api/cash-shift/current')
export const openShift = (opening_cash_rp: number) => api<{ shift: Shift }>('/api/cash-shift', { method: 'POST', body: { opening_cash_rp } })
export const closeShift = (id: string, body: { counted_cash_rp: number; reason?: string }) =>
  api<{ shift: Shift }>(`/api/cash-shift/${id}/close`, { method: 'POST', body })

export type KasirList = { date: string; branch_id: string; invoices: KasirRow[] }
export const kasirList = () => api<KasirList>('/api/billing/invoices')

export const fmtRp = (n: number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n)
