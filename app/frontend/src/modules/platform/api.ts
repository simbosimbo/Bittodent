import { api, csrfCookie } from '../../shared/api/http'

// Platform superadmin (DEVIATIONS #61): separate login (email + password + TOTP), clinic list, impersonate a clinic admin.
export type PlatformMe = { id: string; name: string; email: string; permissions: string[]
  impersonation: { active: false } | { active: true; tenant_id: string; user_id: string; started_at: string } }
export type PlatformTenant = { id: string; name: string; admins: { id: string; name: string }[] }

export const platformLogin = async (email: string, password: string, code: string) => {
  await csrfCookie()
  return api<PlatformMe>('/api/platform/login', { method: 'POST', body: { email, password, code } })
}
export const platformMe = () => api<PlatformMe>('/api/platform/me')
export const platformLogout = () => api('/api/platform/logout', { method: 'POST' })
export const platformTenants = () => api<{ tenants: PlatformTenant[] }>('/api/platform/tenants')
export const impersonate = (tenantId: string, userId: string) =>
  api('/api/platform/impersonate', { method: 'POST', body: { tenant_id: tenantId, user_id: userId } })
export const stopImpersonation = () => api<PlatformMe>('/api/platform/impersonate/stop', { method: 'POST' })
