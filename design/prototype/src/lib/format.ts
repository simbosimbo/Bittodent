import { TODAY } from '../data/mock'

export const rupiah = (n: number) => 'Rp ' + Math.round(n).toLocaleString('id-ID')
export const ageOf = (dob: string) => {
  const [y, m, d] = dob.split('-').map(Number)
  const [ty, tm, td] = TODAY.split('-').map(Number)
  return ty - y - (tm < m || (tm === m && td < d) ? 1 : 0)
}
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des']
export const dateLabel = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number)
  return `${d} ${MONTHS[m - 1]} ${y}`
}
export const hhmm = (min: number) => `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`
// Jam nyata, tanggal tetap "hari ini" prototipe.
export const nowLabel = () => { const d = new Date(); return `14 Nov 2026, ${hhmm(d.getHours() * 60 + d.getMinutes())} WIB` }
export const maskPhone = (p: string) => p.slice(0, 4) + '••••' + p.slice(-4)
export const maskNik = (n: string) => '•••• •••• •••• ' + n.replace(/\s/g, '').slice(-4)
let seq = 1000
export const uid = (p: string) => `${p}${++seq}`
