import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, test, vi } from 'vitest'
import { applyImpersonation, type Me } from '../session'
import { ImpersonationBanner } from './ImpersonationBanner'

const base: Me = {
  user: { id: 'u1', name: 'Pemilik Senyum (dummy)', email: 'pemilik@senyum.test' },
  roles: ['owner', 'dentist'],
  permissions: ['patient.read', 'note.sign', 'correction.approve', 'settings.manage'],
  active: { tenant_id: 't1', tenant_name: 'Klinik Gigi Senyum Sehat', branch_id: 'b1', branch_name: 'Kemang', timezone: 'Asia/Jakarta' },
  branches: [],
  impersonation: { active: false },
}
const acting: Me = { ...base, impersonation: { active: true, platform_admin_name: 'Admin Platform', started_at: '2026-11-15T02:30:00Z',
  blocked_actions: ['selesai', 'approve_drafts', 'addendum', 'procedure_correction', 'correction_decision', 'password', 'mfa', 'pin'] } }

afterEach(() => vi.unstubAllGlobals())

test('shows who acts as whom, in which clinic, since when (WIB)', () => {
  render(<ImpersonationBanner me={acting} />)
  const banner = screen.getByRole('alert')
  expect(banner).toHaveTextContent('Anda masuk sebagai Pemilik Senyum (dummy) (klinik Klinik Gigi Senyum Sehat) oleh Admin Platform sejak')
  expect(banner).toHaveTextContent('09.30 WIB')
})

test('renders nothing when not impersonating', () => {
  const { container } = render(<ImpersonationBanner me={base} />)
  expect(container).toBeEmptyDOMElement()
})

test('Berhenti stops the impersonation and goes to the platform page', async () => {
  document.cookie = 'XSRF-TOKEN=abc'
  const fetch = vi.fn(async () => new Response(JSON.stringify({ impersonation: { active: false } }), { status: 200 }))
  vi.stubGlobal('fetch', fetch)
  render(<ImpersonationBanner me={acting} />)
  fireEvent.click(screen.getByRole('button', { name: 'Berhenti' }))
  await vi.waitFor(() => expect(location.hash).toBe('#/platform'))
  expect(fetch).toHaveBeenCalledWith('/api/platform/impersonate/stop', expect.objectContaining({ method: 'POST' }))
})

test('blocked actions hide their buttons by dropping the gating permissions', () => {
  expect(applyImpersonation(acting).permissions).toEqual(['patient.read', 'settings.manage'])
  expect(applyImpersonation(base).permissions).toEqual(base.permissions)
})
