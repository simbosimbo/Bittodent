import { act, render, screen } from '@testing-library/react'
import { afterEach, expect, test, vi } from 'vitest'
import { setActivePatient } from '../../shared/activePatient'
import { Shell } from '../../shared/layout/Shell'
import type { Me } from '../../shared/session'
import { AlertRibbon } from './AlertRibbon'

const me: Me = {
  user: { id: 'u1', name: 'drg. Uji Sintetis', email: 'dokter@uji.test' }, roles: ['dentist'], permissions: ['patient.read', 'note.read'],
  active: { tenant_id: 't1', tenant_name: 'Klinik Uji', branch_id: 'b1', branch_name: 'Cabang Uji', timezone: 'Asia/Jakarta' },
  branches: [{ id: 'b1', name: 'Cabang Uji', timezone: 'Asia/Jakarta' }],
}
const alerts = (over = {}) => ({ version: 2, premedication_required: true, allergies: ['Penisilin'], has_urgent_note: true, full: true,
  urgent_note: 'Riwayat pingsan saat anestesi', problems: ['Hipertensi'], medications: ['Amlodipin'], ...over })
const stub = (body: object) => vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(body), { status: 200 })))
const shell = () => render(<Shell me={me} nav={[]} active={undefined} ribbon={<AlertRibbon patientId="p1" />} onSwitchBranch={() => {}} onLogout={() => {}}><p>isi</p></Shell>)

afterEach(() => { act(() => setActivePatient(null)); vi.unstubAllGlobals() })

test('ribbon is hidden without an active patient', () => {
  stub(alerts())
  shell()
  expect(screen.queryByRole('region', { name: 'Peringatan medis pasien aktif' })).toBeNull()
})

test('active patient shows one chip per alert type, premedication + urgent note first', async () => {
  stub(alerts())
  act(() => setActivePatient({ id: 'p1', name: 'Sari Sintetis' }))
  shell()
  expect(await screen.findByText('Alergi: Penisilin')).toBeInTheDocument()
  expect(vi.mocked(fetch).mock.calls[0][0]).toBe('/api/patients/p1/alerts')
  const types = [...document.querySelectorAll('.alert-chip')].map((c) => c.getAttribute('data-type'))
  expect(types).toEqual(['premedikasi', 'catatan_penting', 'alergi', 'penyakit', 'obat'])
  expect(screen.getByText('Perlu premedikasi')).toHaveClass('alert-premedikasi')
  expect(screen.getByText('Penting: Riwayat pingsan saat anestesi')).toHaveClass('alert-catatan_penting')
  expect(screen.getByText('Kondisi: Hipertensi')).toBeInTheDocument()
  expect(screen.getByText('Obat: Amlodipin')).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Riwayat medis →' })).toHaveAttribute('href', '#/riwayat-medis/p1')
})

test('front desk (not full): allergy + premed + urgent flag without its text; empty states', async () => {
  stub(alerts({ full: false, urgent_note: undefined, problems: undefined, medications: undefined }))
  act(() => setActivePatient({ id: 'p1', name: 'Sari Sintetis' }))
  const { unmount } = shell()
  expect(await screen.findByText('Ada catatan penting (tanyakan dokter)')).toBeInTheDocument()
  expect(screen.getByText('Alergi: Penisilin')).toBeInTheDocument()
  expect(screen.queryByText(/Hipertensi|Amlodipin/)).toBeNull()
  expect(screen.queryByRole('link', { name: 'Riwayat medis →' })).toBeNull()
  unmount()

  stub(alerts({ version: null, premedication_required: false, allergies: [], has_urgent_note: false, urgent_note: null, problems: [], medications: [] }))
  shell()
  expect(await screen.findByText('Riwayat medis belum diisi')).toBeInTheDocument()
})

test('compact (chart route): safety + condition chips always shown, medications behind Selengkapnya', async () => {
  stub(alerts())
  act(() => setActivePatient({ id: 'p1', name: 'Sari Sintetis' }))
  render(<AlertRibbon patientId="p1" compactDefault />)
  expect(await screen.findByText('Alergi: Penisilin')).toBeInTheDocument()
  expect(screen.getByText('Perlu premedikasi')).toBeInTheDocument()
  expect(screen.getByText('Penting: Riwayat pingsan saat anestesi')).toBeInTheDocument()
  const cond = screen.getByText('Hipertensi') // bare condition text; type stays in the accessible name
  expect(cond).toHaveClass('alert-penyakit')
  expect(cond).toHaveTextContent('Kondisi: Hipertensi')
  expect(screen.queryByText('Obat: Amlodipin')).toBeNull()
  expect(screen.getByRole('link', { name: 'Riwayat medis →' })).toBeInTheDocument()
  const more = screen.getByRole('button', { name: /Selengkapnya/ })
  expect(more).toHaveAttribute('aria-expanded', 'false')
  expect(more).toHaveTextContent('+1 lainnya')
  act(() => more.click())
  expect(screen.getByText('Kondisi: Hipertensi')).toBeInTheDocument()
  expect(screen.getByText('Obat: Amlodipin')).toBeInTheDocument()
  act(() => screen.getByRole('button', { name: 'Ciutkan' }).click())
  expect(screen.queryByText('Obat: Amlodipin')).toBeNull()
  expect(screen.getByText('Hipertensi')).toBeInTheDocument()
  expect(screen.getByText('Alergi: Penisilin')).toBeInTheDocument()
})

test('compact keeps empty safety states visible', async () => {
  stub(alerts({ premedication_required: false, has_urgent_note: false, allergies: [], problems: ['Diabetes'] }))
  act(() => setActivePatient({ id: 'p1', name: 'Sari Sintetis' }))
  const { unmount } = render(<AlertRibbon patientId="p1" compactDefault />)
  expect(await screen.findByText('Tidak ada alergi tercatat')).toBeInTheDocument()
  expect(screen.getByText('Diabetes')).toBeInTheDocument()
  unmount()

  stub(alerts({ version: null }))
  render(<AlertRibbon patientId="p1" compactDefault />)
  expect(await screen.findByText('Riwayat medis belum diisi')).toBeInTheDocument()
})
