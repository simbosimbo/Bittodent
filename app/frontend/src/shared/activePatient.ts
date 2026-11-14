import { useSyncExternalStore } from 'react'

// "Pasien aktif" for the top-bar pill. Memory only (never localStorage/sessionStorage); cleared on logout/reload.
export type ActivePatient = { id: string; name: string } | null
let current: ActivePatient = null
const subs = new Set<() => void>()

export function setActivePatient(p: ActivePatient) {
  current = p
  subs.forEach((f) => f())
}

export const useActivePatient = () =>
  useSyncExternalStore((f) => (subs.add(f), () => subs.delete(f)), () => current)
