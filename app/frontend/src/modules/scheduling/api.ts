import { api } from '../../shared/api/http'

export type Appointment = {
  id: string
  chair_id: string
  starts_at: string
  ends_at: string
  status: string
  source: 'staff' | 'online'
  booking_code: string | null
  reason: string | null
  patient: { id: string; name: string } | null
  dentist: { id: string; name: string } | null
  visit_id?: string | null // only for billing.read users: the visit behind "Bayar" (#/tagihan/<visit_id>)
}

export type Schedule = {
  branch: { id: string; name: string; timezone: string }
  date: string
  chairs: { id: string; label: string; appointments: Appointment[] }[]
  walk_in_patients?: number // patients with a visit without appointment that day and no active appointment (count only)
  dentists: { id: string; name: string }[]
}

export const STATUS: Record<string, string> = {
  pending_confirmation: 'Menunggu konfirmasi',
  rejected: 'Ditolak',
  booked: 'Terjadwal',
  checked_in: 'Sudah datang',
  in_treatment: 'Dalam perawatan',
  done: 'Selesai',
  cancelled: 'Batal',
  no_show: 'Tidak datang',
}

export const getSchedule = (branchId: string, date: string) => api<Schedule>(`/api/schedule?branch_id=${branchId}&date=${date}`)
/** complaint: only with to=checked_in (the desk asks the keluhan at arrival; stored encrypted, carried into the medical record) */
export const transition = (id: string, to: string, complaint?: string) =>
  api(`/api/appointments/${id}/transition`, { method: 'POST', body: complaint ? { to, complaint } : { to } })
/** Toast "Batalkan" after a check-in (board 08): checked_in -> booked, only shortly after the check-in; audited server-side. */
export const undoCheckin = (id: string) => api(`/api/appointments/${id}/undo-checkin`, { method: 'POST' })
// Staff move of a booked appointment (same chair/dentist double-booking guard as create; needs appointment.create).
export const reschedule = (id: string, body: { starts_at: string; ends_at: string; chair_id: string }) =>
  api(`/api/appointments/${id}/reschedule`, { method: 'POST', body })
export const createAppointment = (body: { patient_id: string; chair_id: string; dentist_id: string; starts_at: string; ends_at: string; reason: string | null }) =>
  api('/api/appointments', { method: 'POST', body })

// Planned appointments (built at the chair, scheduled by the front desk). Converting is idempotent server-side.
export type Planned = { id: string; patient_id: string; patient_name: string | null; dentist_name: string | null; procedure: string
  procedure_code: string | null; note: string | null; est_minutes: number; priority: 'normal' | 'segera'; created_at: string }
export const getPlanned = (branchId: string) => api<{ data: Planned[] }>(`/api/planned-appointments?branch_id=${branchId}`)
export const schedulePlanned = (id: string, body: { chair_id: string; starts_at: string }) =>
  api<{ appointment_id: string }>(`/api/planned-appointments/${id}/schedule`, { method: 'POST', body })
// Ganti kursi: same time and dentist; chair double-booking checked (needs appointment.transition).
export const changeChair = (id: string, chair_id: string) => api(`/api/appointments/${id}/chair`, { method: 'POST', body: { chair_id } })
// Rujuk: the only way to change an appointment's dentist; reason required (appointment.refer; a dentist only their own).
export const refer = (id: string, body: { dentist_id: string; reason: string }) => api(`/api/appointments/${id}/refer`, { method: 'POST', body })
