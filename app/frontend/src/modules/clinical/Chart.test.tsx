import { act, render, screen, within } from '@testing-library/react'
import { afterEach, expect, test, vi } from 'vitest'
import { clearActivePatients } from '../../shared/activePatient'
import type { Me } from '../../shared/session'
import ChartPage from './Chart'

// Synthetic data only.
const me: Me = {
  user: { id: 'u1', name: 'drg. Uji Sintetis', email: 'dokter@uji.test' }, roles: ['dentist'],
  permissions: ['patient.read', 'note.read', 'note.write', 'note.sign', 'appointment.read'],
  active: { tenant_id: 't1', tenant_name: 'Klinik Sintetis', branch_id: 'b1', branch_name: 'Cabang Uji', timezone: 'Asia/Jakarta' },
  branches: [{ id: 'b1', name: 'Cabang Uji', timezone: 'Asia/Jakarta' }],
}
const patient = { id: 'p1', name: 'Budi Contoh', dob: '1960-01-01', sex: 'laki_laki', payer_type: 'umum' }
const full = { ...patient, nik: null, phone: null, address: null, payer_name: null, payer_member_no: null, payer_class: null }
const chart = { patient, solo_practice: true, baseline: null, findings: [], drafts: [], visits: [] }

afterEach(() => { act(() => clearActivePatients()); vi.unstubAllGlobals() })

test('chart sits inside the patient tabs, formats dates, and links to today\'s appointments without an active visit', async () => {
  vi.stubGlobal('fetch', vi.fn(async (url: string) => new Response(JSON.stringify(url.endsWith('/chart') ? chart : full), { status: 200 })))
  render(<ChartPage patientId="p1" me={me} />)

  const tabs = await screen.findByRole('navigation', { name: 'Data pasien' })
  expect(within(tabs).getByRole('link', { name: 'Rekam Medis' })).toHaveAttribute('aria-current', 'page')
  expect(within(tabs).getByRole('link', { name: 'Profil' })).toHaveAttribute('href', '#/pasien/p1')
  expect(within(tabs).getByRole('link', { name: 'Keluarga' })).toHaveAttribute('href', '#/keluarga/p1')
  expect(within(tabs).getByRole('link', { name: 'Riwayat Medis' })).toHaveAttribute('href', '#/riwayat-medis/p1')

  expect(await screen.findByText('Buka janji hari ini')).toHaveAttribute('href', '#/jadwal')
  expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Budi Contoh')
  expect(document.body).not.toHaveTextContent('1960-01-01')
  expect(document.body).toHaveTextContent('1 Jan 1960')
  expect(document.body).toHaveTextContent('Laki-laki · Penjamin Umum')
  expect(document.body).not.toHaveTextContent(/laki_laki|Penjamin umum/)
  expect(screen.queryByRole('button', { name: /mulai kunjungan/i })).toBeNull()
  expect(screen.queryByText(/mulai kunjungan/i)).toBeNull()
})
