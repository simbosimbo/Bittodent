import type { CondKey, ProcStatus } from './types'
import official from '../../../odontogram/legend.json'

// Sumber: /workspace/ehr-dental/design/odontogram/legend.json (folder itu tidak diubah dari prototipe).
// Legenda INTERNAL Bitto. Bukan standar resmi Kemenkes/PDGI/SATUSEHAT.

export interface LegendItem { key: CondKey; label: string; color: string; scope: 'surface' | 'tooth'; glyph: string; desc: string }

const SCOPE: Record<string, 'surface' | 'tooth'> = { surface: 'surface', 'whole-tooth': 'tooth' }
const DESC: Record<string, string> = {
  check: 'Centang hijau',
  dots: 'Isi solid + titik',
  solid: 'Isi solid polos',
  ring: 'Cincin di sekeliling gigi',
  x: 'Huruf X besar',
  'root-v': 'Garis servikal + V akar',
  slash: 'Garis miring + panah',
  screw: 'Glif sekrup',
}

export const LEGEND: LegendItem[] = official.conditions.map((c) => ({
  key: c.key as CondKey,
  label: c.label,
  color: c.color,
  scope: SCOPE[c['applies-to']] ?? 'surface',
  glyph: c.mark,
  desc: DESC[c.mark] ?? c.mark,
}))

export const legendOf = (k: CondKey) => LEGEND.find((l) => l.key === k)!

export interface ProcStatusItem {
  key: ProcStatus
  label: string
  color: string
  marker: string
  note?: string
}

export const PROC_STATUSES: ProcStatusItem[] = official.statuses.items.map((s) => ({
  key: s.key as ProcStatus,
  label: s.label,
  color: s.color,
  marker: s.marker,
}))

export const procStatusOf = (k: ProcStatus) => PROC_STATUSES.find((s) => s.key === k)!

export const LEGEND_TITLE = official.title
export const LEGEND_DISCLAIMER = official.disclaimer
export const STATUS_MVP_NOTE = 'Kemungkinan MVP, menunggu persetujuan Jerome. Status tindakan terpisah dari warna dan bentuk kondisi gigi.'
