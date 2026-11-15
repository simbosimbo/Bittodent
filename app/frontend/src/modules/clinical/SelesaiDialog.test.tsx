import { fireEvent, render, screen } from '@testing-library/react'
import { expect, test, vi } from 'vitest'
import { SelesaiDialog } from './SelesaiDialog'

const lines = ['Catatan SOAP versi 1', 'Gigi 16 O (Oklusal): Karies']
const ATTESTATION = 'Dengan menekan Selesai, saya menyatakan catatan ini benar.'

test('without a clinic PIN: the attestation check alone enables Selesai (no code field)', () => {
  const onConfirm = vi.fn()
  render(<SelesaiDialog lines={lines} pinRequired={false} hasPin={false} busy={false} error="" onConfirm={onConfirm} onClose={() => {}} />)
  const selesai = screen.getByRole('button', { name: 'Selesai' })
  expect(screen.getByText('Gigi 16 O (Oklusal): Karies')).toBeInTheDocument()
  expect(screen.getByLabelText(ATTESTATION)).toBeInTheDocument()
  expect(screen.queryByLabelText(/PIN/)).toBeNull()
  expect(screen.queryByLabelText(/autentikator/)).toBeNull()
  expect(selesai).toBeDisabled()
  fireEvent.click(screen.getByRole('checkbox'))
  fireEvent.click(selesai)
  expect(onConfirm).toHaveBeenCalledWith(undefined, undefined)
})

test('clinic PIN on: needs 6 digits', () => {
  const onConfirm = vi.fn()
  render(<SelesaiDialog lines={lines} pinRequired hasPin busy={false} error="" onConfirm={onConfirm} onClose={() => {}} />)
  const selesai = screen.getByRole('button', { name: 'Selesai' })
  fireEvent.click(screen.getByRole('checkbox'))
  fireEvent.change(screen.getByLabelText('PIN Selesai (6 angka)'), { target: { value: '12a34' } })
  expect(selesai).toBeDisabled()
  fireEvent.change(screen.getByLabelText('PIN Selesai (6 angka)'), { target: { value: '246810' } })
  fireEvent.click(selesai)
  expect(onConfirm).toHaveBeenCalledWith('246810', undefined)
})

test('clinic PIN on but no PIN yet: points to Pengaturan RM and stays disabled', () => {
  render(<SelesaiDialog lines={lines} pinRequired hasPin={false} busy={false} error="" onConfirm={() => {}} onClose={() => {}} />)
  fireEvent.click(screen.getByRole('checkbox'))
  expect(screen.getByRole('link', { name: 'Pengaturan RM' })).toHaveAttribute('href', '#/pengaturan-rm')
  expect(screen.getByRole('button', { name: 'Selesai' })).toBeDisabled()
})

test('#70 SignCheck warnings: listed, a reason chip (no typing) enables "Selesai dengan alasan" and is sent', () => {
  const onConfirm = vi.fn()
  render(<SelesaiDialog lines={lines} pinRequired={false} hasPin={false} busy={false} error="" onConfirm={onConfirm} onClose={() => {}}
    warnings={[{ message: 'Gigi 26: tindakan tanpa kode diagnosis ICD-10.' }]} />)
  expect(screen.getByText('Gigi 26: tindakan tanpa kode diagnosis ICD-10.')).toBeInTheDocument()
  fireEvent.click(screen.getByRole('checkbox'))
  const go = screen.getByRole('button', { name: 'Selesai dengan alasan' })
  expect(go).toBeDisabled()
  fireEvent.click(screen.getByRole('button', { name: 'Diagnosis tercatat di Asesmen SOAP.' }))
  fireEvent.click(go)
  expect(onConfirm).toHaveBeenCalledWith(undefined, 'Diagnosis tercatat di Asesmen SOAP.')
})
