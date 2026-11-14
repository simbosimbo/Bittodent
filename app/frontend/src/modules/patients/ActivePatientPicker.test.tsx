import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, expect, test, vi } from 'vitest'
import { clearActivePatients, setActivePatient } from '../../shared/activePatient'
import { Shell } from '../../shared/layout/Shell'
import type { Me } from '../../shared/session'
import css from '../../shared/ui/styles.css?raw'
import { ActivePatientPicker } from './ActivePatientPicker'

const me: Me = {
  user: { id: 'u1', name: 'drg. Uji Sintetis', email: 'dokter@uji.test' }, roles: ['dentist'], permissions: ['patient.read'],
  active: { tenant_id: 't1', tenant_name: 'Klinik Gigi Sintetis Sejahtera Abadi', branch_id: 'b1', branch_name: 'Cabang Uji', timezone: 'Asia/Jakarta' },
  branches: [{ id: 'b1', name: 'Cabang Uji', timezone: 'Asia/Jakarta' }],
}
const nadia = { id: 'p1', name: 'Nadia Anak Contoh' }
const budi = { id: 'p2', name: 'Budi Santoso' }
const stubSearch = (data: object[]) =>
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ data, next_cursor: null }), { status: 200 })))
// The picker is no longer mounted in the chrome (sketch top bar has none); tested standalone next to a Shell.
const shell = () => render(<><ActivePatientPicker /><Shell me={me} nav={[]} active={undefined} onSwitchBranch={() => {}} onLogout={() => {}}><p>isi</p></Shell></>)
const pill = () => screen.getByRole('button', { name: /Pasien aktif/ })
const dialog = () => screen.queryByRole('dialog', { name: 'Pilih pasien aktif' })

afterEach(() => { act(() => clearActivePatients()); vi.unstubAllGlobals(); vi.restoreAllMocks(); document.head.innerHTML = '' })

test('empty pill opens a popover with "Terakhir dibuka"; picking a recent sets it and closes, no fetch', () => {
  stubSearch([])
  act(() => { setActivePatient(nadia); setActivePatient(budi); setActivePatient(null) }) // × keeps recents
  shell()
  expect(pill()).toHaveTextContent('Pilih pasien')
  fireEvent.click(pill())
  const pop = dialog()!
  expect(within(pop).getByText('Terakhir dibuka')).toBeInTheDocument()
  expect(within(pop).getAllByRole('button').map((b) => b.textContent)).toEqual(['Budi Santoso', 'Nadia Anak Contoh'])
  fireEvent.click(within(pop).getByRole('button', { name: 'Nadia Anak Contoh' }))
  expect(dialog()).toBeNull()
  expect(pill()).toHaveTextContent('Nadia Anak Contoh')
  expect(fetch).not.toHaveBeenCalled()
})

test('search by name/NIK/HP uses the patients API; selecting sets active patient and closes', async () => {
  stubSearch([{ id: 'p9', name: 'Sari Sintetis', dob: '1990-02-03', sex: 'perempuan', payer_type: 'umum' }])
  shell()
  fireEvent.click(pill())
  fireEvent.change(screen.getByRole('searchbox', { name: 'Cari pasien aktif' }), { target: { value: 'sari' } })
  fireEvent.click(await screen.findByRole('button', { name: /Sari Sintetis/ }))
  expect(vi.mocked(fetch).mock.calls[0][0]).toBe('/api/patients?q=sari')
  expect(dialog()).toBeNull()
  expect(pill()).toHaveTextContent('Sari Sintetis')
  expect(screen.getByRole('button', { name: 'Tutup pasien aktif' })).toBeInTheDocument()
})

test('recents stay in memory only and are cleared on logout', () => {
  const setItem = vi.spyOn(Storage.prototype, 'setItem')
  act(() => setActivePatient(nadia))
  shell()
  fireEvent.click(pill())
  expect(within(dialog()!).getByRole('button', { name: 'Nadia Anak Contoh' })).toBeInTheDocument()
  expect(setItem).not.toHaveBeenCalled()
  expect(localStorage.length + sessionStorage.length).toBe(0)
  act(() => clearActivePatients())
  expect(pill()).toHaveTextContent('Pilih pasien')
  expect(within(dialog()!).getByText('Belum ada pasien yang dibuka.')).toBeInTheDocument()
})

test('active patient name is never clipped by ellipsis; the clinic name lives in the sidebar and ellipsizes there', () => {
  const style = document.createElement('style')
  style.textContent = css
  document.head.append(style)
  act(() => setActivePatient(nadia))
  shell()
  const name = screen.getByText('Nadia Anak Contoh')
  expect(getComputedStyle(name).textOverflow).not.toBe('ellipsis')
  expect(getComputedStyle(name).overflow).not.toBe('hidden')
  expect(getComputedStyle(name).whiteSpace).toBe('nowrap')
  expect(getComputedStyle(name.closest('.aps')!).flexShrink).toBe('0') // the pill never shrinks; search gives way
  const clinic = screen.getByText(me.active.tenant_name)
  expect(clinic.closest('header.shell-top')).toBeNull()
  expect(clinic.closest('.shell-side .shell-clinic')).not.toBeNull()
  expect(getComputedStyle(clinic).textOverflow).toBe('ellipsis')
  expect(getComputedStyle(clinic).overflow).toBe('hidden')
})
