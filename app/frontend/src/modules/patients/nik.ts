// Mirrors backend Ktp\Domain\NikParser (the server re-checks on PUT /api/patients/{id}/ktp). No I/O, no logging.
export type NikData = { province: string; regency: string; district: string; dob: string; sex: 'laki_laki' | 'perempuan' }
export type KtpField = 'dob' | 'sex' | 'province' | 'regency' | 'district'

const valid = (y: number, m: number, d: number) => {
  const t = new Date(Date.UTC(y, m - 1, d))
  return t.getUTCFullYear() === y && t.getUTCMonth() === m - 1 && t.getUTCDate() === d
}
const iso = (y: number, m: number, d: number) => `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`

export function parseNik(nik: string): NikData | null {
  const n = nik.replace(/\D/g, '')
  if (n.length !== 16) return null
  const raw = +n.slice(6, 8), m = +n.slice(8, 10), yy = +n.slice(10, 12)
  const sex = raw > 40 ? 'perempuan' : 'laki_laki'
  const d = raw > 40 ? raw - 40 : raw
  const today = new Date().toISOString().slice(0, 10)
  // Prefer 20xx; if that date is in the future, use 19xx.
  const y = valid(2000 + yy, m, d) && iso(2000 + yy, m, d) <= today ? 2000 + yy : valid(1900 + yy, m, d) ? 1900 + yy : valid(2000 + yy, m, d) ? 2000 + yy : null
  if (y === null) return null
  return { province: n.slice(0, 2), regency: n.slice(2, 4), district: n.slice(4, 6), dob: iso(y, m, d), sex }
}

/** Keys of filled fields that disagree with the NIK. */
export function nikMismatches(nik: string, f: { dob?: string; sex?: string; province?: string; regency?: string; district?: string }): KtpField[] {
  const p = parseNik(nik)
  if (!p) return []
  const pad = (v: string) => v.replace(/\D/g, '').padStart(2, '0')
  const out: KtpField[] = []
  if (f.dob && f.dob !== p.dob) out.push('dob')
  if (f.sex && f.sex !== p.sex) out.push('sex')
  for (const k of ['province', 'regency', 'district'] as const) if (f[k] && pad(f[k]!) !== p[k]) out.push(k)
  return out
}
