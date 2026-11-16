import type { CorrectionType, ProcStatus, Surface } from './api'

// Copied from design/odontogram/legend.json (internal legend, not an official Kemenkes/PDGI form). Backend validates the same keys.
export const CONDITIONS = [
  { key: 'sehat', label: 'Sehat', color: '#0B7A45', whole: false },
  { key: 'karies', label: 'Karies', color: '#BE123C', whole: false },
  { key: 'tambalan', label: 'Tambalan', color: '#1E40AF', whole: false },
  { key: 'mahkota', label: 'Mahkota', color: '#6D28D9', whole: true },
  { key: 'hilang', label: 'Hilang', color: '#3F3F46', whole: true },
  { key: 'sisa_akar', label: 'Sisa akar / akar tertinggal', color: '#9A3412', whole: true },
  { key: 'perlu_dicabut', label: 'Perlu dicabut', color: '#A15C00', whole: true },
  { key: 'implan', label: 'Implan', color: '#0F5F63', whole: true },
] as const
export const conditionOf = (key: string) => CONDITIONS.find((c) => c.key === key)
export const AI_BADGE = 'Draf AI, perlu persetujuan dokter'

export const UPPER = [18, 17, 16, 15, 14, 13, 12, 11, 21, 22, 23, 24, 25, 26, 27, 28]
export const LOWER = [48, 47, 46, 45, 44, 43, 42, 41, 31, 32, 33, 34, 35, 36, 37, 38]
export const UPPER_PRIMARY = [55, 54, 53, 52, 51, 61, 62, 63, 64, 65]
export const LOWER_PRIMARY = [85, 84, 83, 82, 81, 71, 72, 73, 74, 75]

export const isAnterior = (t: number) => t % 10 <= 3
/** Upper jaw = FDI quadrants 1, 2, 5, 6. */
export const isUpper = (t: number) => [1, 2, 5, 6].includes(Math.floor(t / 10))
const PERMANENT = ['Insisor sentral', 'Insisor lateral', 'Kaninus', 'Premolar pertama', 'Premolar kedua', 'Molar pertama', 'Molar kedua', 'Molar ketiga']
const PRIMARY = ['Insisor sentral', 'Insisor lateral', 'Kaninus', 'Molar pertama', 'Molar kedua'] // sulung: no premolars
/** Indonesian anatomical name; kanan/kiri = the patient's side (FDI quadrants 1,4,5,8 = right). Unknown FDI -> "Gigi {n}". */
export function toothAnatomicalName(t: number): string {
  const q = Math.floor(t / 10), primary = q >= 5
  const kind = Number.isInteger(t) && q >= 1 && q <= 8 ? (primary ? PRIMARY : PERMANENT)[(t % 10) - 1] : undefined
  if (!kind) return `Gigi ${t}`
  return `${kind}${primary ? ' sulung' : ''} ${[1, 4, 5, 8].includes(q) ? 'kanan' : 'kiri'} ${isUpper(t) ? 'atas' : 'bawah'}`
}
export const surfacesOf = (t: number): Surface[] => ['M', 'D', isAnterior(t) ? 'I' : 'O', 'B', 'L']
/** Stored 'L' is shown as 'P' (palatal) on upper teeth; never sent as 'P'. */
export const surfaceLabel = (t: number, s: Surface) => (s === 'L' && isUpper(t) ? 'P' : s)
export const surfaceName = (t: number, s: Surface) =>
  s === 'L' ? (isUpper(t) ? 'Palatal' : 'Lingual') : s === 'B' ? (isAnterior(t) ? 'Labial' : 'Bukal') : ({ M: 'Mesial', D: 'Distal', O: 'Oklusal', I: 'Insisal' } as const)[s]
export const findingText = (f: { tooth: number; surface: Surface | null; condition: string }) =>
  `Gigi ${f.tooth}${f.surface ? ` ${surfaceLabel(f.tooth, f.surface)} (${surfaceName(f.tooth, f.surface)})` : ''}: ${conditionOf(f.condition)?.label ?? f.condition}`

// Procedure status, separate from condition. `legend` = legend.json "statuses" key used for data-status (design/odontogram/README.md).
// Mirrors App\Modules\Clinical\Domain\ProcedureStatus::TRANSITIONS (server is the authority).
export const STATUSES: { key: ProcStatus; label: string; legend: string; next: ProcStatus[] }[] = [
  { key: 'kondisi_pantau', label: 'Kondisi / pantau', legend: 'kondisi', next: ['direncanakan', 'dirujuk'] },
  { key: 'ada_di_klinik_ini', label: 'Sudah ada (di sini)', legend: 'sudah_ada_sini', next: ['direncanakan'] },
  { key: 'ada_di_tempat_lain', label: 'Sudah ada (tempat lain)', legend: 'sudah_ada_lain', next: ['direncanakan'] },
  { key: 'direncanakan', label: 'Direncanakan', legend: 'direncanakan', next: ['selesai', 'dirujuk', 'kondisi_pantau', 'cancelled'] },
  { key: 'selesai', label: 'Selesai', legend: 'selesai', next: [] },
  { key: 'dirujuk', label: 'Dirujuk', legend: 'dirujuk', next: ['direncanakan'] },
  { key: 'cancelled', label: 'Dibatalkan', legend: 'batal', next: [] },
  { key: 'superseded', label: 'Digantikan', legend: 'digantikan', next: [] }, // written by the server only, never chosen
  { key: 'tidak_dikerjakan', label: 'Tidak dikerjakan', legend: 'batal', next: [] }, // only via a correction, never chosen
]
/** Procedure correction kinds (server ProcedureCorrection::REASON_TYPES). */
export const CORRECTION_LABEL: Record<CorrectionType, string> = { salah_kode: 'Salah kode', salah_situs: 'Salah gigi/permukaan',
  salah_provider: 'Salah dokter pelaksana', tidak_dikerjakan: 'Ternyata tidak dikerjakan' }
/** Statuses a user may choose for a new treatment (server also accepts `external` as an alias of ada_di_tempat_lain). */
export const CHOOSABLE = STATUSES.filter((s) => s.key !== 'superseded' && s.key !== 'tidak_dikerjakan')

// paint_type (clinical catalog) -> legend condition used for colour/glyph until the odontogram has its own paint shapes.
const PAINT_CONDITION: Record<string, string> = { Filling: 'tambalan', Sealant: 'tambalan', Veneer: 'tambalan', Crown: 'mahkota', Bridge: 'mahkota',
  PostBU: 'mahkota', Denture: 'mahkota', Extraction: 'perlu_dicabut', Implant: 'implan', RCT: 'tambalan', RetainedRoot: 'sisa_akar' }
export const paintCondition = (paint: string) => PAINT_CONDITION[paint] ?? 'tambalan'
export const procedureText = (p: { tooth: number | null; surfaces: string | null; name: string | null; procedure_code: string | null }) =>
  `${p.tooth ? `Gigi ${p.tooth}` : 'Mulut'}${p.surfaces ? ' ' + [...p.surfaces].map((s) => surfaceLabel(p.tooth ?? 0, s as Surface)).join('') : ''}: ${p.name ?? 'Tindakan'}${p.procedure_code ? ` (ICD-9-CM ${p.procedure_code})` : ''}`
export const statusOf = (key: string) => STATUSES.find((s) => s.key === key)

/** Same rule as the server (422 external_same_surface): same tooth and (either whole tooth or a shared surface letter). */
export const sameSite = (tooth: number, surfaces: string | null, p: { tooth: number | null; surfaces: string | null }) =>
  p.tooth === tooth && (!surfaces || !p.surfaces || [...surfaces].some((s) => p.surfaces!.includes(s)))
