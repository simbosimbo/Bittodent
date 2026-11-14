export type CondKey = 'sehat' | 'karies' | 'tambalan' | 'mahkota' | 'hilang' | 'sisa_akar' | 'perlu_dicabut' | 'implan'
export type Surface = 'M' | 'D' | 'O' | 'I' | 'B' | 'L'
export type FindingState = 'draft' | 'signed'

export interface Insurance { insurer: 'Prudential'; policyNo: string; coverPct: number }
export interface Patient {
  id: string; rm: string; name: string; dob: string; sex: 'P' | 'L'
  allergies: string[]; alerts?: string[]; nik: string; phone: string; address: string
  familyId: string; relation: string; insurance?: Insurance
  consentPdp: boolean; consentPdpAt?: string; consentRecallWa: boolean
  social: { pekerjaan: string; pendidikan: string; agama?: string }
  branchId: BranchId
}
export type BranchId = 'menteng' | 'kelapa-gading'
export interface Branch { id: BranchId; name: string; chairs: { id: string; name: string }[] }

export type ApptStatus = 'terjadwal' | 'checkin' | 'merawat' | 'selesai' | 'batal'
export interface Appt {
  id: string; patientId: string; branchId: BranchId
  chairId: string | null; start: number | null; dur: number // menit sejak 00:00, durasi menit
  status: ApptStatus; label: string
  where: 'grid' | 'papan' | 'belum' // belum = daftar belum terjadwal
}
export interface Block { branchId: BranchId; chairId: string | 'all'; start: number; dur: number; label: string }

/** Status tindakan — lapisan terpisah dari kondisi gigi. Kemungkinan MVP. */
export type ProcStatus = 'kondisi' | 'sudah_ada_sini' | 'sudah_ada_lain' | 'direncanakan' | 'selesai' | 'dirujuk'
export interface Proc {
  id: string; patientId: string; date: string; tooth?: number; surfaces: Surface[]
  name: string; fee: number; status: ProcStatus; inPlan: boolean; billed: boolean
}
export interface LedgerRow {
  id: string; patientId: string; date: string
  kind: 'tindakan' | 'pembayaran' | 'klaim'
  desc: string; amount: number; procId?: string
  method?: PayMethod; claimStatus?: 'menunggu' | 'dibayar'; procIds?: string[]
}
export type PayMethod = 'tunai' | 'transfer' | 'kartu' | 'qris'

export interface Mark { cond: CondKey; state: FindingState; ai?: boolean; active?: boolean } // active default true; false = hanya di riwayat
export interface ChartVisit {
  id: string; date: string; label: string; state: FindingState
  signer?: string; signedAt?: string; marks: Record<string, Mark>; supersedes?: string
}
export interface SoapBlock { text: string; ai: boolean; author: string }
export interface SoapVersion {
  v: number; state: FindingState; blocks: Record<'S' | 'O' | 'A' | 'P', SoapBlock>
  signer?: string; signedAt?: string; reason?: string; supersedes?: number
}
