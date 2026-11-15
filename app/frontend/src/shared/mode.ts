// Work mode is display-only (bottom bar, Beranda, Lainnya order). Permissions stay the union of every role; the server still checks.
// Remembered per device as mode:{tenant}:{user}. Falls back to the older jadwal-mode:{user} key once, then writes the new one.
import { useEffect, useState } from 'react'
import type { Me } from './session'
import { storage } from './storage'

export type WorkMode = 'dokter' | 'depan' | 'pemilik'
export type BarRole = 'dentist' | 'assistant' | 'front_desk' | 'kasir' | 'owner'

const DESK = ['front_desk', 'kasir', 'assistant'] as const
const EVENT = 'work-mode'

export const MODE_LABEL: Record<WorkMode, string> = { dokter: 'Dokter', depan: 'Meja depan', pemilik: 'Pemilik' }
export const MODE_HINT: Record<WorkMode, string> = {
  dokter: 'Pasien saya, RM, odontogram',
  depan: 'Jadwal, check-in, kasir',
  pemilik: 'Laporan, persetujuan, pengaturan',
}

export const modeKey = (tenantId: string, userId: string) => `mode:${tenantId}:${userId}`
const legacyKey = (userId: string) => `jadwal-mode:${userId}`

export function availableModes(roles: string[]): WorkMode[] {
  const out: WorkMode[] = []
  if (roles.includes('dentist')) out.push('dokter')
  // Meja depan: a desk role, or an owner who also practises (owner-only stays on Pemilik, no switch).
  if (roles.some((r) => (DESK as readonly string[]).includes(r)) || (roles.includes('owner') && roles.length > 1)) out.push('depan')
  if (roles.includes('owner')) out.push('pemilik')
  return out
}

export function defaultMode(roles: string[]): WorkMode {
  const modes = availableModes(roles)
  if (roles.includes('dentist') && !roles.some((r) => ['owner', ...DESK].includes(r))) return 'dokter'
  if (modes.includes('depan')) return 'depan'
  return modes[0] ?? 'depan'
}

export function readMode(tenantId: string, userId: string, roles: string[]): WorkMode {
  const modes = availableModes(roles)
  if (modes.length <= 1) return defaultMode(roles)
  const saved = storage.get(modeKey(tenantId, userId)) ?? storage.get(legacyKey(userId))
  return saved && modes.includes(saved as WorkMode) ? saved as WorkMode : defaultMode(roles)
}

export function writeMode(tenantId: string, userId: string, mode: WorkMode) {
  const key = modeKey(tenantId, userId)
  storage.set(key, mode)
  dispatchEvent(new CustomEvent(EVENT, { detail: { key, mode } }))
}

export function useWorkMode(me: Me) {
  const modes = availableModes(me.roles)
  const key = modeKey(me.active.tenant_id, me.user.id)
  const [mode, set] = useState<WorkMode>(() => readMode(me.active.tenant_id, me.user.id, me.roles))
  useEffect(() => {
    const on = (e: Event) => {
      const d = (e as CustomEvent<{ key: string; mode: WorkMode }>).detail
      if (d.key === key) set(d.mode)
    }
    addEventListener(EVENT, on)
    return () => removeEventListener(EVENT, on)
  }, [key])
  const setMode = (m: WorkMode) => {
    if (!modes.includes(m) || m === mode) return
    set(m)
    writeMode(me.active.tenant_id, me.user.id, m)
  }
  return { mode, setMode, modes, multi: modes.length >= 2 }
}

/** Which bottom-bar pattern to show. Mode wins when the account actually has that role. */
export function barRole(roles: string[], mode: WorkMode): BarRole {
  if (mode === 'dokter' && roles.includes('dentist')) return 'dentist'
  if (mode === 'pemilik' && roles.includes('owner')) return 'owner'
  if (mode === 'depan') {
    if (roles.includes('kasir') && !roles.includes('front_desk') && !roles.includes('owner') && !roles.includes('dentist')) return 'kasir'
    if (roles.includes('assistant') && !roles.includes('front_desk') && !roles.includes('owner') && !roles.includes('kasir')) return 'assistant'
    return 'front_desk'
  }
  if (roles.includes('dentist') && roles.length === 1) return 'dentist'
  if (roles.includes('assistant')) return 'assistant'
  if (roles.includes('front_desk')) return 'front_desk'
  if (roles.includes('kasir')) return 'kasir'
  if (roles.includes('owner')) return 'owner'
  if (roles.includes('dentist')) return 'dentist'
  return 'front_desk'
}

/** Bottom-tab paths (Lainnya is rendered separately). Hidden, never locked, when the user lacks the permission. */
export const BAR_TABS: Record<BarRole, string[]> = {
  dentist: ['/', '/jadwal', '/pasien', '/rekam-medis'],
  assistant: ['/', '/antrean', '/pasien', '/rekam-medis'],
  front_desk: ['/', '/jadwal', '/pasien', '/kasir'],
  kasir: ['/kasir', '/antrean', '/pasien'],
  owner: ['/', '/jadwal', '/pasien', '/laporan'],
}

export const homePath = (bar: BarRole) => BAR_TABS[bar][0]

export function tabOrder(roles: string[], mode: WorkMode): string[] {
  return BAR_TABS[barRole(roles, mode)]
}
