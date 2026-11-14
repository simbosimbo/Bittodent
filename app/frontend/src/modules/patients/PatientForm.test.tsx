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
