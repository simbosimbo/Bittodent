import { useSyncExternalStore } from 'react'

// "Pasien aktif" for the top-bar pill + "Terakhir dibuka" list for its picker.
// Memory only (never localStorage/sessionStorage); cleared on logout/reload.
export type ActivePatient = { id: string; name: string } | null
let current: ActivePatient = null
let recent: { id: string; name: string }[] = []
const subs = new Set<() => void>()
const notify = () => subs.forEach((f) => f())
const subscribe = (f: () => void) => (subs.add(f), () => { subs.delete(f) })

/** null closes the active patient but keeps the recent list (× on the pill). */
export function setActivePatient(p: ActivePatient) {
  current = p
  if (p) recent = [p, ...recent.filter((r) => r.id !== p.id)].slice(0, 6)
  notify()
}

/** Logout / session end: forget the active patient and the recent list. */
export function clearActivePatients() {
  current = null
  recent = []
  notify()
}

export const useActivePatient = () => useSyncExternalStore(subscribe, () => current)
export const useRecentPatients = () => useSyncExternalStore(subscribe, () => recent)
