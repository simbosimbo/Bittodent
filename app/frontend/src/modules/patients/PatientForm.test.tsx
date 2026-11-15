import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, test, vi } from 'vitest'
import PatientForm from './PatientForm'
import { runKtpOcr } from './ocr/runOcr'

vi.mock('./ocr/runOcr', () => ({ runKtpOcr: vi.fn() }))

afterEach(() => vi.restoreAllMocks())

const cta = 'Verifikasi dan daftar'

test('shows Indonesian validation messages and does not call the API', () => {
  const fetchSpy = vi.spyOn(globalThis, 'fetch')
  render(<PatientForm />)
  fireEvent.change(screen.getByLabelText('NIK'), { target: { value: '12345' } })
  fireEvent.change(screen.getByLabelText('No. HP'), { target: { value: 'abc' } })
  fireEvent.change(screen.getByLabelText('Tanggal lahir'), { target: { value: '2999-01-01' } })
  fireEvent.click(screen.getByRole('button', { name: cta }))

  expect(screen.getByText('Nama lengkap wajib diisi.')).toBeInTheDocument()
  expect(screen.getByText('NIK harus 16 angka.')).toBeInTheDocument()
  expect(screen.getByText('Nomor HP tidak valid.')).toBeInTheDocument()
  expect(screen.getByText('Tanggal lahir tidak boleh di masa depan.')).toBeInTheDocument()
  expect(fetchSpy).not.toHaveBeenCalled()
})

test('valid input clears the errors and posts to /api/patients', async () => {
  const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ id: 'p-1' }), { status: 201 }))
  document.cookie = 'XSRF-TOKEN=t'
  render(<PatientForm />)
  fireEvent.change(screen.getByLabelText('Nama lengkap *'), { target: { value: 'Sinta Uji Coba' } })
  fireEvent.change(screen.getByLabelText('NIK'), { target: { value: '9900 0000 0000 0001' } })
  fireEvent.click(screen.getByRole('button', { name: cta }))
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  await vi.waitFor(() => expect(screen.getByRole('tab', { name: 'Profil' })).toHaveAttribute('aria-selected', 'true'))
  expect(screen.getAllByText('9900********0001').length).toBeGreaterThan(0)
  expect(document.body.textContent).not.toMatch(/9900000000000001/)
  expect(screen.queryByDisplayValue('9900 0000 0000 0001')).not.toBeInTheDocument()
  const [url, init] = fetchSpy.mock.calls[0]
  expect(url).toBe('/api/patients')
  expect(JSON.parse(init!.body as string)).toEqual({ name: 'Sinta Uji Coba', nik: '9900 0000 0000 0001', payer_type: 'umum' })
})

test('KTP: chips mark the fields that disagree with the NIK', () => {
  render(<PatientForm />)
  fireEvent.change(screen.getByLabelText('NIK'), { target: { value: '3201011501900001' } })
  expect(screen.queryByText('Tidak cocok')).not.toBeInTheDocument()
  fireEvent.change(screen.getByLabelText('Tanggal lahir'), { target: { value: '1990-01-16' } })
  fireEvent.change(screen.getByLabelText('Jenis kelamin'), { target: { value: 'perempuan' } })
  fireEvent.change(screen.getByLabelText('Prov'), { target: { value: '32' } })
  fireEvent.change(screen.getByLabelText('Kab/Kota'), { target: { value: '02' } })
  fireEvent.change(screen.getByLabelText('Kec'), { target: { value: '01' } })
  const chips = screen.getAllByText('Tidak cocok').map((c) => c.getAttribute('data-field'))
  expect(chips).toEqual(['dob', 'sex', 'regency'])
  fireEvent.change(screen.getByLabelText(/^Tanggal lahir/), { target: { value: '1990-01-15' } })
  expect(screen.getAllByText('Tidak cocok')).toHaveLength(2)
})

test('KTP: NIK must still be 16 digits', () => {
  const fetchSpy = vi.spyOn(globalThis, 'fetch')
  render(<PatientForm />)
  fireEvent.change(screen.getByLabelText('Nama lengkap *'), { target: { value: 'Sinta Uji Coba' } })
  fireEvent.change(screen.getByLabelText('NIK'), { target: { value: '320101150190' } })
  fireEvent.click(screen.getByRole('button', { name: cta }))
  expect(screen.getByText('NIK harus 16 angka.')).toBeInTheDocument()
  expect(fetchSpy).not.toHaveBeenCalled()
})

test('KTP: codes are saved with a follow-up PUT, not sent to /api/patients', async () => {
  const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async (url) =>
    new Response(JSON.stringify(url === '/api/patients' ? { id: 'p-2' } : { mismatches: [], nik: '3201********0001' }), { status: url === '/api/patients' ? 201 : 200 }))
  document.cookie = 'XSRF-TOKEN=t'
  render(<PatientForm />)
  fireEvent.change(screen.getByLabelText('Nama lengkap *'), { target: { value: 'Budi Uji KTP' } })
  fireEvent.change(screen.getByLabelText('NIK'), { target: { value: '3201011501900001' } })
  fireEvent.change(screen.getByLabelText('Prov'), { target: { value: '32' } })
  fireEvent.click(screen.getByRole('button', { name: cta }))
  await vi.waitFor(() => expect(screen.getByRole('tab', { name: 'Profil' })).toHaveAttribute('aria-selected', 'true'))
  expect(JSON.parse(fetchSpy.mock.calls[0][1]!.body as string)).toEqual({ name: 'Budi Uji KTP', nik: '3201011501900001', payer_type: 'umum' })
  const [url, init] = fetchSpy.mock.calls[1]
  expect([url, init!.method, JSON.parse(init!.body as string)]).toEqual(['/api/patients/p-2/ktp', 'PUT', { province_code: '32' }])
  expect(screen.getAllByText('3201********0001').length).toBeGreaterThan(0)
  expect(document.body.textContent).not.toContain('3201011501900001')
})

test('NIK is masked after blur, eye toggle reveals, and hasil stays masked', () => {
  render(<PatientForm />)
  const nik = screen.getByLabelText('NIK')
  fireEvent.focus(nik)
  fireEvent.change(nik, { target: { value: '3201011501900001' } })
  expect(nik).toHaveValue('3201011501900001')
  expect(screen.getByLabelText('Hasil')).toHaveTextContent('3201********0001')
  fireEvent.blur(nik)
  expect(nik).toHaveValue('3201********0001')
  fireEvent.click(screen.getByRole('button', { name: 'Tampilkan NIK' }))
  expect(nik).toHaveValue('3201011501900001')
  expect(screen.getByLabelText('Hasil')).toHaveTextContent('3201********0001')
  fireEvent.click(screen.getByRole('button', { name: 'Sembunyikan NIK' }))
  expect(nik).toHaveValue('3201********0001')
})

test('tabs and dock CTA are present; Profil is disabled until save; Terenkripsi is hidden before upload', () => {
  render(<PatientForm />)
  expect(screen.getByRole('tab', { name: 'Daftar' })).toHaveAttribute('aria-selected', 'true')
  expect(screen.getByRole('tab', { name: 'Profil' })).toBeDisabled()
  expect(screen.queryByText('Terenkripsi')).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: cta })).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Simpan pasien' })).not.toBeInTheDocument()
})

test('after save without patient.ktp.view the full NIK is not in the DOM and Buka is hidden', async () => {
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (url) => {
    if (url === '/api/patients') return new Response(JSON.stringify({ id: 'p-3' }), { status: 201 })
    if (String(url).includes('/ktp/photos')) return new Response(JSON.stringify({ id: 'ph-1' }), { status: 201 })
    return new Response(JSON.stringify({ mismatches: [], nik: '3201********0001' }), { status: 200 })
  })
  document.cookie = 'XSRF-TOKEN=t'
  render(<PatientForm />)
  fireEvent.change(screen.getByLabelText('Nama lengkap *'), { target: { value: 'Budi Uji KTP' } })
  fireEvent.change(screen.getByLabelText('NIK'), { target: { value: '3201011501900001' } })
  fireEvent.click(screen.getByRole('button', { name: cta }))
  await vi.waitFor(() => expect(screen.getByRole('tab', { name: 'Profil' })).toHaveAttribute('aria-selected', 'true'))
  expect(document.body.textContent).not.toContain('3201011501900001')
  expect(screen.getAllByText('3201********0001').length).toBeGreaterThan(0)
  expect(screen.queryByRole('button', { name: 'Buka' })).not.toBeInTheDocument()
})

test('OCR draft fills the form, flags mismatches, and is not posted to the server', async () => {
  vi.mocked(runKtpOcr).mockResolvedValue({
    draft: { nik: '3201011501900001', name: 'BUDI UJI KTP', dob: '1990-01-16', sex: 'laki_laki', address: 'JL SUKA MAJU NO 1', province: '32', regency: '01', district: '01' },
    flags: [{ field: 'dob', kind: 'mismatch' }],
  })
  const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ id: 'p-ocr' }), { status: 201 }))
  document.cookie = 'XSRF-TOKEN=t'
  render(<PatientForm />)
  const file = new File([new Uint8Array([1, 2, 3])], 'ktp-sintetis.png', { type: 'image/png' })
  fireEvent.change(screen.getByLabelText('Foto KTP'), { target: { files: [file] } })
  await vi.waitFor(() => expect(screen.getByLabelText('Nama lengkap *')).toHaveValue('BUDI UJI KTP'))
  expect(runKtpOcr).toHaveBeenCalledTimes(1)
  expect(screen.getByLabelText('Hasil')).toHaveTextContent('3201********0001')
  expect(screen.getByLabelText('Alamat')).toHaveValue('JL SUKA MAJU NO 1')
  expect(screen.getByLabelText(/^Prov/)).toHaveValue('32')
  expect(screen.getByText('Tidak cocok').getAttribute('data-field')).toBe('dob')
  expect(screen.getAllByRole('button', { name: 'Dari pindai' }).length).toBeGreaterThan(0)
  expect(screen.getByRole('button', { name: cta })).toBeDisabled()
  expect(screen.queryByText('Terenkripsi')).not.toBeInTheDocument()
  expect(screen.queryByRole('img')).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Konfirmasi semua' }))
  expect(screen.queryByRole('button', { name: 'Dari pindai' })).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: cta })).toBeEnabled()
  fireEvent.click(screen.getByRole('button', { name: cta }))
  await vi.waitFor(() => expect(fetchSpy).toHaveBeenCalled())
  const bodies = fetchSpy.mock.calls.map(([, init]) => typeof init?.body === 'string' ? init.body : '')
  expect(bodies.join('\n')).not.toMatch(/Tempat\/Tgl|Kewarganegaraan|raw|ocr/i)
  const posted = JSON.parse(fetchSpy.mock.calls[0][1]!.body as string)
  expect(posted).toEqual({
    name: 'BUDI UJI KTP',
    dob: '1990-01-16',
    sex: 'laki_laki',
    nik: '3201011501900001',
    address: 'JL SUKA MAJU NO 1',
    payer_type: 'umum',
  })
})

test('OCR: Dari pindai fields must be confirmed; a single confirm-all enables the CTA', async () => {
  vi.mocked(runKtpOcr).mockResolvedValue({
    draft: { nik: '3201011501900001', name: 'BUDI UJI KTP', dob: '1990-01-15', sex: 'laki_laki' },
    flags: [],
  })
  render(<PatientForm />)
  const file = new File([new Uint8Array([1, 2, 3])], 'ktp-sintetis.png', { type: 'image/png' })
  fireEvent.change(screen.getByLabelText('Foto KTP'), { target: { files: [file] } })
  await vi.waitFor(() => expect(screen.getByLabelText('Nama lengkap *')).toHaveValue('BUDI UJI KTP'))
  expect(screen.getAllByRole('button', { name: 'Dari pindai' })).toHaveLength(4)
  expect(screen.getByRole('button', { name: cta })).toBeDisabled()
  fireEvent.click(screen.getAllByRole('button', { name: 'Dari pindai' })[0])
  expect(screen.getAllByRole('button', { name: 'Dari pindai' })).toHaveLength(3)
  expect(screen.getByRole('button', { name: cta })).toBeDisabled()
  fireEvent.click(screen.getByRole('button', { name: 'Konfirmasi semua' }))
  expect(screen.queryByRole('button', { name: 'Dari pindai' })).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: cta })).toBeEnabled()
})

test('OCR: editing a scanned field confirms it; regex-repaired NIK shows Periksa', async () => {
  vi.mocked(runKtpOcr).mockResolvedValue({
    draft: { nik: '3201011501900001', name: 'BUDI UJI KTP' },
    flags: [{ field: 'nik', kind: 'low' }],
  })
  render(<PatientForm />)
  const file = new File([new Uint8Array([1, 2, 3])], 'ktp-sintetis.png', { type: 'image/png' })
  fireEvent.change(screen.getByLabelText('Foto KTP'), { target: { files: [file] } })
  await vi.waitFor(() => expect(screen.getByLabelText('Nama lengkap *')).toHaveValue('BUDI UJI KTP'))
  expect(screen.getByText('Periksa').getAttribute('data-field')).toBe('nik')
  expect(screen.getByRole('button', { name: cta })).toBeDisabled()
  fireEvent.change(screen.getByLabelText('Nama lengkap *'), { target: { value: 'Budi Uji KTP' } })
  expect(screen.getAllByRole('button', { name: 'Dari pindai' })).toHaveLength(1)
  fireEvent.focus(screen.getByRole('textbox', { name: 'NIK' }))
  expect(screen.queryByRole('button', { name: 'Dari pindai' })).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: cta })).toBeEnabled()
  expect(screen.getByText('Periksa')).toBeInTheDocument()
})

test('Terenkripsi appears only after an encrypted photo upload succeeds', async () => {
  vi.mocked(runKtpOcr).mockResolvedValue({ draft: { name: 'BUDI UJI KTP' }, flags: [] })
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (url) => {
    if (url === '/api/patients') return new Response(JSON.stringify({ id: 'p-enc' }), { status: 201 })
    if (String(url).includes('/ktp/photos')) return new Response(JSON.stringify({ id: 'ph-1' }), { status: 201 })
    return new Response(JSON.stringify({ mismatches: [], nik: null }), { status: 200 })
  })
  document.cookie = 'XSRF-TOKEN=t'
  render(<PatientForm canKtp />)
  const file = new File([new Uint8Array([1, 2, 3])], 'ktp-sintetis.png', { type: 'image/png' })
  fireEvent.change(screen.getByLabelText('Foto KTP'), { target: { files: [file] } })
  await vi.waitFor(() => expect(screen.getByLabelText('Nama lengkap *')).toHaveValue('BUDI UJI KTP'))
  expect(screen.queryByText('Terenkripsi')).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Konfirmasi semua' }))
  fireEvent.click(screen.getByRole('button', { name: cta }))
  await vi.waitFor(() => expect(screen.getByRole('tab', { name: 'Profil' })).toHaveAttribute('aria-selected', 'true'))
  expect(screen.getByText('Terenkripsi')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Buka' })).toBeInTheDocument()
})
