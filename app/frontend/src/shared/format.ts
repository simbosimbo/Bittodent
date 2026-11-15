export const TZ = 'Asia/Jakarta'
export const todayWib = () => new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(new Date())
export const fmtTime = (iso: string, tz = TZ) =>
  new Intl.DateTimeFormat('id-ID', { timeZone: tz, hour: '2-digit', minute: '2-digit' }).format(new Date(iso))
export const fmtDate = (ymd: string) =>
  new Intl.DateTimeFormat('id-ID', { timeZone: 'UTC', weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(
    new Date(ymd + 'T00:00:00Z'),
  )
export const fmtDateTime = (iso: string, tz = TZ) =>
  new Intl.DateTimeFormat('id-ID', { timeZone: tz, day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(iso))
// First letters of the first two words, skipping titles like "drg." ("Sari Sintetis" -> "SS").
export const initials = (name: string) => name.split(/[\s,]+/).filter((w) => w && !w.includes('.')).slice(0, 2).map((w) => w[0]).join('').toUpperCase()
export const fmtDay = (iso: string, tz = TZ) =>
  new Intl.DateTimeFormat('id-ID', { timeZone: tz, day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(iso))
/** id-ID number ("1.250.000", "0,5"); -0 and NaN read as 0 (a negated zero sum must not print "-0"). */
export const num = (n: number) => (n || 0).toLocaleString('id-ID')
/** Rupiah: "Rp1.250.000", never "-Rp0". */
export const rp = (n: number) => 'Rp' + num(n)
/** "15 Nov 2026" from a YYYY-MM-DD date value. */
export const fmtYmdShort = (ymd: string) =>
  new Intl.DateTimeFormat('id-ID', { timeZone: 'UTC', day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(ymd + 'T00:00:00Z'))
