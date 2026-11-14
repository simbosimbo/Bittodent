import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, test, vi } from 'vitest'
import { PatientList } from './Patients'

const rows = [{ id: 'p1', name: 'Sari Sintetis', dob: '1990-02-03', sex: 'perempuan', payer_type: 'umum' },
  { id: 'p2', name: 'Budi Contoh', dob: '1985-07-01', sex: 'laki_laki', payer_type: 'asuransi' }]
const list = (canChart?: boolean) => {
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ data: rows, next_cursor: null }), { status: 200 })))
  render(<PatientList canCreate={false} canChart={canChart} />)
}

afterEach(() => { vi.unstubAllGlobals(); location.hash = '' })

test('each row has a Rekam Medis link when canChart; clicking it does not trigger the row', async () => {
  list(true)
  const link = await screen.findByRole('link', { name: 'Rekam Medis Sari Sintetis' })
  expect(link).toHaveAttribute('href', '#/rekam-medis/p1')
  expect(screen.getByRole('link', { name: 'Rekam Medis Budi Contoh' })).toHaveAttribute('href', '#/rekam-medis/p2')
  fireEvent.click(link)
  expect(location.hash).not.toBe('#/pasien/p1')
})

test('no Rekam Medis link without canChart', async () => {
  list()
  await screen.findByText('Sari Sintetis')
  expect(screen.queryByRole('link', { name: /^Rekam Medis/ })).toBeNull()
})
