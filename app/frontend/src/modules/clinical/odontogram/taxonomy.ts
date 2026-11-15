// Odontogram v2 types over the ONE data table (taxonomy.json, generated from the backend copy by `npm run taxonomy`).
// Components read conditions, statuses, surfaces and span roles from here; nothing clinical is hardcoded in a component.
// HOLD (10:58 brief): condition list, icons and status colours wait for the revised designer board; the table holds the
// current legend keys as placeholders. Codes are the official Kemenkes/PDGI 2015 lowercase codes; no ICD mapping here.
import data from './taxonomy.json'
import { isAnterior, isUpper } from '../legend'
import type { ProcStatus, Surface } from '../api'

/** Official surface letters (MODVL + I for anterior). V is stored as legacy 'B' so existing rows stay valid. */
export type SurfaceKey = 'M' | 'O' | 'I' | 'D' | 'V' | 'L'
export type EntryStatus = 'ada_sebelumnya' | 'klinik_lain' | 'rencana' | 'selesai'
/** Where a condition is entered: per surface, whole tooth, a span of teeth (bridge) or an implant. */
export type ConditionGroup = 'surface' | 'tooth' | 'span' | 'implant'
export type SpanRole = 'abutment' | 'pontic'
/** Bridge material code (meb/pob, PDGI 2015). */
export type Material = 'meb' | 'pob'
/** perawatan = tooth first (board 09); periksa = palette first, for the initial exam (condition, then tap many teeth). */
export type Mode = 'perawatan' | 'periksa'
export type Dentition = 'permanent' | 'primary'
export type Condition = { key: string; label: string; code: string | null; group: ConditionGroup; official: boolean }

export type Taxonomy = {
  version: number
  surfaces: { key: SurfaceKey; label: string; stored: Surface; teeth?: 'anterior' | 'posterior' }[]
  statuses: { key: EntryStatus; label: string; procedure_status: ProcStatus }[]
  groups: { key: ConditionGroup; label: string; area: 'surface' | 'tooth' | 'range' }[]
  span_roles: { key: SpanRole; code: string; label: string }[]
  span_materials: { key: Material; label: string }[]
  dentitions: Record<Dentition, number[]>
  modes: { key: Mode; label: string; flow: 'tooth_first' | 'palette' }[]
  conditions: Condition[]
}
export const TAXONOMY = data as unknown as Taxonomy

/** A bridge: one range row; end teeth default to abutment, the rest to pontic. */
export type Span = { from: number; to: number; roles: Record<number, SpanRole>; material: Material | null }
/** What one Simpan sends (POST /visits/{id}/tooth-entries). */
export type ToothEntry = {
  tooth: number; condition: string; status: EntryStatus; surfaces?: SurfaceKey[]; procedure_code?: string | null
  span_to?: number; span_roles?: Record<number, SpanRole>; material?: Material | null
  external_clinic_name?: string; external_date?: string
}

export const conditionsIn = (g: ConditionGroup) => TAXONOMY.conditions.filter((c) => c.group === g)
export const conditionByKey = (k: string) => TAXONOMY.conditions.find((c) => c.key === k)
/** The five pads for a tooth, in board order: M, O or I, D, V, L. */
export const padsFor = (t: number) => TAXONOMY.surfaces.filter((s) => !s.teeth || (s.teeth === 'anterior') === isAnterior(t))
export const storedSurface = (k: SurfaceKey): Surface => TAXONOMY.surfaces.find((s) => s.key === k)!.stored
/** V reads as 'V'; L on upper teeth reads as 'P' (palatal), as on the old sheet. */
export const padLabel = (t: number, k: SurfaceKey) => (k === 'L' && isUpper(t) ? 'P' : k)

const ARCH_ROWS = [
  [18, 17, 16, 15, 14, 13, 12, 11, 21, 22, 23, 24, 25, 26, 27, 28], [55, 54, 53, 52, 51, 61, 62, 63, 64, 65],
  [85, 84, 83, 82, 81, 71, 72, 73, 74, 75], [48, 47, 46, 45, 44, 43, 42, 41, 31, 32, 33, 34, 35, 36, 37, 38],
]
/** Teeth from a to b along the arch as drawn (same row only); [] when they are not in one row. */
export function spanTeeth(a: number, b: number): number[] {
  const row = ARCH_ROWS.find((r) => r.includes(a) && r.includes(b))
  if (!row || a === b) return []
  const [i, j] = [row.indexOf(a), row.indexOf(b)].sort((x, y) => x - y)
  return row.slice(i, j + 1)
}
/** Possible span ends for a tooth: the rest of its drawn row. */
export const spanEnds = (t: number) => ARCH_ROWS.find((r) => r.includes(t))?.filter((x) => x !== t) ?? []
export const defaultRoles = (teeth: number[]): Record<number, SpanRole> =>
  Object.fromEntries(teeth.map((t, i) => [t, i === 0 || i === teeth.length - 1 ? 'abutment' : 'pontic']))
