import { api } from '../../shared/api/http'

export type Appointment = {
  id: string
  chair_id: string
  starts_at: string
  ends_at: string
  status: string
  reason: string | null
  patient: { id: string; name: string } | null
  dentist: { id: string; name: string } | null
}

export type Schedule = {
  branch: { id: string; name: string; timezone: string }
  date: string
  chairs: { id: string; label: string; appointments: Appointment[] }[]
  walk_in_patients?: number // patients with a visit without appointment that day and no active appointment (count only)
  dentists: { id: string; name: string }[]
}

export const STATUS: Record<string, string> = {
  booked: 'Terjadwal',
  checked_in: 'Sudah datang',
  in_treatment: 'Dalam perawatan',
  done: 'Selesai',
  cancelled: 'Batal',
  no_show: 'Tidak datang',
}

export const getSchedule = (branchId: string, date: string) => api<Schedule>(`/api/schedule?branch_id=${branchId}&date=${date}`)
export const transition = (id: string, to: string) => api(`/api/appointments/${id}/transition`, { method: 'POST', body: { to } })
export const createAppointment = (body: { patient_id: string; chair_id: string; dentist_id: string; starts_at: string; ends_at: string; reason: string | null }) =>
  api('/api/appointments', { method: 'POST', body })

// Planned appointments (built at the chair, scheduled by the front desk). Converting is idempotent server-side.
export type Planned = { id: string; patient_id: string; patient_name: string | null; dentist_name: string | null; procedure: string
  procedure_code: string | null; note: string | null; est_minutes: number; priority: 'normal' | 'segera'; created_at: string }
export const getPlanned = (branchId: string) => api<{ data: Planned[] }>(`/api/planned-appointments?branch_id=${branchId}`)
export const schedulePlanned = (id: string, body: { chair_id: string; starts_at: string }) =>
  api<{ appointment_id: string }>(`/api/planned-appointments/${id}/schedule`, { method: 'POST', body })
