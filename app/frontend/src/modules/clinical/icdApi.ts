import { api } from '../../shared/api/http'

// A1: ICD-10 / ICD-9-CM suggestions (dentist only). Drafts until approved; approving adds the code to the DRAFT SOAP (A.codes / P.codes).
export type IcdState = 'draf' | 'disetujui' | 'ditolak'
export type IcdCitation =
  | { ref: string; type: 'finding'; id: string; version: number; tooth: number; surface: string | null }
  | { ref: 'A' | 'P'; type: 'note_draft'; id: string; version: number }
export type IcdItem = {
  id: string | null; state: IcdState; system: 'icd10' | 'icd9cm'; code: string; display: string; version: string; reason: string
  citations: IcdCitation[]; source: 'deterministik' | 'model'; rank: number; why: string; perlu_dicek: boolean; reviewed_at?: string | null
}
export type IcdSuggestions = {
  visit_id: string | null; patient_id: string; locked: boolean; paid: boolean; items: IcdItem[]; counts: Record<IcdState, number>
}
export type IcdRejectReason = 'tidak_sesuai' | 'sudah_dicatat' | 'terlalu_umum' | 'kode_lain' | 'lainnya'

export const getVisitIcd = (visitId: string) => api<IcdSuggestions>(`/api/visits/${visitId}/icd-suggestions`)
export const getPatientIcd = (patientId: string) => api<IcdSuggestions>(`/api/patients/${patientId}/icd-suggestions`)
export const approveIcd = (id: string) => api<IcdItem>(`/api/icd-suggestions/${id}/approve`, { method: 'POST' })
export const rejectIcd = (id: string, reason?: IcdRejectReason) =>
  api(`/api/icd-suggestions/${id}/reject`, { method: 'POST', body: reason ? { reason } : {} })
