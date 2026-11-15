// Dokter mode helpers (#70): one-tap procedures (per dentist, most used first), SOAP templates, preset reasons. Synthetic defaults,
// clinic templates — not a national standard; the dentist still decides. Favourites live in this browser (per user id); the server
// stays authoritative for every code (validation, SignCheck, billing).
import type { Soap } from './api'

export type QuickProc = { code: string; dx: string; label: string }
/** Defaults with a clinic tariff (23.2 is billed) and a diagnosis, so Selesai never stops on "tanpa diagnosis". */
export const DEFAULT_QUICK: QuickProc[] = [{ code: '23.2', dx: 'K02.1', label: 'Tambal' }]
type Stat = QuickProc & { n: number; t: number }
const key = (uid: string) => `bt.quick-proc.${uid}`
const read = (uid: string): Stat[] => {
  try { const v = JSON.parse(localStorage.getItem(key(uid)) ?? '[]'); return Array.isArray(v) ? v : [] } catch { return [] }
}
/** This dentist's most used procedure+diagnosis pairs first, then the defaults; at most `limit`. */
export function quickProcs(uid: string, limit = 4): QuickProc[] {
  const mine = read(uid).sort((a, b) => b.n - a.n || b.t - a.t).map(({ code, dx, label }) => ({ code, dx, label }))
  const all = [...mine, ...DEFAULT_QUICK]
  return all.filter((q, i) => all.findIndex((x) => x.code === q.code && x.dx === q.dx) === i).slice(0, limit)
}
export function rememberProc(uid: string, q: QuickProc) {
  const all = read(uid)
  const hit = all.find((x) => x.code === q.code && x.dx === q.dx)
  if (hit) { hit.n++; hit.t = Date.now(); hit.label = q.label } else all.push({ ...q, n: 1, t: Date.now() })
  try { localStorage.setItem(key(uid), JSON.stringify(all.sort((a, b) => b.n - a.n).slice(0, 20))) } catch { /* private mode: no favourites */ }
}

const soap = (S: string, O: string, a: [string[], string], p: [string[], string]): Soap => ({ S, O, A: { codes: a[0], text: a[1] }, P: { codes: p[0], text: p[1] } })
/** One tap fills the EMPTY fields only (never overwrites what the dentist typed). */
export const SOAP_TEMPLATES: { key: string; label: string; soap: Soap }[] = [
  { key: 'tambal', label: 'Tambal', soap: soap('Gigi berlubang, ngilu saat makan/minum dingin.', 'Karies dentin, tes dingin (+), perkusi (-).', [['K02.1'], 'Karies dentin'], [['23.2'], 'Tumpatan komposit.']) },
  { key: 'kontrol', label: 'Kontrol', soap: soap('Kontrol, tidak ada keluhan.', 'Tumpatan baik, gingiva normal.', [['Z01.2'], 'Pemeriksaan gigi'], [[], 'Kontrol 6 bulan lagi.']) },
  { key: 'scaling', label: 'Scaling', soap: soap('Karang gigi, gusi mudah berdarah.', 'Kalkulus supragingiva RA/RB.', [['K03.6'], 'Deposit pada gigi'], [['96.54'], 'Scaling RA/RB.']) },
]
export function fillEmpty(cur: Soap, t: Soap): Soap {
  return { S: cur.S.trim() ? cur.S : t.S, O: cur.O.trim() ? cur.O : t.O,
    A: cur.A.codes.length || cur.A.text.trim() ? cur.A : t.A, P: cur.P.codes.length || cur.P.text.trim() ? cur.P : t.P }
}
/** Selesai with SignCheck warnings needs a reason (server: 10+ letters); a chip instead of typing. */
export const WARNING_REASONS = ['Diagnosis tercatat di Asesmen SOAP.', 'Diagnosis menyusul setelah pemeriksaan penunjang.']
