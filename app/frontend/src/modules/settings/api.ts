import { api, upload } from '../../shared/api/http'

// Pengaturan Klinik (DEVIATIONS #71): profile (settings.manage), price list (tariff.manage), payment accounts (billing.accounts).
export type Branch = { id: string; name: string; address: string | null; phone: string | null }
export type ClinicProfile = { name: string; address: string | null; phone: string | null; email: string | null
  license_no: string | null; license_valid_until: string | null; npwp: string | null; receipt_paper_mm: 58 | 80; has_logo: boolean; branches: Branch[] }
/** KL10: one logo for every branch (png/jpg/webp, max 1 MB). */
export const uploadLogo = (file: Blob) => upload<ClinicProfile>('/api/settings/clinic/logo', 'logo', file)
export const getProfile = () => api<ClinicProfile>('/api/settings/clinic')
export const saveProfile = (body: Partial<Omit<ClinicProfile, 'branches' | 'has_logo'>>) => api<ClinicProfile>('/api/settings/clinic', { method: 'PUT', body })
export const saveBranch = (id: string, body: { address: string | null; phone: string | null }) =>
  api<Branch>(`/api/settings/branches/${id}`, { method: 'PUT', body })

export type Level = { id: string; variant: string; label: string; price_rp: number }
export type TariffItem = { id: string; procedure_code: string; name: string; category: string | null; valid_from: string | null
  levels: Level[]; next: { valid_from: string; levels: Level[] } | null; editable_from: string }
/** First price for a procedure that has none yet: one price, or its stages (apply today). Rp0 allowed: the owner decides what is free. */
export const addTariff = (procedure_code: string, name: string, price: number | { code: string; label: string; price_rp: number }[]) =>
  api('/api/tariffs', { method: 'POST', body: { procedure_code, name, ...(typeof price === 'number' ? { price_rp: price } : { levels: price }) } })
export const getTariffs = (q = '', category = '') =>
  api<{ items: TariffItem[]; categories: string[] }>(`/api/tariffs?q=${encodeURIComponent(q)}&category=${encodeURIComponent(category)}`)
export const saveLevels = (id: string, valid_from: string, levels: { code: string; label: string; price_rp: number }[]) =>
  api(`/api/tariffs/${id}/levels`, { method: 'PUT', body: { valid_from, levels } })
export const saveCategory = (procedure_code: string, category: string | null) =>
  api('/api/tariffs/category', { method: 'PUT', body: { procedure_code, category } })
export type BulkRow = { procedure_code: string; variant: string; old_rp: number; new_rp: number }
export const bulkTariffs = (body: { procedure_codes: string[]; kind: 'percent' | 'amount'; value: number; rounding: string; valid_from: string; dry_run: boolean }) =>
  api<{ count: number; rows: BulkRow[] }>('/api/tariffs/bulk', { method: 'POST', body: { target: 'umum', ...body } })

export type AccountKind = 'tunai' | 'transfer' | 'qris' | 'edc' | 'bpjs' | 'asuransi'
export type Account = { id: string; branch_id: string | null; name: string; kind: AccountKind; bank_name: string | null
  account_last4: string | null; is_active: boolean; has_qris_image?: boolean }
/** KL12: static QRIS photo of a QRIS account (shown to the patient at the cashier). */
export const uploadQris = (id: string, file: Blob) => upload<Account>(`/api/payment-accounts/${id}/qris-image`, 'image', file)
export const getAccounts = () => api<Account[]>('/api/payment-accounts')
export const addAccount = (body: { name: string; kind: AccountKind; branch_id: string | null; bank_name?: string; account_last4?: string }) =>
  api<Account>('/api/payment-accounts', { method: 'POST', body })
export const updateAccount = (id: string, body: { name?: string; is_active?: boolean }) =>
  api<Account>(`/api/payment-accounts/${id}`, { method: 'PATCH', body })
