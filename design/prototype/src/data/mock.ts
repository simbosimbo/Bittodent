// DATA PALSU / SINTETIS. Tidak ada data pasien asli.
import type { Appt, Block, Branch, ChartVisit, LedgerRow, Patient, Proc, SoapVersion } from './types'

export const TODAY = '2026-11-14'
export const TODAY_LABEL = 'Sabtu, 14 November 2026'
export const CLINIC = 'Bitto Dental'
export const STAFF = { dokter: 'drg. Budi Santoso', resepsionis: 'Ayu Lestari' }
export const CURRENT_USER = { name: 'drg. Budi Santoso', role: 'Dokter gigi' }

export const BRANCHES: Branch[] = [
  { id: 'menteng', name: 'Bitto Dental Menteng', chairs: [{ id: 'k1', name: 'Kursi 1' }, { id: 'k2', name: 'Kursi 2' }, { id: 'k3', name: 'Kursi 3' }] },
  { id: 'kelapa-gading', name: 'Bitto Dental Kelapa Gading', chairs: [{ id: 'kg1', name: 'Kursi 1' }, { id: 'kg2', name: 'Kursi 2' }] },
]

const pru = (n: string) => ({ insurer: 'Prudential' as const, policyNo: `PRU-CONTOH-${n}`, coverPct: 70 })
const base = { consentPdp: true, consentPdpAt: '2026-05-09', consentRecallWa: true, branchId: 'menteng' as const }
export const PATIENTS: Patient[] = [
  { ...base, id: 'p123', rm: 'RM-000123', name: 'Siti Rahmawati', dob: '1988-03-12', sex: 'P', allergies: ['Penisilin'], alerts: ['Perlu premedikasi'], nik: '0000 0000 0000 0001', phone: '081200006789', address: 'Jl. Contoh Melati No. 1, Menteng, Jakarta Pusat', familyId: 'f-siti', relation: 'Kepala keluarga', insurance: pru('001'), social: { pekerjaan: 'Guru', pendidikan: 'S1', agama: 'Islam' } },
  { ...base, id: 'p117', rm: 'RM-000117', name: 'Hendra Wijaya', dob: '1986-07-02', sex: 'L', allergies: [], nik: '0000 0000 0000 0002', phone: '081300001122', address: 'Jl. Contoh Melati No. 1, Menteng, Jakarta Pusat', familyId: 'f-siti', relation: 'Suami', insurance: pru('002'), social: { pekerjaan: 'Wiraswasta', pendidikan: 'S1' } },
  { ...base, id: 'p118', rm: 'RM-000118', name: 'Nadia Putri', dob: '2017-09-20', sex: 'P', allergies: [], nik: '0000 0000 0000 0003', phone: '081200006789', address: 'Jl. Contoh Melati No. 1, Menteng, Jakarta Pusat', familyId: 'f-siti', relation: 'Anak', consentRecallWa: false, social: { pekerjaan: 'Pelajar', pendidikan: 'SD' } },
  { ...base, id: 'p089', rm: 'RM-000089', name: 'Ahmad Fauzi', dob: '1979-08-21', sex: 'L', allergies: [], nik: '0000 0000 0000 0004', phone: '081500004321', address: 'Jl. Contoh Kenanga No. 8, Jakarta Pusat', familyId: 'f-ahmad', relation: 'Kepala keluarga', social: { pekerjaan: 'Karyawan swasta', pendidikan: 'SMA' } },
  { ...base, id: 'p156', rm: 'RM-000156', name: 'Dewi Kusuma', dob: '1995-01-30', sex: 'P', allergies: ['Lateks'], nik: '0000 0000 0000 0005', phone: '081700005555', address: 'Jl. Contoh Anggrek No. 3, Jakarta Timur', familyId: 'f-dewi', relation: 'Kepala keluarga', consentRecallWa: false, social: { pekerjaan: 'Desainer', pendidikan: 'S1' } },
  { ...base, id: 'p201', rm: 'RM-000201', name: 'Rina Marlina', dob: '1990-11-05', sex: 'P', allergies: [], nik: '0000 0000 0000 0006', phone: '081900002020', address: 'Jl. Contoh Mawar No. 5, Jakarta Selatan', familyId: 'f-rina', relation: 'Kepala keluarga', social: { pekerjaan: 'Perawat', pendidikan: 'D3' } },
  { ...base, id: 'p202', rm: 'RM-000202', name: 'Yusuf Pratama', dob: '2001-04-14', sex: 'L', allergies: [], nik: '0000 0000 0000 0007', phone: '082100003030', address: 'Jl. Contoh Dahlia No. 9, Jakarta Utara', familyId: 'f-yusuf', relation: 'Kepala keluarga', social: { pekerjaan: 'Mahasiswa', pendidikan: 'SMA' } },
  { ...base, id: 'p203', rm: 'RM-000203', name: 'Bambang Sutrisno', dob: '1965-12-01', sex: 'L', allergies: ['Ibuprofen'], alerts: ['Sedang mengonsumsi pengencer darah'], nik: '0000 0000 0000 0008', phone: '081100004040', address: 'Jl. Contoh Kamboja No. 2, Jakarta Pusat', familyId: 'f-bambang', relation: 'Kepala keluarga', social: { pekerjaan: 'Pensiunan', pendidikan: 'S1' } },
]
export const NEXT_RM = 'RM-000124'

const h = (hh: number, mm = 0) => hh * 60 + mm
export const DAY_START = h(8)
export const DAY_END = h(17)
export const SLOT = 30

export const APPTS: Appt[] = [
  { id: 'a1', patientId: 'p089', branchId: 'menteng', chairId: 'k2', start: h(8), dur: 60, status: 'selesai', label: 'Scaling', where: 'grid' },
  { id: 'a2', patientId: 'p123', branchId: 'menteng', chairId: 'k1', start: h(9), dur: 60, status: 'checkin', label: 'Pemeriksaan + keluhan ngilu', where: 'grid' },
  { id: 'a3', patientId: 'p156', branchId: 'menteng', chairId: 'k2', start: h(10), dur: 90, status: 'merawat', label: 'Perawatan saluran akar', where: 'grid' },
  { id: 'a4', patientId: 'p203', branchId: 'menteng', chairId: 'k1', start: h(11), dur: 30, status: 'batal', label: 'Kontrol', where: 'grid' },
  { id: 'a5', patientId: 'p117', branchId: 'menteng', chairId: 'k1', start: h(13, 30), dur: 30, status: 'terjadwal', label: 'Kontrol tambalan', where: 'grid' },
  { id: 'a6', patientId: 'p201', branchId: 'menteng', chairId: 'k3', start: h(14), dur: 60, status: 'terjadwal', label: 'Lanjutan perawatan saluran akar', where: 'grid' },
  { id: 'a7', patientId: 'p202', branchId: 'menteng', chairId: 'k2', start: h(15, 30), dur: 60, status: 'terjadwal', label: 'Konsultasi kawat gigi', where: 'grid' },
  { id: 'a8', patientId: 'p118', branchId: 'menteng', chairId: null, start: null, dur: 30, status: 'terjadwal', label: 'Kontrol gigi susu', where: 'papan' },
  { id: 'a9', patientId: 'p089', branchId: 'menteng', chairId: null, start: null, dur: 30, status: 'terjadwal', label: 'Kontrol 6 bulan', where: 'belum' },
  { id: 'a10', patientId: 'p203', branchId: 'menteng', chairId: null, start: null, dur: 30, status: 'terjadwal', label: 'Jadwal ulang kontrol (batal pagi ini)', where: 'belum' },
  { id: 'a11', patientId: 'p202', branchId: 'kelapa-gading', chairId: 'kg1', start: h(10), dur: 60, status: 'terjadwal', label: 'Scaling', where: 'grid' },
]
export const BLOCKS: Block[] = [
  { branchId: 'menteng', chairId: 'all', start: h(12), dur: 60, label: 'Istirahat' },
  { branchId: 'menteng', chairId: 'k3', start: h(8), dur: 90, label: 'Sterilisasi & persiapan alat' },
  { branchId: 'kelapa-gading', chairId: 'all', start: h(12), dur: 60, label: 'Istirahat' },
]

// Katalog tindakan (tarif contoh). Nama saja, tanpa kode resmi (kode ICD-9-CM dipilih nanti, perlu dicek).
export interface Catalog { id: string; name: string; fee: number; cond?: 'tambalan' | 'perlu_dicabut' | 'mahkota' | 'implan'; perSurface?: boolean }
export const CATALOG: Catalog[] = [
  { id: 'tambal', name: 'Tambalan komposit', fee: 450000, cond: 'tambalan', perSurface: true },
  { id: 'cabut', name: 'Pencabutan gigi', fee: 500000, cond: 'perlu_dicabut' },
  { id: 'psa', name: 'Perawatan saluran akar', fee: 1800000 },
  { id: 'mahkota', name: 'Mahkota porselen', fee: 3500000, cond: 'mahkota' },
  { id: 'sealant', name: 'Fissure sealant', fee: 250000, perSurface: true },
  { id: 'implan', name: 'Implan gigi', fee: 12000000, cond: 'implan' },
  { id: 'scaling', name: 'Scaling seluruh rahang', fee: 350000 },
  { id: 'rontgen', name: 'Foto rontgen periapikal', fee: 120000 },
]

export const PROCS: Proc[] = [
  { id: 'pr1', patientId: 'p123', date: '2026-05-09', surfaces: [], name: 'Scaling seluruh rahang', fee: 350000, status: 'selesai', inPlan: true, billed: true },
  { id: 'pr2', patientId: 'p123', date: '2026-05-09', tooth: 36, surfaces: ['O'], name: 'Tambalan komposit', fee: 450000, status: 'selesai', inPlan: true, billed: true },
  { id: 'pr3', patientId: 'p123', date: '2026-05-09', tooth: 16, surfaces: ['O'], name: 'Tambalan lama (dari luar klinik)', fee: 0, status: 'sudah_ada_lain', inPlan: false, billed: false },
  { id: 'pr3b', patientId: 'p123', date: '2026-05-09', tooth: 46, surfaces: ['O'], name: 'Karies (kondisi)', fee: 0, status: 'kondisi', inPlan: false, billed: false },
  { id: 'pr3c', patientId: 'p123', date: '2026-02-10', tooth: 26, surfaces: ['O'], name: 'Tambalan komposit (di klinik ini)', fee: 450000, status: 'sudah_ada_sini', inPlan: false, billed: true },
  { id: 'pr3d', patientId: 'p123', date: TODAY, tooth: 38, surfaces: [], name: 'Rujuk bedah mulut', fee: 0, status: 'dirujuk', inPlan: true, billed: false },
  { id: 'pr4', patientId: 'p123', date: TODAY, surfaces: [], name: 'Pemeriksaan & konsultasi', fee: 150000, status: 'selesai', inPlan: false, billed: true },
  { id: 'pr5', patientId: 'p089', date: TODAY, surfaces: [], name: 'Scaling seluruh rahang', fee: 350000, status: 'selesai', inPlan: true, billed: true },
  { id: 'pr6', patientId: 'p117', date: '2026-08-01', tooth: 26, surfaces: ['O', 'M'], name: 'Tambalan komposit', fee: 450000, status: 'selesai', inPlan: true, billed: true },
  { id: 'pr7', patientId: 'p123', date: TODAY, tooth: 46, surfaces: ['O', 'D'], name: 'Tambalan komposit', fee: 500000, status: 'direncanakan', inPlan: true, billed: false },
]

export const LEDGER: LedgerRow[] = [
  { id: 'l1', patientId: 'p123', date: '2026-05-09', kind: 'tindakan', desc: 'Scaling seluruh rahang', amount: 350000, procId: 'pr1' },
  { id: 'l2', patientId: 'p123', date: '2026-05-09', kind: 'tindakan', desc: 'Tambalan komposit', amount: 450000, procId: 'pr2' },
  { id: 'l3', patientId: 'p123', date: '2026-05-09', kind: 'klaim', desc: 'Klaim Prudential (70%)', amount: 560000, claimStatus: 'dibayar', procIds: ['pr1', 'pr2'] },
  { id: 'l4', patientId: 'p123', date: '2026-05-09', kind: 'pembayaran', desc: 'Pembayaran', amount: 240000, method: 'tunai' },
  { id: 'l5', patientId: 'p117', date: '2026-08-01', kind: 'tindakan', desc: 'Tambalan komposit', amount: 450000, procId: 'pr6' },
  { id: 'l6', patientId: 'p117', date: '2026-08-01', kind: 'klaim', desc: 'Klaim Prudential (70%)', amount: 315000, claimStatus: 'menunggu', procIds: ['pr6'] },
  { id: 'l7', patientId: 'p117', date: '2026-08-01', kind: 'pembayaran', desc: 'Pembayaran', amount: 100000, method: 'transfer' },
  { id: 'l8', patientId: 'p123', date: TODAY, kind: 'tindakan', desc: 'Pemeriksaan & konsultasi', amount: 150000, procId: 'pr4' },
  { id: 'l9', patientId: 'p089', date: TODAY, kind: 'tindakan', desc: 'Scaling seluruh rahang', amount: 350000, procId: 'pr5' },
  { id: 'l10', patientId: 'p089', date: TODAY, kind: 'pembayaran', desc: 'Pembayaran', amount: 350000, method: 'qris' },
]

const sig = { signer: STAFF.dokter, signedAt: '9 Mei 2026, 10:14 WIB' }
export const CHARTS: Record<string, ChartVisit[]> = {
  p123: [
    { id: 'cv1', date: '2026-05-09', label: '9 Mei 2026', state: 'signed', ...sig, marks: {
      't16-O': { cond: 'tambalan', state: 'signed' }, 't36-O': { cond: 'tambalan', state: 'signed' },
      't46-O': { cond: 'karies', state: 'signed' }, 't38': { cond: 'perlu_dicabut', state: 'signed' }, 't18': { cond: 'hilang', state: 'signed' } } },
    { id: 'cv2', date: TODAY, label: '14 Nov 2026 (hari ini)', state: 'draft', marks: {
      't16-O': { cond: 'tambalan', state: 'signed' }, 't36-O': { cond: 'tambalan', state: 'signed' }, 't18': { cond: 'hilang', state: 'signed' }, 't24-O': { cond: 'karies', state: 'signed', active: false },
      't46-O': { cond: 'karies', state: 'draft', ai: true }, 't46-D': { cond: 'karies', state: 'draft', ai: true },
      't38': { cond: 'sisa_akar', state: 'draft', ai: true }, 't25-M': { cond: 'karies', state: 'draft', ai: true } } },
  ],
  p117: [{ id: 'cv3', date: '2026-08-01', label: '1 Agu 2026', state: 'signed', ...sig, signedAt: '1 Agu 2026, 15:02 WIB', marks: { 't26-O': { cond: 'tambalan', state: 'signed' }, 't26-M': { cond: 'tambalan', state: 'signed' }, 't47': { cond: 'mahkota', state: 'signed' } } }],
  p118: [{ id: 'cv4', date: '2026-02-11', label: '11 Feb 2026', state: 'signed', ...sig, signedAt: '11 Feb 2026, 09:40 WIB', marks: { 't75-O': { cond: 'karies', state: 'signed' }, 't54': { cond: 'hilang', state: 'signed' } } }],
  p156: [{ id: 'cv5', date: '2026-10-20', label: '20 Okt 2026', state: 'signed', ...sig, signedAt: '20 Okt 2026, 11:20 WIB', marks: { 't21': { cond: 'implan', state: 'signed' }, 't37-O': { cond: 'karies', state: 'signed' } } }],
}

export const AI_DICTATION_SOURCE = 'Draf AI dari dikte drg. Budi Santoso'
export const AI_SOAP = {
  O: 'drg. Budi: gigi 46 karies pada permukaan oklusal dan distal. Gigi 38 sisa akar. Gigi 25 karies mesial awal. Kebersihan mulut sedang, plak sedikit di regio posterior bawah.',
  A: 'drg. Budi: karies dentin gigi 46 permukaan O-D, sisa akar gigi 38.',
  P: 'drg. Budi: rencana tambalan komposit gigi 46 permukaan O-D. Evaluasi sisa akar 38 dengan rontgen. Catatan: pasien alergi penisilin.',
}
export const SOAPS: Record<string, SoapVersion[]> = {
  p123: [{ v: 1, state: 'draft', blocks: {
    S: { text: 'Gigi kanan bawah belakang ngilu saat minum dingin sejak ±2 minggu. Tidak ada bengkak. Riwayat alergi penisilin.', ai: false, author: 'Ayu Lestari (anamnesis resepsionis)' },
    O: { text: AI_SOAP.O, ai: true, author: AI_DICTATION_SOURCE },
    A: { text: AI_SOAP.A, ai: true, author: AI_DICTATION_SOURCE },
    P: { text: AI_SOAP.P, ai: true, author: AI_DICTATION_SOURCE },
  } }],
}

export const IMAGES = [
  { id: 'i1', patientId: 'p123', date: '2026-05-09', kind: 'Panoramik', tooth: '—', note: 'Pemeriksaan awal' },
  { id: 'i2', patientId: 'p123', date: '2026-05-09', kind: 'Periapikal', tooth: '36', note: 'Sebelum tambalan' },
  { id: 'i3', patientId: 'p123', date: TODAY, kind: 'Periapikal', tooth: '46', note: 'Keluhan ngilu' },
  { id: 'i4', patientId: 'p123', date: TODAY, kind: 'Foto intraoral', tooth: '46', note: 'Kamera intraoral' },
  { id: 'i5', patientId: 'p156', date: '2026-10-20', kind: 'Periapikal', tooth: '21', note: 'Kontrol implan' },
  { id: 'i6', patientId: 'p117', date: '2026-08-01', kind: 'Bitewing', tooth: '26', note: 'Sebelum tambalan' },
]
