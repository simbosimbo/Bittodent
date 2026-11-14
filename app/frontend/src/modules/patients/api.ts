import { api } from '../../shared/api/http'

export type PatientRow = { id: string; name: string; dob: string | null; sex: string | null; payer_type: string; status?: string }
export type PatientFull = PatientRow & { nik: string | null; phone: string | null; address: string | null; payer_name: string | null; payer_member_no: string | null; payer_class: string | null }
type Page = { data: PatientRow[]; next_cursor: string | null }

export const searchPatients = (q: string, cursor?: string) =>
  api<Page>(`/api/patients?q=${encodeURIComponent(q.trim())}` + (cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''))
export const getPatient = (id: string) => api<PatientFull>('/api/patients/' + encodeURIComponent(id))
export const createPatient = (body: Record<string, string>) => api<{ id: string }>('/api/patients', { method: 'POST', body })

// C3 API (Patients module). Alerts/medical history are health data: memory only, never stored in the browser.
// /alerts: every role gets allergies + premed + has_urgent_note; urgent_note/problems/medications only when full (clinical roles).
export type Alerts = { version: number | null; premedication_required: boolean; allergies: string[]; has_urgent_note: boolean; full: boolean
  urgent_note?: string | null; problems?: string[]; medications?: string[] }
type HistoryContent = { premedication_required: boolean; allergies: string[]; urgent_note: string | null; problems: string[]; medications: string[] }
export type HistoryVersion = HistoryContent & { id: string; version: number; created_by: string; created_at: string }
export type MedicalHistory = { current: HistoryVersion | null; history: HistoryVersion[] }
export type Family = {
  is_minor: boolean
  household: { id: string; name: string | null; members: { id: string; name: string; dob: string | null; guarantor_id: string | null }[] } | null
  guarantor: { id: string; name: string } | null
  guardians: { id: string; name: string; relationship: string; guardian_patient_id: string | null; nik: string | null; phone: string | null }[]
}
export type HistoryInput = HistoryContent & { base_version: number | null }

const pid = (id: string) => '/api/patients/' + encodeURIComponent(id)
export const getAlerts = (id: string) => api<Alerts>(pid(id) + '/alerts')
export const getMedicalHistory = (id: string) => api<MedicalHistory>(pid(id) + '/medical-history')
export const saveMedicalHistory = (id: string, body: HistoryInput) => api<HistoryVersion>(pid(id) + '/medical-history', { method: 'PUT', body })
export const getFamily = (id: string) => api<Family>(pid(id) + '/family')
