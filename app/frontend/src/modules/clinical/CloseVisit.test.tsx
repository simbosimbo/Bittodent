import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { expect, test, vi } from 'vitest'
import { ApiError } from '../../shared/api/http'

const closeVisit = vi.fn()
const cancelAttendance = vi.fn().mockResolvedValue({})
vi.mock('./api', async (orig) => ({ ...(await orig<typeof import('./api')>()),
  closeVisit: (...a: unknown[]) => closeVisit(...a), cancelAttendance: (...a: unknown[]) => cancelAttendance(...a) }))
const { CloseVisit } = await import('./CloseVisit')

test('shows the invoice_required message from the server and closes with a reason', async () => {
  const msg = 'Kunjungan dengan tindakan selesai tidak bisa ditutup tanpa tagihan.'
  closeVisit.mockRejectedValueOnce(new ApiError(409, { error: 'invoice_required', message: msg })).mockResolvedValueOnce({})
  const onDone = vi.fn()
  render(<CloseVisit visit={{ id: 'v1', appointment_id: 'a1' }} canBilling onDone={onDone} />)
  expect(screen.queryByRole('button', { name: 'Batalkan kehadiran' })).toBeNull() // appointment visits cancel via the appointment
  fireEvent.click(screen.getByRole('button', { name: 'Tutup kunjungan' }))
  expect(await screen.findByRole('alert')).toHaveTextContent(msg)
  expect(onDone).not.toHaveBeenCalled()
  fireEvent.change(screen.getByLabelText(/Alasan/), { target: { value: 'Pasien tidak datang, dicatat' } })
  fireEvent.click(screen.getByRole('button', { name: 'Tutup kunjungan' }))
  await waitFor(() => expect(onDone).toHaveBeenCalled())
  expect(closeVisit).toHaveBeenLastCalledWith('v1', 'Pasien tidak datang, dicatat')
})

test('walk-in: cancel attendance needs a 10+ letter reason', async () => {
  render(<CloseVisit visit={{ id: 'v2', appointment_id: null }} canBilling={false} onDone={() => {}} />)
  fireEvent.click(screen.getByRole('button', { name: 'Batalkan kehadiran' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('minimal 10 huruf')
  expect(cancelAttendance).not.toHaveBeenCalled()
  fireEvent.change(screen.getByLabelText(/Alasan/), { target: { value: 'Pasien pulang sebelum dilayani' } })
  fireEvent.click(screen.getByRole('button', { name: 'Batalkan kehadiran' }))
  await waitFor(() => expect(cancelAttendance).toHaveBeenCalledWith('v2', 'Pasien pulang sebelum dilayani'))
})
