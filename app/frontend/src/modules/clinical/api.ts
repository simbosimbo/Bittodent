import { api } from '../../shared/api/http'

export type Surface = 'M' | 'D' | 'O' | 'I' | 'B' | 'L'
export type Source = 'manual' | 'ai_draft'
export type ProcStatus = 'kondisi_pantau' | 'ada_di_klinik_ini' | 'ada_di_tempat_lain' | 'direncanakan' | 'selesai' | 'dirujuk'
export type Finding = {
  id: string; visit_id: string; tooth: number; surface: Surface | null; condition: string; status: ProcStatus
  procedure_code: string | null; supersedes_id: string | null
  state: 'draft' | 'final'; source: Source; created_by: string; finalized_at: string | null
}
export type ToothPresence = 'ada' | 'hilang' | 'belum_tumbuh'
export type Baseline = { id: string; version: number; dentition: 'tetap' | 'sulung' | 'campuran'; teeth: Record<string, ToothPresence>; created_at: string }
export type Block = { codes: string[]; text: string }
export type Soap = { S: string; O: string; A: Block; P: Block }
export type Version = {
  id: string; version: number; revision: number; supersedes_id: string | null; status: 'draf' | 'berlaku' | 'digantikan'
  source: Source; signed_by: string | null; signed_by_name: string | null; signed_at: string | null; reason: string | null
  correction_request_id: string | null; content_hash: string; soap: Soap
}
export type Note = {
  id: string; author_id: string; created_at: string; versions: Version[]
  pending_correction: { id: string; reason: string; requested_by: string; requested_by_name: string | null; created_at: string } | null
}
export type ChartVisit = {
  id: string; appointment_id: string | null; branch_id: string; started_at: string; status: string
  dentist: { id: string; name: string | null }; notes: Note[]; draft_findings: Finding[]
}
export type Chart = {
  patient: { id: string; name: string; dob: string | null; sex: string | null; payer_type: string }
  solo_practice: boolean; baseline: Baseline | null; findings: Finding[]; drafts: Finding[]; visits: ChartVisit[]
}

export const getChart = (patientId: string) => api<Chart>(`/api/patients/${patientId}/chart`)
// Walk-in: today's visit without an appointment at the active branch. 201 new, 200 = the open visit already there. dentist_id required for non-dentists.
export const startWalkInVisit = (patientId: string, body: { dentist_id?: string } = {}) =>
  api<{ id: string }>(`/api/patients/${patientId}/visits/walk-in`, { method: 'POST', body })
export const getDentists = () => api<{ data: { id: string; name: string }[] }>('/api/dentists')
export const visitFromAppointment = (appointmentId: string) => api<{ id: string }>(`/api/appointments/${appointmentId}/visit`, { method: 'POST' })
export const saveFinding = (visitId: string, body: { tooth: number; surface: Surface | null; condition: string; status?: ProcStatus; procedure_code?: string | null }) =>
  api<Finding>(`/api/visits/${visitId}/findings`, { method: 'POST', body })
/** Signed item: the server appends a new final row superseding it (only along the allowed transitions). */
export const changeStatus = (findingId: string, to: ProcStatus, visitId?: string | null) =>
  api<Finding>(`/api/findings/${findingId}/status`, { method: 'POST', body: { to, visit_id: visitId ?? null } })
export const saveBaseline = (patientId: string, body: { base_version: number | null; dentition: Baseline['dentition']; teeth: Record<string, ToothPresence> }) =>
  api<Baseline>(`/api/patients/${patientId}/baseline`, { method: 'PUT', body })
export const discardFinding = (id: string) => api(`/api/findings/${id}`, { method: 'DELETE' })
export const saveNote = (visitId: string, body: { revision: number | null; soap: Soap }) =>
  api<{ revision: number }>(`/api/visits/${visitId}/note`, { method: 'PUT', body })
export const signVisit = (visitId: string, body: { revision: number; confirm: true; code: string }) =>
  api(`/api/visits/${visitId}/sign`, { method: 'POST', body })
export const correctNote = (noteId: string, body: { reason: string; soap: Soap }) =>
  api<{ approval: 'not_needed' | 'self' | 'pending' }>(`/api/notes/${noteId}/corrections`, { method: 'POST', body })
export const approveCorrection = (id: string) => api(`/api/correction-requests/${id}/approve`, { method: 'POST' })
