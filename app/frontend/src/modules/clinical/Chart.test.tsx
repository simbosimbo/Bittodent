import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, expect, test, vi } from 'vitest'
import { clearActivePatients } from '../../shared/activePatient'
import type { Me } from '../../shared/session'
import ChartPage from './Chart'
import { manifest, mockTooth3D } from './tooth3dMock'
import css from './clinical.css?raw'

// Synthetic data only.
const me: Me = {
  user: { id: 'u1', name: 'drg. Uji Sintetis', email: 'dokter@uji.test' }, roles: ['dentist'],
  permissions: ['patient.read', 'note.read', 'note.write', 'note.sign', 'appointment.read'],
  active: { tenant_id: 't1', tenant_name: 'Klinik Sintetis', branch_id: 'b1', branch_name: 'Cabang Uji', timezone: 'Asia/Jakarta' },
  branches: [{ id: 'b1', name: 'Cabang Uji', timezone: 'Asia/Jakarta' }],
}
const patient = { id: 'p1', mrn: 'BT-000007', name: 'Budi Contoh', dob: '1960-01-01', sex: 'laki_laki', payer_type: 'umum' }
const full = { ...patient, nik: null, phone: null, address: null, payer_name: null, payer_member_no: null, payer_class: null }
const chart = { patient, solo_practice: true, baseline: null, findings: [], drafts: [], visits: [] }
const alerts = { version: 1, premedication_required: false, allergies: ['Penisilin'], has_urgent_note: false, full: true, problems: ['Kondisi Sintetis'], medications: [] }

afterEach(() => { act(() => clearActivePatients()); vi.unstubAllGlobals(); delete window.Tooth3D })

test('chart sits inside the patient page (no outer tab bar; Profil/Keluarga/Riwayat in the header menu), formats dates, and links to today\'s appointments without an active visit', async () => {
  vi.stubGlobal('fetch', vi.fn(async (url: string) => new Response(JSON.stringify(url.endsWith('/chart') ? chart : url.endsWith('/alerts') ? alerts : full), { status: 200 })))
  render(<ChartPage patientId="p1" me={me} />)

  const menu = await screen.findByRole('button', { name: 'Menu pasien' })
  expect(screen.queryByRole('navigation', { name: 'Data pasien' })).toBeNull()
  expect(screen.queryByRole('link', { name: 'Keluarga' })).toBeNull()
  fireEvent.click(menu)
  expect(menu).toHaveAttribute('aria-expanded', 'true')
  const pop = menu.parentElement!.querySelector('.menu-pop') as HTMLElement
  expect(within(pop).getAllByRole('link').map((a) => [a.textContent, a.getAttribute('href')])).toEqual([
    ['Profil', '#/pasien/p1'], ['Rekam Medis', '#/rekam-medis/p1'], ['Keluarga', '#/keluarga/p1'], ['Riwayat Medis', '#/riwayat-medis/p1']])
  expect(within(pop).getByRole('link', { name: 'Rekam Medis' })).toHaveAttribute('aria-current', 'page')
  expect(within(pop).getByRole('link', { name: 'Profil' })).not.toHaveAttribute('aria-current')
  fireEvent.keyDown(pop, { key: 'Escape' })
  expect(menu).toHaveAttribute('aria-expanded', 'false')
  expect(menu).toHaveFocus()
  fireEvent.click(menu)
  fireEvent.mouseDown(document.body)
  expect(screen.queryByRole('link', { name: 'Keluarga' })).toBeNull()

  expect(await screen.findByText('Buka janji hari ini')).toHaveAttribute('href', '#/jadwal')
  expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Budi Contoh')
  expect(document.body).not.toHaveTextContent('1960-01-01')
  expect(document.body).toHaveTextContent('1 Jan 1960')
  expect(document.body).toHaveTextContent('Laki-laki · Penjamin Umum')
  expect(document.body).not.toHaveTextContent(/laki_laki|Penjamin umum/)
  expect(screen.queryByRole('button', { name: /mulai kunjungan/i })).toBeNull()
  expect(screen.queryByText(/mulai kunjungan/i)).toBeNull()
})

// --- 2D/3D toggle, dentition, selection sync, findings table (synthetic data; Tooth3D + manifest mocked) ---
const finding = (id: string, tooth: number, surface: string | null, condition: string, status: string, procedure_code: string | null = null) => ({
  id, visit_id: 'v0', tooth, surface, condition, status, procedure_code, supersedes_id: null, state: 'final', source: 'manual', created_by: 'u1', finalized_at: '2026-01-05T03:00:00Z',
})
const findings = [finding('f1', 16, 'O', 'karies', 'kondisi_pantau'), finding('f2', 26, 'L', 'tambalan', 'direncanakan', '23.2'), finding('f3', 11, 'I', 'karies', 'kondisi_pantau')]
const childDob = `${new Date().getFullYear() - 9}-01-01`

function renderChart(over: Record<string, unknown> = {}) {
  const c = { ...chart, findings, ...over }
  window.Tooth3D = mockTooth3D
  vi.stubGlobal('fetch', vi.fn(async (url: string) => new Response(JSON.stringify(
    url.endsWith('manifest.json') ? manifest : url.endsWith('/chart') ? c : url.endsWith('/alerts') ? alerts : full), { status: 200 })))
  return render(<ChartPage patientId="p1" me={me} />)
}
const radio = (group: string, name: string) => within(screen.getByRole('radiogroup', { name: group })).getByRole('radio', { name })
const show3d = async () => { fireEvent.click(radio('Tampilan', '3D')); await waitFor(() => expect(document.querySelector('.t3')).not.toBeNull()) }
const teeth2d = () => [...document.querySelectorAll<SVGElement>('.odontogram .tooth')].map((e) => Number(e.dataset.tooth))
const teeth3d = () => [...new Set([...document.querySelectorAll<HTMLElement>('.t3')].map((e) => Number(e.dataset.tooth)))]

test('Tampilan: default 2D without 3D mount; 3D mounts and 2D unmounts it again', async () => {
  renderChart()
  await screen.findByRole('radiogroup', { name: 'Tampilan' })
  expect(radio('Tampilan', '2D')).toHaveAttribute('aria-checked', 'true')
  expect(radio('Tampilan', '3D')).toHaveAttribute('aria-checked', 'false')
  expect(document.querySelector('.odo3d')).toBeNull()
  expect(document.querySelector('.odontogram')).not.toHaveClass('is-compact')
  await show3d()
  expect(radio('Tampilan', '3D')).toHaveAttribute('aria-checked', 'true')
  expect(document.querySelector('.odontogram')).toHaveClass('is-compact') // 2D stays for per-surface input
  expect(document.body).toHaveTextContent('Tampilan 3D hanya baca')
  fireEvent.click(radio('Tampilan', '2D'))
  expect(document.querySelector('.odo3d')).toBeNull()
})

test('Legenda: open in 2D, collapsed on 3D, reopens on 2D, toggles manually', async () => {
  renderChart()
  await screen.findByRole('radiogroup', { name: 'Tampilan' })
  const legends = () => screen.queryByRole('list', { name: 'Legenda status' })
  expect(legends()).not.toBeNull()
  await show3d()
  expect(legends()).toBeNull()
  expect(screen.queryByRole('list', { name: 'Legenda internal (bukan formulir resmi)' })).toBeNull()
  const btn = screen.getByRole('button', { name: 'Tampilkan legenda' })
  expect(btn).toHaveAttribute('aria-expanded', 'false')
  fireEvent.click(btn)
  expect(legends()).not.toBeNull()
  expect(screen.getByRole('button', { name: 'Sembunyikan legenda' })).toHaveAttribute('aria-expanded', 'true')
  fireEvent.click(radio('Tampilan', '2D'))
  expect(legends()).not.toBeNull()
})

test('3D shows findings as overlays and 2D/3D selection stays in sync', async () => {
  renderChart()
  await screen.findByRole('radiogroup', { name: 'Tampilan' })
  await show3d()
  expect(document.querySelector('.t3[data-tooth="16"] .t3-layer[data-condition="karies"][data-surface="O"]')).not.toBeNull()
  fireEvent.click(document.querySelector('.t3[data-tooth="26"][data-view="occlusal"] .t3-hit[data-surface="L"]')!)
  expect(document.getElementById('t26-L')).toHaveClass('is-sel')
  expect(screen.getByRole('status')).toHaveTextContent('Gigi 26 · Palatal (P)')
  fireEvent.click(document.getElementById('t11-I')!)
  await waitFor(() => expect(document.querySelectorAll('.t3[data-tooth="11"].is-sel').length).toBeGreaterThan(0))
  expect([...document.querySelectorAll<HTMLElement>('.t3-sel.is-sel')].map((e) => [e.closest<HTMLElement>('.t3')!.dataset.tooth, e.dataset.surface]))
    .toEqual([['11', 'I'], ['11', 'I']])
  expect(document.getElementById('t26-L')).not.toHaveClass('is-sel')
})

test('Dentisi: child DOB defaults to Campuran; Sulung / Tetap filter 2D and 3D; baseline wins over DOB', async () => {
  const { unmount } = renderChart({ patient: { ...patient, dob: childDob } })
  await screen.findByRole('radiogroup', { name: 'Dentisi' })
  expect(radio('Dentisi', 'Campuran')).toHaveAttribute('aria-checked', 'true')
  expect(teeth2d()).toHaveLength(52)
  await show3d()
  expect(teeth3d()).toEqual(expect.arrayContaining([11, 51]))

  fireEvent.click(radio('Dentisi', 'Sulung'))
  await waitFor(() => expect(teeth3d()).not.toContain(11))
  for (const list of [teeth2d(), teeth3d()]) {
    expect(list).toHaveLength(20)
    expect(list.every((t) => t >= 51 && t <= 85)).toBe(true)
  }
  fireEvent.click(radio('Dentisi', 'Tetap'))
  await waitFor(() => expect(teeth3d()).not.toContain(51))
  for (const list of [teeth2d(), teeth3d()]) {
    expect(list).toHaveLength(32)
    expect(list.every((t) => t >= 11 && t <= 48)).toBe(true)
  }
  unmount()

  renderChart({ patient: { ...patient, dob: childDob }, baseline: { id: 'b1', version: 1, dentition: 'tetap', teeth: {}, created_at: '2026-01-05T03:00:00Z' } })
  await screen.findByRole('radiogroup', { name: 'Dentisi' })
  expect(radio('Dentisi', 'Tetap')).toHaveAttribute('aria-checked', 'true')
  expect(teeth2d()).not.toContain(51)
})

test('findings table: status, FDI tooth, surface P on upper and I on anterior, ICD-9-CM code; no fee columns', async () => {
  renderChart()
  const table = await screen.findByRole('table', { name: 'Temuan odontogram dan status' })
  expect(within(table).getAllByRole('columnheader').map((h) => h.textContent)).toEqual(['Status', 'Gigi', 'Permukaan', 'Kondisi', 'Kode ICD-9-CM', 'Ubah status'])
  const row = (t: number) => within(table).getAllByRole('row').find((r) => r.querySelectorAll('td')[1]?.textContent === String(t))!
  expect(row(26)).toHaveTextContent('P (Palatal)')
  expect(row(26)).toHaveTextContent('23.2')
  expect(row(26)).toHaveTextContent('Direncanakan')
  expect(row(11)).toHaveTextContent('I (Insisal)')
  expect(row(11)).not.toHaveTextContent('O (Oklusal)')
  expect(row(16)).toHaveTextContent('O (Oklusal)')
  expect(table).not.toHaveTextContent(/Biaya|Prioritas|Total/)
  expect(screen.getByRole('list', { name: 'Legenda status' })).toHaveTextContent('Sudah ada (tempat lain)')
})

// --- Layout: compact header, inner tabs, odontogram 8 + tooth panel 4 (synthetic data) ---
const visit = { id: 'v1', appointment_id: null, branch_id: 'b1', started_at: '2026-01-05T03:00:00Z', status: 'berlangsung',
  dentist: { id: 'u1', name: 'drg. Uji Sintetis' }, notes: [], draft_findings: [] }
const pad = () => within(screen.getByRole('group', { name: 'Permukaan' }))
const surfaces = () => pad().getAllByRole('button').map((b) => b.textContent)

test('header: allergy chip always visible from one alerts fetch, No. RM from the API', async () => {
  renderChart()
  const head = await screen.findByRole('region', { name: 'Peringatan medis pasien' })
  expect(await within(head).findByText('Alergi: Penisilin')).toBeVisible()
  expect(within(head).queryByText(/Kondisi Sintetis/)).toBeNull() // minor chips behind Selengkapnya
  expect(document.body).toHaveTextContent('No. RM: BT-000007')
  expect(vi.mocked(fetch).mock.calls.filter(([u]) => String(u).endsWith('/alerts'))).toHaveLength(1)
})

test('odontogram region + tooth detail panel; surface keypad uses clinical labels and 44px targets', async () => {
  const style = document.head.appendChild(document.createElement('style'))
  style.textContent = css
  renderChart()
  await screen.findByRole('region', { name: 'Odontogram' })
  const panel = screen.getByRole('complementary', { name: 'Detail gigi' })
  expect(panel).toHaveTextContent('Pilih gigi untuk melihat detail')

  fireEvent.click(document.getElementById('t16-O')!)
  expect(within(panel).getByRole('heading', { name: 'Gigi 16' })).toBeInTheDocument()
  expect(surfaces()).toEqual(['P', 'M', 'O', 'D', 'B']) // upper posterior: O, lingual shown as P
  expect(pad().queryByRole('button', { name: 'I' })).toBeNull()
  for (const b of pad().getAllByRole('button')) {
    const cs = getComputedStyle(b)
    expect(parseFloat(cs.minWidth)).toBeGreaterThanOrEqual(44)
    expect(parseFloat(cs.minHeight)).toBeGreaterThanOrEqual(44)
  }
  expect(pad().getByRole('button', { name: 'O' })).toHaveAttribute('aria-pressed', 'true')
  fireEvent.click(pad().getByRole('button', { name: 'M' }))
  expect(document.getElementById('t16-M')).toHaveClass('is-sel')
  expect(pad().getByRole('button', { name: 'M' })).toHaveAttribute('aria-pressed', 'true')
  expect(within(panel).getByRole('status')).toHaveTextContent('Gigi 16 · Mesial (M)')
  expect(within(panel).getByRole('list', { name: 'Temuan gigi 16' })).toHaveTextContent('Karies')
  expect(within(panel).queryByRole('group', { name: 'Pilih kondisi' })).toBeNull() // no active visit: read-only

  fireEvent.click(document.getElementById('t11-I')!)
  expect(surfaces()).toContain('I')
  expect(surfaces()).not.toContain('O')
  fireEvent.click(document.getElementById('t36-O')!)
  expect(surfaces()).toEqual(['L', 'M', 'O', 'D', 'B']) // lower: lingual stays L
  expect(surfaces()).not.toContain('P')

  fireEvent.click(within(panel).getByRole('button', { name: 'Tutup detail gigi' }))
  expect(panel).toHaveTextContent('Pilih gigi untuk melihat detail')
  style.remove()
})

test('active visit: panel offers conditions; inner tab Catatan Klinis shows SOAP, Odontogram brings the chart back', async () => {
  renderChart({ visits: [visit] })
  await screen.findByRole('region', { name: 'Odontogram' })
  expect(screen.getByRole('tab', { name: 'Odontogram' })).toHaveAttribute('aria-selected', 'true')
  expect(screen.queryByRole('heading', { name: 'Catatan SOAP' })).toBeNull()
  fireEvent.click(document.getElementById('t26-L')!)
  const picker = within(screen.getByRole('complementary', { name: 'Detail gigi' })).getByRole('group', { name: 'Pilih kondisi' })
  expect(within(picker).getByRole('button', { name: 'Karies' })).toBeInTheDocument()
  expect(within(picker).getByRole('button', { name: 'Mahkota' })).toBeInTheDocument()

  fireEvent.click(screen.getByRole('tab', { name: 'Catatan Klinis' }))
  expect(screen.getByRole('heading', { name: 'Catatan SOAP' })).toBeInTheDocument()
  expect(screen.getByRole('heading', { name: 'Riwayat kunjungan' })).toBeInTheDocument()
  expect(screen.queryByRole('region', { name: 'Odontogram' })).toBeNull()
  fireEvent.click(screen.getByRole('tab', { name: 'Resep' }))
  expect(document.body).toHaveTextContent('Belum tersedia')
  fireEvent.click(screen.getByRole('tab', { name: 'Odontogram' }))
  expect(screen.getByRole('region', { name: 'Odontogram' })).toBeInTheDocument()
})

test('390px: selecting a tooth opens a bottom sheet named for the tooth; keypad labels + 44px; backdrop closes and clears the pick', async () => {
  vi.stubGlobal('matchMedia', (q: string) => ({ media: q, matches: true, addEventListener() {}, removeEventListener() {} }))
  const style = document.head.appendChild(document.createElement('style'))
  style.textContent = css
  renderChart({ visits: [visit] })
  await screen.findByRole('region', { name: 'Odontogram' })
  expect(screen.queryByRole('complementary', { name: 'Detail gigi' })).toBeNull()
  expect(screen.queryByRole('dialog')).toBeNull()

  fireEvent.click(document.getElementById('t16-O')!)
  const sheet = screen.getByRole('dialog', { name: 'Detail gigi 16' })
  expect(sheet).toHaveClass('tooth-sheet')
  expect(surfaces()).toEqual(['P', 'M', 'O', 'D', 'B'])
  for (const b of pad().getAllByRole('button')) {
    expect(parseFloat(getComputedStyle(b).minWidth)).toBeGreaterThanOrEqual(44)
    expect(parseFloat(getComputedStyle(b).minHeight)).toBeGreaterThanOrEqual(44)
  }
  expect(within(sheet).getByRole('group', { name: 'Pilih kondisi' })).toBeInTheDocument() // same editable rule as desktop
  expect(within(sheet).getByRole('button', { name: 'Tutup detail gigi' })).toHaveFocus()

  fireEvent.click(document.querySelector('.sheet-backdrop')!)
  expect(screen.queryByRole('dialog')).toBeNull()
  expect(document.querySelector('.tooth-surface.is-sel')).toBeNull()

  fireEvent.click(document.getElementById('t36-O')!)
  expect(surfaces()).toEqual(['L', 'M', 'O', 'D', 'B'])
  fireEvent.keyDown(screen.getByRole('dialog', { name: 'Detail gigi 36' }), { key: 'Escape' })
  expect(screen.queryByRole('dialog')).toBeNull()
  style.remove()
})
