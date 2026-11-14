import { api, csrfCookie } from '../../shared/api/http'
import type { Me } from '../../shared/session'

export const login = async (email: string, password: string) => {
  await csrfCookie()
  return api<{ two_factor?: boolean } | null>('/login', { method: 'POST', body: { email, password } })
}
export const twoFactorChallenge = (code: string) => api('/two-factor-challenge', { method: 'POST', body: { code } })
export const logout = () => api('/logout', { method: 'POST' })
export const getMe = () => api<Me>('/api/me')
export const switchBranch = (branchId: string) => api('/api/session/branch', { method: 'POST', body: { branch_id: branchId } })

// DEV ONLY: both endpoints 404 unless the server runs APP_ENV=local with DEV_QUICK_LOGIN=true.
export type DevAccount = { email: string; name: string }
export const devStatus = () => api<{ quick_login: boolean; accounts: DevAccount[] }>('/api/dev/status')
export const devQuickLogin = async (email: string) => {
  await csrfCookie()
  return api('/dev/quick-login', { method: 'POST', body: { user_email: email } })
}
