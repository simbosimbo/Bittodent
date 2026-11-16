import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { expect, test, vi } from 'vitest'
import type { Me } from '../../shared/session'

const getClinicSettings = vi.fn().mockResolvedValue({ correction_window_hours: 48, selesai_pin_required: false, odontogram_exam_enabled: true })
const saveClinicSettings = vi.fn().mockResolvedValue({ correction_window_hours: 48, selesai_pin_required: true, odontogram_exam_enabled: false })
const setSelesaiPin = vi.fn().mockResolvedValue({ has_pin: true })
vi.mock('./api', async (orig) => ({ ...(await orig<typeof import('./api')>()),
  getClinicSettings: () => getClinicSettings(), saveClinicSettings: (...a: unknown[]) => saveClinicSettings(...a),
  setSelesaiPin: (...a: unknown[]) => setSelesaiPin(...a) }))
const { default: SettingsRmPage } = await import('./SettingsRm')

const me = (permissions: string[], selesai = { pin_required: false, has_pin: false }) => ({ permissions, selesai } as unknown as Me)

test('owner edits tenggat koreksi, the PIN requirement (default off) and the Pemeriksaan awal mode (default on) in one form, and sees no own-PIN form', async () => {
  const onChanged = vi.fn()
  render(<SettingsRmPage me={me(['settings.manage'])} onChanged={onChanged} />)
  const box = await screen.findByLabelText('Wajibkan PIN saat Selesai')
  await waitFor(() => expect(box).toBeEnabled())
  expect(box).not.toBeChecked()
  const hours = screen.getByLabelText(/Tenggat koreksi bebas/)
  expect(hours).toHaveValue(48)
  expect(screen.queryByText('PIN Selesai saya')).toBeNull()
  const save = screen.getByRole('button', { name: 'Simpan pengaturan' })
  fireEvent.change(hours, { target: { value: '0' } })
  fireEvent.click(save)
  expect(await screen.findByRole('alert')).toHaveTextContent('1–720 jam')
  expect(saveClinicSettings).not.toHaveBeenCalled()
  fireEvent.change(hours, { target: { value: '72' } })
  const exam = screen.getByLabelText('Tampilkan mode Pemeriksaan awal di odontogram')
  expect(exam).toBeChecked()
  fireEvent.click(box)
  fireEvent.click(exam)
  fireEvent.click(save)
  await waitFor(() => expect(saveClinicSettings).toHaveBeenCalledWith({ correction_window_hours: 72, selesai_pin_required: true, odontogram_exam_enabled: false }))
  await waitFor(() => expect(onChanged).toHaveBeenCalled())
})

test('dentist sets a first PIN (6 digits) and must give the old PIN to change it', async () => {
  const { unmount } = render(<SettingsRmPage me={me(['note.sign'])} onChanged={() => {}} />)
  expect(screen.queryByLabelText('Wajibkan PIN saat Selesai')).toBeNull()
  const save = screen.getByRole('button', { name: 'Simpan PIN' })
  fireEvent.change(screen.getByLabelText('PIN baru (6 angka)'), { target: { value: '24a681' } })
  expect(save).toBeDisabled()
  fireEvent.change(screen.getByLabelText('PIN baru (6 angka)'), { target: { value: '246810' } })
  fireEvent.click(save)
  await waitFor(() => expect(setSelesaiPin).toHaveBeenCalledWith('246810', undefined))
  unmount()

  render(<SettingsRmPage me={me(['note.sign'], { pin_required: true, has_pin: true })} onChanged={() => {}} />)
  const change = screen.getByRole('button', { name: 'Ubah PIN' })
  fireEvent.change(screen.getByLabelText('PIN baru (6 angka)'), { target: { value: '135790' } })
  expect(change).toBeDisabled()
  fireEvent.change(screen.getByLabelText('PIN lama'), { target: { value: '246810' } })
  fireEvent.click(change)
  await waitFor(() => expect(setSelesaiPin).toHaveBeenLastCalledWith('135790', '246810'))
})
