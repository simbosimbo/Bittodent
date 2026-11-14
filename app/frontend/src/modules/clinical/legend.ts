import type { ProcStatus, Surface } from './api'

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
  { key: 'direncanakan', label: 'Direncanakan', legend: 'direncanakan', next: ['selesai', 'dirujuk', 'kondisi_pantau'] },
  { key: 'selesai', label: 'Selesai', legend: 'selesai', next: [] },
  { key: 'dirujuk', label: 'Dirujuk', legend: 'dirujuk', next: ['direncanakan'] },
]
export const statusOf = (key: string) => STATUSES.find((s) => s.key === key)
export const PRESENCE = [['ada', 'Ada'], ['hilang', 'Tidak ada (baseline)'], ['belum_tumbuh', 'Belum tumbuh']] as const
