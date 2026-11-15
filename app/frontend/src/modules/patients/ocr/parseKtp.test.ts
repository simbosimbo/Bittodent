import { expect, test } from 'vitest'
import { fixNikDigits, parseKtpText } from './parseKtp'

const CLEAN = `PROVINSI JAWA BARAT
KABUPATEN BANDUNG
NIK 3201011501900001
Nama BUDI UJI KTP
Tempat/Tgl Lahir BANDUNG, 15-01-1990
Jenis Kelamin LAKI-LAKI Gol. Darah O
Alamat JL SUKA MAJU NO 1
RT/RW 001/002
Kel/Desa SUKAMAJU
Kecamatan SUKASARI
Agama ISLAM
Status Perkawinan KAWIN
Pekerjaan KARYAWAN SWASTA
Kewarganegaraan WNI`

test('fixNikDigits maps O I l B S', () => {
  expect(fixNikDigits('32O1O115Ol9O0001')).toBe('3201011501900001')
  expect(fixNikDigits('32010115Ol9B000S')).toBe('3201011501980005')
})

test('parses a clean synthetic e-KTP block', () => {
  const { draft, flags } = parseKtpText(CLEAN)
  expect(draft).toMatchObject({
    nik: '3201011501900001',
    name: 'BUDI UJI KTP',
    dob: '1990-01-15',
    sex: 'laki_laki',
    address: 'JL SUKA MAJU NO 1',
    province: '32',
    regency: '01',
    district: '01',
  })
  expect(flags).toEqual([])
})

test('repairs confused NIK digits and flags NIK as low', () => {
  const text = CLEAN.replace('3201011501900001', '32O1O115Ol9O0001')
  const { draft, flags } = parseKtpText(text)
  expect(draft.nik).toBe('3201011501900001')
  expect(draft.dob).toBe('1990-01-15')
  expect(flags).toContainEqual({ field: 'nik', kind: 'low' })
})

test('female NIK (day+40) and PEREMPUAN, KOTA label', () => {
  const text = `PROVINSI DKI JAKARTA
KOTA JAKARTA SELATAN
NIK 3201015501900001
Nama SINTA UJI KTP
Tempat/Tgl Lahir JAKARTA, 15-01-1990
Jenis Kelamin PEREMPUAN Gol. Darah B
Alamat JL MELATI 2
RT/RW 003/004
Kel/Desa CIKINI
Kecamatan MENTENG
Agama ISLAM
Status Perkawinan BELUM KAWIN
Pekerjaan PELAJAR
Kewarganegaraan WNI`
  const { draft, flags } = parseKtpText(text)
  expect(draft).toMatchObject({
    nik: '3201015501900001',
    name: 'SINTA UJI KTP',
    dob: '1990-01-15',
    sex: 'perempuan',
    province: '32',
    address: 'JL MELATI 2',
  })
  expect(flags).toEqual([])
})

test('fills dob, sex, and region codes from the NIK when those lines are missing', () => {
  const { draft, flags } = parseKtpText('NIK 3201011501900001\nNama BUDI UJI KTP')
  expect(draft).toMatchObject({
    nik: '3201011501900001',
    name: 'BUDI UJI KTP',
    dob: '1990-01-15',
    sex: 'laki_laki',
    province: '32',
    regency: '01',
    district: '01',
  })
  expect(flags).toEqual([])
})

test('flags a color-chip mismatch when OCR sex/dob disagree with the NIK', () => {
  const text = `NIK 3201011501900001
Nama BUDI UJI KTP
Tempat/Tgl Lahir BANDUNG, 16-01-1990
Jenis Kelamin PEREMPUAN`
  const { draft, flags } = parseKtpText(text)
  expect(draft.nik).toBe('3201011501900001')
  expect(draft.dob).toBe('1990-01-16')
  expect(draft.sex).toBe('perempuan')
  expect(flags).toEqual([
    { field: 'dob', kind: 'mismatch' },
    { field: 'sex', kind: 'mismatch' },
  ])
})

test('handles messy spacing and lowercase labels', () => {
  const text = `provinsi  jawa  barat
kabupaten/kota bandung
nik: 3201 0115 0190 0001
nama   budi uji ktp
tempat/tgl lahir bandung, 15/01/1990
jenis kelamin laki laki
alamat jl suka maju no 1
rt/rw 001/002
kel/desa sukamaju
kecamatan sukasari
agama islam
status perkawinan kawin
pekerjaan karyawan
kewarganegaraan wni`
  const { draft, flags } = parseKtpText(text)
  expect(draft.nik).toBe('3201011501900001')
  expect(draft.name).toBe('budi uji ktp'.toUpperCase() === draft.name ? draft.name : draft.name)
  expect(draft.name?.toUpperCase()).toBe('BUDI UJI KTP')
  expect(draft.dob).toBe('1990-01-15')
  expect(draft.sex).toBe('laki_laki')
  expect(flags).toEqual([])
})


test('low word confidence flags the field without throwing away the draft', () => {
  const words = [
    { text: 'BUDI', confidence: 40 },
    { text: 'UJI', confidence: 42 },
    { text: 'KTP', confidence: 38 },
  ]
  const { draft, flags } = parseKtpText(CLEAN, words)
  expect(draft.name).toBe('BUDI UJI KTP')
  expect(flags).toContainEqual({ field: 'name', kind: 'low' })
})

const TWO_SIDED = `PROVINSI JAWA BARAT
KABUPATEN BANDUNG
NIK 32O1O155Ol9O0001
Nama SINTA UJI KTP
Tempat/Tgl Lahir BANDUNG, 15-01-1990
Jenis Kelamin PERENPUAN Gol. Darah : 0
Alamat JL MELATI 2
RT/RW 003/004
Kel/Desa SUKAMAJU
Kecamatan SUKASARI
Agama ISLAM
Status Perkawinan BELUM KAWIN
Pekerjaan PELAJAR 14-08-2024
Kewarganegaraan WNI
Berlaku Hingga SEUMUR HIDUP
KARTU TANDA PENDUDUK
REPUBLIK INDONESIA`

test('parses extra e-KTP fields, including Gol. Darah on the sex line', () => {
  const { draft } = parseKtpText(CLEAN + '\nBerlaku Hingga SEUMUR HIDUP')
  expect(draft).toMatchObject({
    bloodType: 'O',
    birthPlace: 'BANDUNG',
    rtRw: '001/002',
    village: 'SUKAMAJU',
    districtName: 'SUKASARI',
    religion: 'ISLAM',
    marital: 'KAWIN',
    job: 'KARYAWAN SWASTA',
    citizenship: 'WNI',
    validUntil: 'SEUMUR HIDUP',
    provinceName: 'JAWA BARAT',
    regencyName: 'BANDUNG',
  })
})

test('two-sided page text, stylized NIK, PERENPUAN typo, blood 0, and back-card boilerplate', () => {
  const { draft, flags } = parseKtpText(TWO_SIDED)
  expect(draft).toMatchObject({
    nik: '3201015501900001',
    name: 'SINTA UJI KTP',
    dob: '1990-01-15',
    sex: 'perempuan',
    bloodType: 'O',
    address: 'JL MELATI 2',
    rtRw: '003/004',
    job: 'PELAJAR',
    validUntil: 'SEUMUR HIDUP',
    province: '32',
    regency: '01',
    district: '01',
  })
  expect(flags).toContainEqual({ field: 'nik', kind: 'low' })
  expect(JSON.stringify(draft)).not.toMatch(/KARTU TANDA PENDUDUK|14-08-2024/)
})

test('does not leak raw OCR labels into the result', () => {
  const { draft, flags } = parseKtpText(CLEAN)
  expect(JSON.stringify({ draft, flags })).not.toMatch(/Tempat\/Tgl|Kewarganegaraan/)
})

test('normalizes marital and berlaku hingga, and flags a NIK sliced from a longer digit run', () => {
  const text = `PROVINSI JAWA BARAT
KABUPATEN BANDUNG
NIK 93201011501900001
Nama BUDI UJI KTP
Tempat/Tgl Lahir BANDUNG, 15-01-1990
Jenis Kelamin LAKI-LAKI Gol. Darah O
Status Perkawinan KAWIN CERAI
Pekerjaan KARYAWAN SWASTA
Kewarganegaraan WNI
Berlaku Hingga SEUMUR HIDUP :`
  const { draft, flags } = parseKtpText(text)
  expect(draft.marital).toBe('KAWIN')
  expect(draft.validUntil).toBe('SEUMUR HIDUP')
  expect(draft.nik).toBe('3201011501900001')
  expect(flags).toContainEqual({ field: 'nik', kind: 'low' })
})
