import { Chip } from '@heroui/react'
import { STATUS } from './api'

// Shared by the desktop grid (Schedule.tsx) and the phone agenda (MobileJadwal.tsx).
export const START = 8 * 60, END = 20 * 60, STEP = 30, ROW = 52
export const SLOTS = Array.from({ length: (END - START) / STEP }, (_, i) => START + i * STEP)
export const hhmm = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
export const dotTime = (m: number) => hhmm(m).replace(':', '.') // fmtTime style (id-ID "09.30")

/** YYYY-MM-DD + n days (calendar dates, no time zone). */
export const addDays = (ymd: string, n: number) => {
  const d = new Date(ymd + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

export function minutesOfDay(iso: string, tz: string) {
  const p = new Intl.DateTimeFormat('en-GB', { timeZone: tz, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date(iso))
  return Number(p.find((x) => x.type === 'hour')!.value) * 60 + Number(p.find((x) => x.type === 'minute')!.value)
}

export const StatusChip = ({ status }: { status: string }) => <Chip size="sm" className={`sched-chip chip-${status}`}>{STATUS[status] ?? status}</Chip>
