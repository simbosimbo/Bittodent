import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { expect, test, vi } from 'vitest'
import type { Procedure, ProcedureHistoryRow } from './api'

const replaceProcedure = vi.fn().mockResolvedValue({})
vi.mock('./api', async (orig) => ({ ...(await orig<typeof import('./api')>()), replaceProcedure: (...a: unknown[]) => replaceProcedure(...a) }))
const { ProcedureFixDialog, ProcedureHistory } = await import('./Chart')

const filling = { id: 'p1', tooth: 26, surfaces: 'MOD', status: 'selesai', procedure_code: '23.2', name: 'Tumpatan', state: 'final', reason: null } as Procedure

test('history labels a replaced restoration Digantikan and shows the reason', () => {
  const rows = [{ ...filling, effective_at: '2026-11-12T03:00:00Z', superseded_by: 'm1', change: 'digantikan' },
    { ...filling, id: 'm1', status: 'superseded', reason: 'Tambalan bocor, karies sekunder.', effective_at: '2026-11-15T03:00:00Z', superseded_by: null, change: null }] as ProcedureHistoryRow[]
  render(<ProcedureHistory rows={rows} />)
  expect(screen.getAllByText('Digantikan').length).toBeGreaterThanOrEqual(2) // badge on the old row + chip on the marker
  expect(screen.getByText(/Alasan: Tambalan bocor/)).toBeInTheDocument()
})

test('replace needs a reason of 10+ letters before calling the server', async () => {
  const onDone = vi.fn()
  render(<ProcedureFixDialog p={filling} mode="ganti" visitId="v1" onDone={onDone} onClose={() => {}} />)
  fireEvent.change(screen.getByLabelText(/Kode ICD-9-CM/), { target: { value: '23.41' } })
  fireEvent.change(screen.getByLabelText('Alasan *'), { target: { value: 'bocor' } })
  fireEvent.click(screen.getByRole('button', { name: 'Simpan' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('minimal 10 huruf')
  expect(replaceProcedure).not.toHaveBeenCalled()

  fireEvent.change(screen.getByLabelText('Alasan *'), { target: { value: 'Tambalan bocor, karies sekunder.' } })
  fireEvent.click(screen.getByRole('button', { name: 'Simpan' }))
  await waitFor(() => expect(onDone).toHaveBeenCalled())
  expect(replaceProcedure).toHaveBeenCalledWith('p1', { visit_id: 'v1', status: 'direncanakan', procedure_code: '23.41', tooth: 26, surfaces: null, reason: 'Tambalan bocor, karies sekunder.' })
})
