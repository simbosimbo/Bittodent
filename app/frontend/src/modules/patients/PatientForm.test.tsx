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

// Audit P3-1: every control is named by its visible label alone; a validation error is its description, not part of the name.
test('every input has a screen-reader label, errors are descriptions', () => {
  render(<PatientForm />)
  fireEvent.change(screen.getByLabelText('Jenis penjamin'), { target: { value: 'asuransi' } })
  const labels = ['Nama lengkap *', 'Tanggal lahir', 'Jenis kelamin', 'NIK', 'No. HP', 'Alamat', 'Jenis penjamin', 'Nama asuransi *', 'No. peserta']
  const controls = labels.map((l) => screen.getByLabelText(l))
  expect(document.querySelectorAll('form input, form select')).toHaveLength(labels.length)
  expect(new Set(controls).size).toBe(labels.length)

  fireEvent.change(screen.getByLabelText('NIK'), { target: { value: '12345' } })
  fireEvent.click(screen.getByRole('button', { name: 'Simpan pasien' }))
  const nik = screen.getByRole('textbox', { name: 'NIK' })
  expect(nik).toHaveAttribute('aria-invalid', 'true')
  expect(nik).toHaveAccessibleDescription('NIK harus 16 angka.')
  expect(screen.getByRole('textbox', { name: 'Nama lengkap *' })).toHaveAccessibleDescription('Nama lengkap wajib diisi.')
  expect(screen.getByRole('textbox', { name: 'Alamat' })).not.toHaveAttribute('aria-invalid')
})
