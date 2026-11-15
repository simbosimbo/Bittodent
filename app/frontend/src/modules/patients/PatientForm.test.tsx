import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, test, vi } from 'vitest'
import PatientForm from './PatientForm'

afterEach(() => vi.restoreAllMocks())

test('shows Indonesian validation messages and does not call the API', () => {
  const fetchSpy = vi.spyOn(globalThis, 'fetch')
  render(<PatientForm />)
  fireEvent.change(screen.getByLabelText('NIK'), { target: { value: '12345' } })
  fireEvent.change(screen.getByLabelText('No. HP'), { target: { value: 'abc' } })
  fireEvent.change(screen.getByLabelText('Tanggal lahir'), { target: { value: '2999-01-01' } })
  fireEvent.click(screen.getByRole('button', { name: 'Simpan pasien' }))

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
  fireEvent.click(screen.getByRole('button', { name: 'Simpan pasien' }))
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  await vi.waitFor(() => expect(location.hash).toBe('#/pasien/p-1'))
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
  fireEvent.click(screen.getByRole('button', { name: 'Simpan pasien' }))
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
  fireEvent.click(screen.getByRole('button', { name: 'Simpan pasien' }))
  await vi.waitFor(() => expect(location.hash).toBe('#/pasien/p-2'))
  expect(JSON.parse(fetchSpy.mock.calls[0][1]!.body as string)).toEqual({ name: 'Budi Uji KTP', nik: '3201011501900001', payer_type: 'umum' })
  const [url, init] = fetchSpy.mock.calls[1]
  expect([url, init!.method, JSON.parse(init!.body as string)]).toEqual(['/api/patients/p-2/ktp', 'PUT', { province_code: '32' }])
})
