// Public booking (no login): /api/public/booking/{slug}/... Nothing is stored client-side; the manage token lives only in the URL.
import { api } from '../../shared/api/http'

export type Info = {
  clinic: { name: string; online_booking_enabled: boolean }
  branches: { id: string; name: string; timezone: string }[]
  dentists: { id: string; name: string }[]
  services: { id: string; name: string; duration_minutes: number }[]
}
export type Slot = { starts_at: string; ends_at: string; time: string; branch_id: string }
export type Challenge = { challenge_id: string; phone_masked: string; expires_in: number; resend_in: number }
export type Booked = { code: string; manage_token: string; status: string; starts_at: string; ends_at: string }
export type Manage = {
  clinic: { name: string }
  code: string
  status: string
  starts_at: string
  ends_at: string
  branch: { id: string; name: string; timezone: string }
  dentist: { id: string; name: string } | null
  service: { id: string; name: string; duration_minutes: number } | null
  can_change: boolean
}

const base = (slug: string) => `/api/public/booking/${encodeURIComponent(slug)}`
const q = (o: Record<string, string>) => new URLSearchParams(o).toString()

export const getInfo = (slug: string) => api<Info>(base(slug))
export const getSlots = (slug: string, dentist_id: string, service_id: string, date: string) =>
  api<{ date: string; slots: Slot[] }>(`${base(slug)}/slots?${q({ dentist_id, service_id, date })}`)
export const startBooking = (slug: string, body: { dentist_id: string; service_id: string; starts_at: string; name: string; phone: string; complaint: string }) =>
  api<Challenge>(`${base(slug)}/start`, { method: 'POST', body })
export const resendOtp = (slug: string, challenge_id: string) =>
  api<{ expires_in: number; resend_in: number }>(`${base(slug)}/resend`, { method: 'POST', body: { challenge_id } })
export const verifyOtp = (slug: string, challenge_id: string, code: string) =>
  api<Booked>(`${base(slug)}/verify`, { method: 'POST', body: { challenge_id, code } })
const manage = (slug: string, token: string) => `${base(slug)}/manage/${encodeURIComponent(token)}`
export const getBooking = (slug: string, token: string) => api<Manage>(manage(slug, token))
export const cancelBooking = (slug: string, token: string) => api<Manage>(`${manage(slug, token)}/cancel`, { method: 'POST' })
export const rescheduleBooking = (slug: string, token: string, starts_at: string) =>
  api<Manage>(`${manage(slug, token)}/reschedule`, { method: 'POST', body: { starts_at } })
