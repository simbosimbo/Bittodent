import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, expect, test, vi } from 'vitest'
import { ApiError } from '../../../shared/api/http'
import { ToothSheet } from './ToothSheet'

vi.mock('../api', () => ({
  getStages: vi.fn().mockResolvedValue({ '23.2': [{ variant: 'standar', label: '1 permukaan' }, { variant: 'p2', label: '2 permukaan' }] }),
  getCatalog: vi.fn().mockResolvedValue([
    { procedure_code: '23.2', name: 'Tumpatan', treat_area: 'surface', paint_type: 'Filling', conditions: ['amf', 'cof', 'gif'] },
    { procedure_code: '23.09', name: 'Pencabutan gigi', treat_area: 'tooth', paint_type: 'Extraction', conditions: ['mis'] },
    { procedure_code: '96.54', name: 'Scaling', treat_area: 'mouth', paint_type: 'Text', conditions: [] },
  ]),
  saveToothEntry: vi.fn().mockResolvedValue({}),
}))
import { saveToothEntry } from '../api'

beforeEach(() => vi.mocked(saveToothEntry).mockClear())
const simpan = () => screen.getByRole('button', { name: /^Simpan/ })

test('S3: Tindakan is the default tab and lists tooth/surface procedures only (mouth procedures stay on the chart buttons)', async () => {
  render(<ToothSheet tooth={46} visitId="v1" onSaved={() => undefined} />)
  expect(screen.getByRole('tab', { name: 'Tindakan' })).toHaveAttribute('aria-selected', 'true')
  const list = within(screen.getByRole('radiogroup', { name: 'Tindakan' }))
  await list.findByRole('radio', { name: /Pencabutan gigi/ })
  expect(list.queryByRole('radio', { name: /Scaling/ })).toBeNull()
})

test('S3: Cabut sends the procedure code with status Selesai and no condition (the server fills the odontogram)', async () => {
  render(<ToothSheet tooth={46} visitId="v1" onSaved={() => undefined} />)
  fireEvent.click(await screen.findByRole('radio', { name: /Pencabutan gigi/ }))
  expect(within(screen.getByRole('radiogroup', { name: 'Status' })).getByRole('radio', { name: 'Selesai' })).toHaveAttribute('aria-checked', 'true')
  expect(simpan()).toHaveTextContent('Simpan 46 Pencabutan gigi')
  fireEvent.click(simpan())
  await waitFor(() => expect(saveToothEntry).toHaveBeenCalledWith('v1', { tooth: 46, procedure_code: '23.09', status: 'selesai' }))
})

test('S3: Tumpatan needs bahan, a surface and the stage before Simpan', async () => {
  render(<ToothSheet tooth={36} visitId="v1" onSaved={() => undefined} />)
  fireEvent.click(await screen.findByRole('radio', { name: /Tumpatan/ }))
  expect(simpan()).toBeDisabled()
  expect(screen.getByText('Pilih bahan / jenis.')).toBeInTheDocument()
  fireEvent.click(within(screen.getByRole('radiogroup', { name: 'Bahan / jenis' })).getByRole('radio', { name: 'Tambalan komposit' }))
  expect(screen.getByText('Pilih permukaan.')).toBeInTheDocument()
  fireEvent.click(within(screen.getByRole('group', { name: 'Permukaan' })).getAllByRole('button').find((b) => b.querySelector('strong')!.textContent === 'O')!)
  expect(screen.getByText('Pilih tahap yang dikerjakan hari ini.')).toBeInTheDocument()
  expect(simpan()).toBeDisabled()
  fireEvent.click(within(screen.getByRole('radiogroup', { name: 'Tahap Tumpatan' })).getByRole('radio', { name: '2 permukaan' }))
  expect(simpan()).toBeEnabled()
  fireEvent.click(simpan())
  await waitFor(() => expect(saveToothEntry).toHaveBeenCalledWith('v1',
    { tooth: 36, procedure_code: '23.2', condition: 'tambalan_komposit', status: 'selesai', surfaces: ['O'], variant: 'p2' }))
})

test('S3: a pick_condition answer (catalog changed since it loaded) shows the bahan chooser', async () => {
  vi.mocked(saveToothEntry).mockRejectedValueOnce(new ApiError(422, { error: 'pick_condition', message: 'Pilih bahan / jenis yang dipakai.', candidates: ['hilang', 'sisa_akar'] }))
  render(<ToothSheet tooth={46} visitId="v1" onSaved={() => undefined} />)
  fireEvent.click(await screen.findByRole('radio', { name: /Pencabutan gigi/ }))
  fireEvent.click(simpan())
  const bahan = within(await screen.findByRole('radiogroup', { name: 'Bahan / jenis' }))
  expect(simpan()).toBeDisabled()
  fireEvent.click(bahan.getByRole('radio', { name: 'Sisa akar' }))
  fireEvent.click(simpan())
  await waitFor(() => expect(saveToothEntry).toHaveBeenLastCalledWith('v1', { tooth: 46, procedure_code: '23.09', condition: 'sisa_akar', status: 'selesai' }))
})

test('S2: a finished procedure with several stages needs the stage done today, and sends it', async () => {
  render(<ToothSheet tooth={36} visitId="v1" initialSurface="O" onSaved={() => undefined} />)
  fireEvent.click(screen.getByRole('tab', { name: 'Permukaan' }))
  fireEvent.click(screen.getByRole('radio', { name: /Komposit/i }))
  const stage = await screen.findByRole('radiogroup', { name: /Tahap/ })
  expect(screen.getByText('Pilih tahap yang dikerjakan hari ini.')).toBeInTheDocument()
  expect(simpan()).toBeDisabled()
  fireEvent.click(within(stage).getByRole('radio', { name: '2 permukaan' }))
  fireEvent.click(simpan())
  await waitFor(() => expect(saveToothEntry).toHaveBeenCalledWith('v1', expect.objectContaining({ tooth: 36, variant: 'p2', status: 'selesai' })))
})
