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
