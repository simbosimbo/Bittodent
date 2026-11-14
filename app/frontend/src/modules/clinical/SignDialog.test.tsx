import { fireEvent, render, screen } from '@testing-library/react'
import { expect, test, vi } from 'vitest'
import { SignDialog } from './SignDialog'

test('sign dialog requires the check and a 6-digit code', () => {
  const onConfirm = vi.fn()
  render(<SignDialog lines={['Catatan SOAP versi 1', 'Gigi 16 O (Oklusal): Karies']} busy={false} error="" onConfirm={onConfirm} onClose={() => {}} />)
  const sign = screen.getByRole('button', { name: 'Tanda Tangani' })
  expect(screen.getByText('Gigi 16 O (Oklusal): Karies')).toBeInTheDocument()
  expect(sign).toBeDisabled()

  fireEvent.click(screen.getByRole('checkbox'))
  expect(sign).toBeDisabled() // no code yet
  fireEvent.change(screen.getByLabelText('Kode autentikator (6 angka)'), { target: { value: '12a34' } })
  expect(sign).toBeDisabled() // only digits kept: 1234
  fireEvent.click(sign)
  expect(onConfirm).not.toHaveBeenCalled()

  fireEvent.change(screen.getByLabelText('Kode autentikator (6 angka)'), { target: { value: '123456' } })
  expect(sign).toBeEnabled()
  fireEvent.click(sign)
  expect(onConfirm).toHaveBeenCalledWith('123456')
})
