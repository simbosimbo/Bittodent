import { api } from '../../shared/api/http'

export type Surface = 'M' | 'D' | 'O' | 'I' | 'B' | 'L'
export type Source = 'manual' | 'ai_draft'
export type ProcStatus = 'kondisi_pantau' | 'ada_di_klinik_ini' | 'ada_di_tempat_lain' | 'direncanakan' | 'selesai' | 'dirujuk' | 'cancelled' | 'superseded' | 'tidak_dikerjakan'
export type Finding = {
  id: string; visit_id: string; tooth: number; surface: Surface | null; condition: string; status: ProcStatus
  procedure_code: string | null; supersedes_id: string | null
  state: 'draft' | 'final'; source: Source; created_by: string; finalized_at: string | null
  /** agent draft approved ("Setujui") by the DPJP; source stays ai_draft */
  approved_at?: string | null
}
/** Treatment (procedure_record): one act, one price; surfaces is a combination in M O D I B L order, e.g. "MOD". */
export type TreatArea = 'surface' | 'tooth' | 'range' | 'quadrant' | 'arch' | 'mouth'
export type Procedure = {
  id: string; visit_id: string | null; treat_area: TreatArea; tooth: number | null; surfaces: string | null
  tooth_range: string | null; quadrant: number | null; arch: string | null; status: ProcStatus
  procedure_code: string | null; variant: string; diagnosis_code: string | null; provider_id: string
  state: 'draft' | 'final'; source: Source; supersedes_id: string | null; created_by: string; finalized_at: string | null
  approved_at?: string | null
  paint_type: string; name: string | null; layman: string | null
  /** odontogram v2: taxonomy condition key (e.g. tambalan_komposit) + bridge roles per tooth + protesa material; null on older rows */
  condition?: string | null; span_roles?: Record<string, 'abutment' | 'pontic'> | null; material?: string | null
  /** status ada_di_tempat_lain only: other clinic + approximate date (first day of month/year when coarser) */
  external_clinic_name: string | null; external_date: string | null; external_date_precision: 'day' | 'month' | 'year' | null
  /** pending = entered on a day with `selesai` work; front desk / assistant confirm. pending/rejected are not chart history. */
  external_confirmation: 'not_required' | 'pending' | 'confirmed' | 'rejected' | null
  external_confirmed_by: string | null; external_confirmed_at: string | null; external_confirmation_reason: string | null
  /** unit 3: reason of a replace/correction; replaces_id = the restoration this new work replaces */
  reason: string | null; replaces_id: string | null
}
/** Every final row in force (as of the cut), oldest first. change = how it was superseded: replaced, corrected, or a status move. */
export type ProcedureHistoryRow = Procedure & { effective_at: string; superseded_by: string | null; change: 'digantikan' | 'koreksi' | 'status' | null }
export type ToothPresence = 'ada' | 'hilang' | 'belum_tumbuh'
export type Baseline = { id: string; version: number; dentition: 'tetap' | 'sulung' | 'campuran'; teeth: Record<string, ToothPresence>; created_at: string }
export type Block = { codes: string[]; text: string }
export type Soap = { S: string; O: string; A: Block; P: Block }
export type Version = {
  id: string; version: number; revision: number; supersedes_id: string | null; status: 'draf' | 'berlaku' | 'digantikan'
  source: Source; approved_at?: string | null; signed_by: string | null; signed_by_name: string | null; signed_at: string | null; reason: string | null
  correction_request_id: string | null; content_hash: string; soap: Soap
}
export type Note = {
  id: string; author_id: string; created_at: string; versions: Version[]
  pending_correction: { id: string; reason: string; requested_by: string; requested_by_name: string | null; created_at: string } | null
}
export type ChartVisit = {
  id: string; appointment_id: string | null; branch_id: string; started_at: string; status: string; attendance_cancelled_at?: string | null
  dentist: { id: string; name: string | null }; notes: Note[]; draft_findings: Finding[]; draft_procedures: Procedure[]
  /** open visits only: unsigned clinical work (close through Selesai) / attendance cancelled (may close via /close with a reason) */
  needs_selesai?: boolean; attendance_cancelled?: boolean
}
export type Chart = {
  /** YYYY-MM-DD when viewing the chart as of the end of that day (no drafts, no confirmation queue); null = today */
  as_of: string | null; procedure_history: ProcedureHistoryRow[]
  patient: { id: string; name: string; dob: string | null; sex: string | null; payer_type: string }
  solo_practice: boolean; baseline: Baseline | null; findings: Finding[]; drafts: Finding[]
  procedures: Procedure[]; procedure_drafts: Procedure[]; pending_externals: Procedure[]; visits: ChartVisit[]
}

export const getChart = (patientId: string, asOf?: string | null) =>
  api<Chart>(`/api/patients/${patientId}/chart${asOf ? `?as_of=${encodeURIComponent(asOf)}` : ''}`)
/** Replace existing work (selesai / sudah ada) with new work on the same site; the old one is kept and shown as Digantikan. Dentist only. */
export const replaceProcedure = (procedureId: string, body: { visit_id: string; status: 'direncanakan' | 'selesai'; procedure_code: string; tooth: number | null
  surfaces: string | null; reason: string }) =>
  api<{ replaced: Procedure; procedure: Procedure }>(`/api/procedures/${procedureId}/replace`, { method: 'POST', body })
export type CorrectionType = 'salah_kode' | 'salah_situs' | 'salah_provider' | 'tidak_dikerjakan'
/**
 * Correct a signed record (not its status): new row, old one stays readable. Never bills. Dentist only. Within the clinic's window
 * it applies at once (approval not_needed); outside it waits for the owner (approval pending, no new row yet).
 */
export const correctProcedure = (procedureId: string, body: { reason_type: CorrectionType; reason: string; procedure_code?: string; surfaces?: string | null }) =>
  api<(Procedure & { approval: 'not_needed'; correction_id: string }) | { approval: 'pending'; correction_id: string; window_hours: number }>(
    `/api/procedures/${procedureId}/corrections`, { method: 'POST', body })
export type PendingCorrection = { id: string; reason_type: CorrectionType; reason: string; proposed: Partial<Procedure> | null
  requested_by: { id: string; name: string | null }; created_at: string; procedure: Procedure }
/** Owner only (correction.approve): procedure corrections outside the window, waiting for a decision. */
export const pendingCorrections = () => api<PendingCorrection[]>('/api/procedure-corrections/pending')
export const decideCorrection = (id: string, decision: 'approve' | 'reject', reason?: string) =>
  api(`/api/procedure-corrections/${id}/${decision}`, { method: 'POST', body: { reason: reason || null } })
/** Owner only (settings.manage): free-edit window for procedure corrections (hours, default 48) + PIN at Selesai (default off). */
export type ClinicSettings = { correction_window_hours: number; selesai_pin_required: boolean }
export const getClinicSettings = () => api<ClinicSettings>('/api/settings/clinic')
export const saveClinicSettings = (body: Partial<ClinicSettings>) => api<ClinicSettings>('/api/settings/clinic', { method: 'PUT', body })
/** Own 6-digit Selesai PIN: first set without current_pin; change needs it. 403 wrong current PIN / locked. */
export const setSelesaiPin = (pin: string, currentPin?: string) =>
  api<{ has_pin: true }>('/api/me/selesai-pin', { method: 'PUT', body: { pin, current_pin: currentPin || null } })
/** Close a visit (unit 4) with nothing to sign or cancelled attendance; unsigned clinical work = 409 use_selesai (DPJP presses Selesai). */
export const closeVisit = (visitId: string, reason?: string) =>
  api<{ id: string; status: string; closed_without_invoice: boolean }>(`/api/visits/${visitId}/close`, { method: 'POST', body: { reason: reason || null } })
/** Walk-in only: record that attendance was cancelled (then the visit may close without an invoice, with a reason). */
export const cancelAttendance = (visitId: string, reason: string) => api(`/api/visits/${visitId}/cancel-attendance`, { method: 'POST', body: { reason } })
// Walk-in: today's visit without an appointment at the active branch. 201 new, 200 = the open visit already there. dentist_id required for non-dentists.
export const startWalkInVisit = (patientId: string, body: { dentist_id?: string } = {}) =>
  api<{ id: string }>(`/api/patients/${patientId}/visits/walk-in`, { method: 'POST', body })
export const getDentists = () => api<{ data: { id: string; name: string }[] }>('/api/dentists')
// #70: after RM Selesai the doctor's appointment leaves the chair too (in_treatment -> done), so "Pasien saya" stays current.
export const appointmentDone = (id: string) => api(`/api/appointments/${id}/transition`, { method: 'POST', body: { to: 'done' } })
export const visitFromAppointment = (appointmentId: string) => api<{ id: string }>(`/api/appointments/${appointmentId}/visit`, { method: 'POST' })
/** Visual condition only (karies, hilang, ...). Treatments go through saveProcedure. */
export const saveFinding = (visitId: string, body: { tooth: number; surface: Surface | null; condition: string }) =>
  api<Finding>(`/api/visits/${visitId}/findings`, { method: 'POST', body })
export const saveProcedure = (visitId: string, body: { tooth: number | null; surfaces: string | null; status: ProcStatus; procedure_code: string | null; diagnosis_code?: string | null; treat_area?: TreatArea
  external_clinic_name?: string; external_date?: string }) =>
  api<Procedure>(`/api/visits/${visitId}/procedures`, { method: 'POST', body })
/**
 * Odontogram v2 "tindakan dulu" (POST /visits/{id}/tooth-entries): one Simpan = one draft row. Selesai bills the clinic code mapped to
 * the condition: 422 {error:'pick_code', candidates} when several fit (send the chosen procedure_code again), 422 on `condition` when unmapped.
 */
export const saveToothEntry = (visitId: string, body: import('./odontogram/taxonomy').ToothEntry) =>
  api<Procedure>(`/api/visits/${visitId}/tooth-entries`, { method: 'POST', body })
/** OVv2-06 Pemeriksaan awal: many teeth, ONE Simpan, all or nothing; status Ada sebelumnya / Rencana only (never bills). */
export const saveToothEntries = (visitId: string, entries: import('./odontogram/taxonomy').ToothEntry[]) =>
  api<{ created: number }>(`/api/visits/${visitId}/tooth-entries/batch`, { method: 'POST', body: { entries } })
export type CatalogRow = { procedure_code: string; name: string; treat_area: TreatArea; paint_type: string; conditions: string[] }
/** Clinic procedure catalog with the mapped odontogram condition codes (dentist reads; owner edits in Pengaturan > Harga). */
export const getCatalog = () => api<CatalogRow[]>('/api/procedure-catalog')
export const setCatalogConditions = (code: string, conditions: string[], name?: string) =>
  api<CatalogRow>(`/api/procedure-catalog/${encodeURIComponent(code)}/conditions`, { method: 'PUT', body: { conditions, ...(name ? { name } : {}) } })
/** Signed procedure: the server appends a new final row superseding it (only along the allowed transitions). */
export const changeStatus = (procedureId: string, to: ProcStatus, visitId?: string | null) =>
  api<Procedure>(`/api/procedures/${procedureId}/status`, { method: 'POST', body: { to, visit_id: visitId ?? null } })
/** perm procedure.confirm_external (front desk, assistant): confirm or reject a pending external entry. */
export const confirmExternal = (procedureId: string, confirm: boolean, reason?: string) =>
  api<Procedure>(`/api/procedures/${procedureId}/confirm-external`, { method: 'POST', body: { confirm, reason: reason || null } })
export const discardProcedure = (id: string) => api(`/api/procedures/${id}`, { method: 'DELETE' })
export const saveBaseline = (patientId: string, body: { base_version: number | null; dentition: Baseline['dentition']; teeth: Record<string, ToothPresence> }) =>
  api<Baseline>(`/api/patients/${patientId}/baseline`, { method: 'PUT', body })
export const discardFinding = (id: string) => api(`/api/findings/${id}`, { method: 'DELETE' })
export const saveNote = (visitId: string, body: { revision: number | null; soap: Soap }) =>
  api<{ revision: number }>(`/api/visits/${visitId}/note`, { method: 'PUT', body })
/** Selesai = tanda tangan elektronik + tutup kunjungan (DPJP only). Server stores its own attestation text; pin only when the clinic requires it. */
export const ATTESTATION = 'Dengan menekan Selesai, saya menyatakan catatan ini benar.'
export const selesaiVisit = (visitId: string, body: { revision: number; confirm: true; pin?: string; accept_warnings?: boolean; reason?: string }) =>
  api<{ signature_hash: string; signed_at: string }>(`/api/visits/${visitId}/selesai`, { method: 'POST', body })
/** "Setujui" agent drafts (all pending on the visit, or the given ids). Selesai refuses unapproved ones (422 unapproved_drafts). */
export const approveDrafts = (visitId: string, ids?: string[]) => api(`/api/visits/${visitId}/approve-drafts`, { method: 'POST', body: ids ? { ids } : {} })
export const correctNote = (noteId: string, body: { reason: string; soap: Soap }) =>
  api<{ approval: 'not_needed' | 'self' | 'pending' }>(`/api/notes/${noteId}/corrections`, { method: 'POST', body })
export const approveCorrection = (id: string) => api(`/api/correction-requests/${id}/approve`, { method: 'POST' })
