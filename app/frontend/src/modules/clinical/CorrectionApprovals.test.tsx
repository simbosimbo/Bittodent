import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { expect, test, vi } from 'vitest'
import type { PendingCorrection, Procedure } from './api'

const pending: PendingCorrection[] = [{ id: 'c1', reason_type: 'salah_kode', reason: 'Salah input kode saat pencatatan.', proposed: { procedure_code: '23.3' },
  requested_by: { id: 'd1', name: 'drg. Andi Contoh' }, created_at: '2026-11-14T03:00:00Z',
  procedure: { id: 'p1', tooth: 26, surfaces: 'MOD', status: 'selesai', procedure_code: '23.2', name: 'Tumpatan', state: 'final' } as Procedure }]
const decideCorrection = vi.fn().mockResolvedValue({})
const saveClinicSettings = vi.fn().mockResolvedValue({ correction_window_hours: 72 })
vi.mock('./api', async (orig) => ({ ...(await orig<typeof import('./api')>()),
  pendingCorrections: vi.fn().mockResolvedValueOnce(pending).mockResolvedValue([]),
  getClinicSettings: () => Promise.resolve({ correction_window_hours: 48 }),
  decideCorrection: (...a: unknown[]) => decideCorrection(...a), saveClinicSettings: (...a: unknown[]) => saveClinicSettings(...a) }))
const { CorrectionApprovals } = await import('./CorrectionApprovals')

test('owner sees pending corrections, approves one, and sets the window in hours (1–720)', async () => {
  render(<CorrectionApprovals />)
  expect(await screen.findByText('Salah kode')).toBeInTheDocument()
  expect(screen.getByText(/Alasan: Salah input kode/)).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Setujui' }))
  await waitFor(() => expect(decideCorrection).toHaveBeenCalledWith('c1', 'approve'))
  expect(await screen.findByText('Tidak ada koreksi yang menunggu.')).toBeInTheDocument()

  const input = screen.getByLabelText(/Tenggat koreksi bebas/)
  expect(input).toHaveValue(48)
  fireEvent.change(input, { target: { value: '0' } })
  fireEvent.click(screen.getByRole('button', { name: 'Simpan' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('1–720 jam')
  fireEvent.change(input, { target: { value: '72' } })
  fireEvent.click(screen.getByRole('button', { name: 'Simpan' }))
  await waitFor(() => expect(saveClinicSettings).toHaveBeenCalledWith({ correction_window_hours: 72 }))
})
