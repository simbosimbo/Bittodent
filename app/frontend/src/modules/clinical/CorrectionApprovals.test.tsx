import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { expect, test, vi } from 'vitest'
import type { PendingCorrection, Procedure } from './api'

const pending: PendingCorrection[] = [{ id: 'c1', reason_type: 'salah_kode', reason: 'Salah input kode saat pencatatan.', proposed: { procedure_code: '23.3' },
  requested_by: { id: 'd1', name: 'drg. Andi Contoh' }, created_at: '2026-11-14T03:00:00Z',
  procedure: { id: 'p1', tooth: 26, surfaces: 'MOD', status: 'selesai', procedure_code: '23.2', name: 'Tumpatan', state: 'final' } as Procedure }]
const decideCorrection = vi.fn().mockResolvedValue({})
vi.mock('./api', async (orig) => ({ ...(await orig<typeof import('./api')>()),
  pendingCorrections: vi.fn().mockResolvedValueOnce(pending).mockResolvedValue([]),
  decideCorrection: (...a: unknown[]) => decideCorrection(...a) }))
const { CorrectionApprovals } = await import('./CorrectionApprovals')

test('owner sees pending corrections and approves one; the window is edited on Pengaturan RM, not here', async () => {
  render(<CorrectionApprovals />)
  expect(await screen.findByText('Salah kode')).toBeInTheDocument()
  expect(screen.getByText(/Alasan: Salah input kode/)).toBeInTheDocument()
  expect(screen.queryByLabelText(/Tenggat koreksi bebas/)).toBeNull()
  expect(screen.getByRole('link', { name: 'Pengaturan RM' })).toHaveAttribute('href', '#/pengaturan-rm')
  fireEvent.click(screen.getByRole('button', { name: 'Setujui' }))
  await waitFor(() => expect(decideCorrection).toHaveBeenCalledWith('c1', 'approve'))
  expect(await screen.findByText('Tidak ada koreksi yang menunggu.')).toBeInTheDocument()
})
