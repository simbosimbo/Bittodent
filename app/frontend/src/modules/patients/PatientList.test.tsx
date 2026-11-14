import { fireEvent, render, screen, within } from '@testing-library/react'
import css from './patients.css?raw'
import { afterEach, expect, test, vi } from 'vitest'
import { PatientList } from './Patients'

const rows = [{ id: 'p1', mrn: 'BT-000214', name: 'Sari Sintetis', dob: '1990-02-03', sex: 'perempuan', payer_type: 'umum', status: 'aktif' },
  { id: 'p2', mrn: 'BT-000215', name: 'Budi Contoh', dob: '1985-07-01', sex: 'laki_laki', payer_type: 'asuransi', status: 'tidak_aktif' },
  { id: 'p3', mrn: null, name: 'Nadia Anak Contoh Wijaya Utama', dob: null, sex: null, payer_type: 'umum', status: 'aktif' }]
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

test('long names wrap (no ellipsis/nowrap rule), initials avatar, No. RM from the API (honest fallback when missing)', async () => {
  list()
  const name = await screen.findByRole('link', { name: 'Nadia Anak Contoh Wijaya Utama' })
  expect(name).toHaveClass('pl-name-text')
  const rule = /\.pl-name-text\s*\{([^}]*)\}/.exec(css)?.[1] ?? ''
  expect(rule).toMatch(/white-space:\s*normal/)
  expect(css).not.toMatch(/\.pl-name[^{]*\{[^}]*(ellipsis|nowrap)/)
  const row = name.closest('tr')!
  expect(within(row).getByText('NA')).toHaveClass('avatar')
  expect(within(screen.getByText('Sari Sintetis').closest('tr')!).getByText('SS')).toHaveClass('avatar')
  expect(within(screen.getByText('Sari Sintetis').closest('tr')!).getByText('BT-000214')).toBeInTheDocument()
  expect(within(screen.getByText('Budi Contoh').closest('tr')!).getByText('BT-000215')).toBeInTheDocument()
  expect(row.querySelectorAll('td')[1]).toHaveTextContent('Belum ada') // p3 has no mrn: no invented number
})

test('status badge and Semua / Aktif filter over loaded rows', async () => {
  list()
  await screen.findByText('Sari Sintetis')
  expect(within(screen.getByText('Sari Sintetis').closest('tr')!).getByText('Aktif')).toHaveClass('chip', 'chip-aktif')
  const semua = screen.getByRole('button', { name: 'Semua 3' })
  expect(semua).toHaveAttribute('aria-pressed', 'true')
  const aktif = screen.getByRole('button', { name: 'Aktif 2' })
  fireEvent.click(aktif)
  expect(aktif).toHaveAttribute('aria-pressed', 'true')
  expect(screen.queryByText('Budi Contoh')).toBeNull()
  expect(screen.getByText('Sari Sintetis')).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Tidak aktif 1' }))
  expect(screen.getByText('Budi Contoh')).toBeInTheDocument()
  expect(screen.queryByText('Sari Sintetis')).toBeNull()
  fireEvent.click(semua)
  expect(screen.getByText('Budi Contoh')).toBeInTheDocument()
  expect(screen.getByText('Sari Sintetis')).toBeInTheDocument()
})

test('rows without status show no badge and do not crash', async () => {
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ data: [{ id: 'p9', name: 'Tanpa Status', dob: null, sex: null, payer_type: 'umum' }], next_cursor: null }), { status: 200 })))
  render(<PatientList canCreate={false} />)
  await screen.findByText('Tanpa Status')
  expect(screen.queryByText('Aktif')).toBeNull()
  expect(screen.getByRole('button', { name: 'Semua 1' })).toHaveAttribute('aria-pressed', 'true')
})

const viewport = (w: number) => vi.stubGlobal('matchMedia', (q: string) => ({ media: q, matches: w <= 720, addEventListener() {}, removeEventListener() {} }))

test('390px: cards instead of the table; Rekam Medis link works without opening the profile', async () => {
  viewport(390)
  list(true)
  const cards = await screen.findByRole('list', { name: 'Daftar pasien' })
  expect(document.querySelector('.pl-table')).toBeNull()
  expect(within(cards).getAllByRole('listitem')).toHaveLength(3)
  const card = within(cards).getByText('Sari Sintetis').closest('li')!
  expect(card).toHaveTextContent('Perempuan')
  expect(card).toHaveTextContent('BT-000214')
  expect(within(card).getByText('Aktif')).toHaveClass('chip-aktif')
  expect(within(card).getByRole('link', { name: 'Sari Sintetis' })).toHaveAttribute('href', '#/pasien/p1')
  const rm = within(card).getByRole('link', { name: 'Rekam Medis Sari Sintetis' })
  expect(rm).toHaveAttribute('href', '#/rekam-medis/p1')
  fireEvent.click(rm)
  expect(location.hash).not.toBe('#/pasien/p1')
  fireEvent.click(within(cards).getByText('Budi Contoh').closest('li')!)
  expect(location.hash).toBe('#/pasien/p2')
})

test('1280px: still the table', async () => {
  viewport(1280)
  list()
  await screen.findByText('Sari Sintetis')
  expect(screen.getByRole('table')).toHaveClass('pl-table')
  expect(screen.queryByRole('list', { name: 'Daftar pasien' })).toBeNull()
})
