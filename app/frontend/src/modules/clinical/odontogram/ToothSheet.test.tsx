import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { expect, test, vi } from 'vitest'
import { ToothSheet } from './ToothSheet'

vi.mock('../api', () => ({
  getStages: vi.fn().mockResolvedValue({ '23.2': [{ variant: 'standar', label: '1 permukaan' }, { variant: 'p2', label: '2 permukaan' }] }),
  getCatalog: vi.fn().mockResolvedValue([{ procedure_code: '23.2', name: 'Tumpatan', treat_area: 'surface', paint_type: 'fill', conditions: ['cof'] }]),
  saveToothEntry: vi.fn().mockResolvedValue({}),
}))
import { saveToothEntry } from '../api'

test('S2: a finished procedure with several stages needs the stage done today, and sends it', async () => {
  render(<ToothSheet tooth={36} visitId="v1" initialSurface="O" onSaved={() => undefined} />)
  fireEvent.click(screen.getByRole('radio', { name: /Komposit/i }))
  const stage = await screen.findByRole('radiogroup', { name: /Tahap/ })
  expect(screen.getByText('Pilih tahap yang dikerjakan hari ini.')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: /^Simpan/ })).toBeDisabled()
  fireEvent.click(within(stage).getByRole('radio', { name: '2 permukaan' }))
  fireEvent.click(screen.getByRole('button', { name: /^Simpan/ }))
  await waitFor(() => expect(saveToothEntry).toHaveBeenCalledWith('v1', expect.objectContaining({ tooth: 36, variant: 'p2', status: 'selesai' })))
})
