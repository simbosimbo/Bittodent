import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, expect, test, vi } from 'vitest'
import { clearActivePatients } from '../../shared/activePatient'
import type { Me } from '../../shared/session'
import ChartPage, { visitStatusText } from './Chart'
import { manifest, mockTooth3D } from './tooth3dMock'
import css from './clinical.css?raw'
import baseCss from '../../shared/ui/styles.css?raw'

// Synthetic data only.
const me: Me = {
  user: { id: 'u1', name: 'drg. Uji Sintetis', email: 'dokter@uji.test' }, roles: ['dentist'],
  permissions: ['patient.read', 'note.read', 'note.write', 'note.sign', 'appointment.read'],
  active: { tenant_id: 't1', tenant_name: 'Klinik Sintetis', branch_id: 'b1', branch_name: 'Cabang Uji', timezone: 'Asia/Jakarta' },
  branches: [{ id: 'b1', name: 'Cabang Uji', timezone: 'Asia/Jakarta' }],
}
const patient = { id: 'p1', mrn: 'BT-000007', name: 'Budi Contoh', dob: '1960-01-01', sex: 'laki_laki', payer_type: 'umum' }
const full = { ...patient, nik: null, phone: null, address: null, payer_name: null, payer_member_no: null, payer_class: null }
const chart = { as_of: null, procedure_history: [], patient, solo_practice: true, baseline: null, findings: [], drafts: [], procedures: [], procedure_drafts: [], pending_externals: [], visits: [] }
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
  expect(document.body).not.toHaveTextContent('1 Jan 1960') // DOB + payer live on Profil, not the compact header
  expect(document.body).toHaveTextContent(/\d+ tahun · Laki-laki · No\. RM BT-000007/)
  expect(document.body).not.toHaveTextContent(/laki_laki|Penjamin| th\b/)
  expect(screen.getByRole('button', { name: 'Mulai kunjungan' })).toBeEnabled() // dentist: walk-in without a booking
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

test('findings table: Tanggal/Gigi/Permukaan/Kondisi/Dokter/Status, P on upper, I on anterior, procedure row with ICD-9-CM code + status; no fee columns', async () => {
  const proc = { id: 'pr1', visit_id: 'v0', treat_area: 'surface', tooth: 26, surfaces: 'L', tooth_range: null, quadrant: null, arch: null, status: 'direncanakan',
    procedure_code: '23.2', variant: 'standar', diagnosis_code: null, provider_id: 'u1', state: 'final', source: 'manual', supersedes_id: null, created_by: 'u1',
    finalized_at: '2026-01-05T03:00:00Z', paint_type: 'Filling', name: 'Tumpatan', layman: null, external_clinic_name: null, external_date: null, external_date_precision: null }
  renderChart({ procedures: [proc] })
  const table = await screen.findByRole('table', { name: 'Temuan & tindakan' })
  expect(within(table).getAllByRole('columnheader').map((h) => h.textContent)).toEqual(['Tanggal', 'Gigi', 'Permukaan', 'Kondisi / tindakan', 'Dokter', 'Status'])
  const row = (t: number) => within(table).getAllByRole('row').find((r) => r.querySelectorAll('td')[1]?.textContent === String(t))!
  expect(row(26)).toHaveTextContent('P (Palatal)')
  expect(row(26)).toHaveTextContent('Tambalan')
  const treat = within(table).getAllByRole('row').find((r) => r.textContent?.includes('ICD-9-CM 23.2'))!
  expect(treat).toHaveTextContent('Gigi 26 P: Tumpatan (ICD-9-CM 23.2)')
  expect(treat).toHaveTextContent('Direncanakan')
  expect(row(26).querySelectorAll('td')[0]).toHaveTextContent('5 Jan 2026') // finalized_at in Asia/Jakarta
  expect(row(26).querySelectorAll('td')[4]).toHaveTextContent(/^—$/) // visit v0 not in chart.visits: no invented name
  expect(row(11)).toHaveTextContent('I (Insisal)')
  expect(row(11)).not.toHaveTextContent('O (Oklusal)')
  expect(row(16)).toHaveTextContent('O (Oklusal)')
  expect(table).not.toHaveTextContent(/Biaya|Prioritas|Total/)
  expect(screen.getByRole('list', { name: 'Legenda status' })).toHaveTextContent('Sudah ada (tempat lain)')
})

test('findings table: dentist from the finding\'s visit, drafts show "Draf" and sort first, then newest date, then tooth', async () => {
  const old = { ...finding('f4', 36, null, 'mahkota', 'selesai'), visit_id: 'v1', finalized_at: '2025-03-01T03:00:00Z' }
  const draft = { ...finding('d1', 47, 'O', 'karies', 'kondisi_pantau'), visit_id: 'v1', state: 'draft', finalized_at: null }
  renderChart({ visits: [{ ...visit, dentist: { id: 'u2', name: 'Nadia Putri' } }], findings: [...findings, old], drafts: [draft] })
  const table = await screen.findByRole('table', { name: 'Temuan & tindakan' })
  const rows = within(table).getAllByRole('row').slice(1)
  expect(rows.map((r) => r.querySelectorAll('td')[1].textContent)).toEqual(['47', '11', '16', '26', '36'])
  expect(rows[0].querySelectorAll('td')[0]).toHaveTextContent(/^Draf$/)
  expect(rows[0].querySelectorAll('td')[4]).toHaveTextContent(/^drg\. Nadia Putri$/)
  expect(rows[4]).toHaveTextContent('1 Mar 2025')
  expect(rows[4]).toHaveTextContent('Seluruh gigi')
  expect(rows[4].querySelectorAll('td')[4]).toHaveTextContent('drg. Nadia Putri')
})

test('summary line counts current findings + my drafts in legend order; empty chart says "Belum ada temuan."', async () => {
  const draft = { ...finding('d1', 47, null, 'sisa_akar', 'kondisi_pantau'), visit_id: 'v1', state: 'draft', finalized_at: null }
  const { unmount } = renderChart({ visits: [visit], drafts: [draft] })
  expect(await screen.findByRole('note', { name: 'Ringkasan temuan' })).toHaveTextContent(/^2 karies · 1 tambalan · 1 sisa akar \/ akar tertinggal$/)
  unmount()
  renderChart({ findings: [] })
  expect(await screen.findByRole('note', { name: 'Ringkasan temuan' })).toHaveTextContent(/^Belum ada temuan\.$/)
  const sec = screen.getByRole('region', { name: 'Temuan & tindakan' })
  expect(sec).toHaveTextContent('Belum ada temuan.')
  expect(within(sec).queryByRole('table')).toBeNull()
  expect(within(sec).getAllByRole('radio').map((b) => b.textContent)).toEqual(['Semua gigi'])
})

test('filter: picked tooth starts on "Gigi N"; Semua gigi shows all again; empty tooth says so; no extra fetch', async () => {
  renderChart()
  const table = await screen.findByRole('table', { name: 'Temuan & tindakan' })
  const teeth = () => within(screen.getByRole('region', { name: 'Temuan & tindakan' })).queryAllByRole('row').slice(1).map((r) => r.querySelectorAll('td')[1].textContent)
  const filter = () => within(screen.getByRole('radiogroup', { name: 'Saring temuan' }))
  expect(teeth()).toHaveLength(3)
  expect(table).toBeInTheDocument()
  const calls = vi.mocked(fetch).mock.calls.length
  fireEvent.click(document.getElementById('t16-O')!)
  expect(filter().getByRole('radio', { name: 'Gigi 16' })).toHaveAttribute('aria-checked', 'true')
  expect(teeth()).toEqual(['16'])
  fireEvent.click(filter().getByRole('radio', { name: 'Semua gigi' }))
  expect(filter().getByRole('radio', { name: 'Semua gigi' })).toHaveAttribute('aria-checked', 'true')
  expect(teeth()).toHaveLength(3)
  fireEvent.click(filter().getByRole('radio', { name: 'Gigi 16' }))
  expect(teeth()).toEqual(['16'])
  fireEvent.click(document.getElementById('t36-O')!)
  expect(screen.getByRole('region', { name: 'Temuan & tindakan' })).toHaveTextContent('Tidak ada temuan pada gigi ini.')
  fireEvent.click(screen.getByRole('button', { name: 'Tutup detail gigi' }))
  expect(filter().getAllByRole('radio').map((b) => b.textContent)).toEqual(['Semua gigi'])
  expect(teeth()).toHaveLength(3)
  expect(vi.mocked(fetch).mock.calls.length).toBe(calls)
})

test('Simpan ke kunjungan hari ini: condition is only chosen (aria-pressed) until the button POSTs it; disabled without a condition', async () => {
  renderChart({ visits: [visit] })
  await screen.findByRole('region', { name: 'Odontogram' })
  fireEvent.click(document.getElementById('t26-L')!)
  const panel = within(screen.getByRole('complementary', { name: 'Detail gigi' }))
  const save = panel.getByRole('button', { name: 'Simpan ke kunjungan hari ini' })
  expect(save).toBeDisabled()
  expect(save).toHaveAccessibleDescription('Pilih kondisi terlebih dahulu')
  const posts = () => vi.mocked(fetch).mock.calls.filter(([u]) => String(u).endsWith('/findings'))
  fireEvent.click(panel.getByRole('button', { name: 'Karies' }))
  fireEvent.click(panel.getByRole('button', { name: 'Tambalan' }))
  expect(panel.getByRole('button', { name: 'Tambalan' })).toHaveAttribute('aria-pressed', 'true')
  expect(panel.getByRole('button', { name: 'Karies' })).toHaveAttribute('aria-pressed', 'false')
  expect(posts()).toHaveLength(0)
  expect(save).toBeEnabled()
  fireEvent.click(save)
  expect(save).toBeDisabled() // in flight
  await waitFor(() => expect(posts()).toHaveLength(1))
  const [url, init] = posts()[0]
  expect(url).toBe('/api/visits/v1/findings')
  expect(init).toMatchObject({ method: 'POST' })
  expect(JSON.parse(init!.body as string)).toEqual({ tooth: 26, surface: 'L', condition: 'tambalan' }) // condition only: treatments are procedures
  expect(await screen.findByText('Temuan tersimpan sebagai draf di kunjungan hari ini.')).toBeInTheDocument()
  expect(panel.getByRole('heading', { name: 'Gigi 26' })).toBeInTheDocument() // tooth stays picked
  expect(panel.getByRole('button', { name: 'Tambalan' })).toHaveAttribute('aria-pressed', 'false')
  expect(save).toBeDisabled()
})

test('Simpan ke kunjungan hari ini: disabled with an honest reason and no POST when there is no active visit', async () => {
  renderChart()
  await screen.findByRole('region', { name: 'Odontogram' })
  fireEvent.click(document.getElementById('t16-O')!)
  const save = within(screen.getByRole('complementary', { name: 'Detail gigi' })).getByRole('button', { name: 'Simpan ke kunjungan hari ini' })
  expect(save).toBeDisabled()
  expect(save).toHaveAccessibleDescription('Belum ada kunjungan aktif. Mulai kunjungan dulu.')
  fireEvent.click(save)
  expect(screen.getByText('Buka janji hari ini')).toHaveAttribute('href', '#/jadwal')
  expect(vi.mocked(fetch).mock.calls.some(([, i]) => (i as RequestInit | undefined)?.method === 'POST')).toBe(false)
})

// --- Walk-in: "Mulai kunjungan" without an appointment (synthetic data) ---
function walkInFetch(post: { status: number; body: unknown } = { status: 201, body: { id: 'v1' } }) {
  let started = false
  window.Tooth3D = mockTooth3D
  vi.stubGlobal('fetch', vi.fn(async (url: string) => {
    if (url.endsWith('/visits/walk-in')) { started = post.status < 300; return new Response(JSON.stringify(post.body), { status: post.status }) }
    if (url.endsWith('/findings')) return new Response(JSON.stringify({ id: 'f9' }), { status: 201 })
    const body = url.endsWith('/api/dentists') ? { data: [{ id: 'd1', name: 'drg. Sintetis Satu' }] } : url.endsWith('manifest.json') ? manifest
      : url.endsWith('/chart') ? { ...chart, visits: started ? [visit] : [] } : url.endsWith('/alerts') ? alerts : full
    return new Response(JSON.stringify(body), { status: 200 })
  }))
}
const walkInPosts = () => vi.mocked(fetch).mock.calls.filter(([u]) => String(u).endsWith('/visits/walk-in'))

test('Mulai kunjungan: dentist starts a walk-in, chart reloads onto the new visit, and a chosen condition can be saved', async () => {
  walkInFetch()
  render(<ChartPage patientId="p1" me={me} />)
  const start = await screen.findByRole('button', { name: 'Mulai kunjungan' })
  expect(screen.getByRole('link', { name: 'Buka janji hari ini' })).toHaveAttribute('href', '#/jadwal') // still there for booked patients
  expect(screen.queryByRole('combobox', { name: /Dokter gigi/ })).toBeNull() // dentist defaults to themself
  fireEvent.click(start)
  expect(start).toBeDisabled()
  expect(start).toHaveTextContent('Memulai…')
  await waitFor(() => expect(screen.queryByRole('button', { name: /Mulai kunjungan|Memulai/ })).toBeNull())
  const [url, init] = walkInPosts()[0]
  expect(url).toBe('/api/patients/p1/visits/walk-in')
  expect(init).toMatchObject({ method: 'POST' })
  expect(JSON.parse(init!.body as string)).toEqual({})
  expect(screen.getByText('Kunjungan hari ini dimulai.')).toBeInTheDocument()

  fireEvent.click(document.getElementById('t16-O')!)
  const panel = within(screen.getByRole('complementary', { name: 'Detail gigi' }))
  fireEvent.click(panel.getByRole('button', { name: 'Karies' }))
  const save = panel.getByRole('button', { name: 'Simpan ke kunjungan hari ini' })
  expect(save).toBeEnabled()
  fireEvent.click(save)
  await waitFor(() => expect(vi.mocked(fetch).mock.calls.some(([u]) => u === '/api/visits/v1/findings')).toBe(true))
})

test('Mulai kunjungan: in the tooth panel next to Simpan when a tooth is picked; hidden with an active visit or without note.write', async () => {
  walkInFetch()
  const first = render(<ChartPage patientId="p1" me={me} />)
  await screen.findByRole('region', { name: 'Odontogram' })
  fireEvent.click(document.getElementById('t16-O')!)
  expect(within(screen.getByRole('complementary', { name: 'Detail gigi' })).getByRole('button', { name: 'Mulai kunjungan' })).toBeEnabled()
  expect(screen.getAllByRole('button', { name: 'Mulai kunjungan' })).toHaveLength(1)
  first.unmount()

  const second = renderChart({ visits: [visit] }) // berlangsung visit already selected
  await screen.findByRole('region', { name: 'Odontogram' })
  expect(screen.queryByRole('button', { name: 'Mulai kunjungan' })).toBeNull()
  second.unmount()

  walkInFetch()
  render(<ChartPage patientId="p1" me={{ ...me, roles: ['owner'], permissions: ['patient.read', 'note.read', 'appointment.read'] }} />)
  await screen.findByRole('region', { name: 'Odontogram' })
  expect(screen.queryByRole('button', { name: 'Mulai kunjungan' })).toBeNull()
})

test('Mulai kunjungan: assistant must choose the dentist; dentist_id is sent', async () => {
  walkInFetch()
  render(<ChartPage patientId="p1" me={{ ...me, roles: ['assistant'], permissions: ['patient.read', 'note.read', 'note.write', 'appointment.read'] }} />)
  const start = await screen.findByRole('button', { name: 'Mulai kunjungan' })
  expect(start).toBeDisabled()
  const pickDoc = screen.getByRole('combobox', { name: /Dokter gigi/ })
  expect(pickDoc).toBeRequired()
  await screen.findByRole('option', { name: 'drg. Sintetis Satu' })
  fireEvent.change(pickDoc, { target: { value: 'd1' } })
  expect(start).toBeEnabled()
  fireEvent.click(start)
  await waitFor(() => expect(walkInPosts()).toHaveLength(1))
  expect(JSON.parse(walkInPosts()[0][1]!.body as string)).toEqual({ dentist_id: 'd1' })
})

test('Mulai kunjungan: an error is shown as is and no visit appears', async () => {
  walkInFetch({ status: 422, body: { message: 'Dokter gigi tidak aktif di cabang ini.', errors: {} } })
  render(<ChartPage patientId="p1" me={me} />)
  fireEvent.click(await screen.findByRole('button', { name: 'Mulai kunjungan' }))
  expect(await screen.findByText('Dokter gigi tidak aktif di cabang ini.')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Mulai kunjungan' })).toBeEnabled()
  expect(screen.queryByText('Kunjungan hari ini dimulai.')).toBeNull()
})

// --- Layout: compact header, inner tabs, odontogram 8 + tooth panel 4 (synthetic data) ---
const visit = { id: 'v1', appointment_id: null, branch_id: 'b1', started_at: '2026-01-05T03:00:00Z', status: 'berlangsung',
  dentist: { id: 'u1', name: 'drg. Uji Sintetis' }, notes: [], draft_findings: [], draft_procedures: [] }
const pad = () => within(screen.getByRole('group', { name: 'Permukaan' }))
const surfaces = () => pad().getAllByRole('button').map((b) => b.textContent)

test('header: "N tahun · sex · No. RM" (nowrap), allergy + condition chips from one alerts fetch, no visit chip without an active visit', async () => {
  const style = document.head.appendChild(document.createElement('style'))
  style.textContent = baseCss
  renderChart()
  const head = await screen.findByRole('region', { name: 'Peringatan medis pasien' })
  expect(await within(head).findByText('Alergi: Penisilin')).toBeVisible()
  const cond = within(head).getByText('Kondisi Sintetis') // condition shown in compact, type kept for screen readers
  expect(cond).toHaveTextContent('Kondisi: Kondisi Sintetis')
  expect(cond.querySelector('.sr-only')).toHaveTextContent('Kondisi:')
  const years = Math.floor((Date.now() - Date.parse('1960-01-01T00:00:00Z')) / 31_557_600_000)
  const sub = screen.getByRole('heading', { level: 1 }).nextElementSibling!
  expect(sub).toHaveTextContent(`${years} tahun · Laki-laki · No. RM BT-000007`)
  const mrn = sub.querySelector('.patient-mrn')!
  expect(mrn).toHaveTextContent(/^No\. RM BT-000007$/)
  expect(getComputedStyle(mrn).whiteSpace).toBe('nowrap')
  expect(document.body).not.toHaveTextContent('No. RM:')
  expect(document.body).not.toHaveTextContent(/Kunjungan aktif|Sedang dirawat/)
  expect(screen.queryByRole('note', { name: 'Status kunjungan' })).toBeNull()
  expect(vi.mocked(fetch).mock.calls.filter(([u]) => String(u).endsWith('/alerts'))).toHaveLength(1)
  style.remove()
})

test('header: missing MRN reads "No. RM belum ada"; unknown DOB/sex segments are omitted', async () => {
  vi.stubGlobal('fetch', vi.fn(async (url: string) => new Response(JSON.stringify(
    url.endsWith('/chart') ? chart : url.endsWith('/alerts') ? alerts : { ...full, mrn: null, dob: null, sex: null }), { status: 200 })))
  render(<ChartPage patientId="p1" me={me} />)
  const sub = (await screen.findByRole('heading', { level: 1 })).nextElementSibling!
  expect(sub.textContent).toBe('No. RM belum ada')
  expect(sub.querySelector('.patient-mrn')).toHaveTextContent('No. RM belum ada')
})

test('header: in-progress visit shows "Sedang dirawat · drg. … · sejak HH.MM" (Asia/Jakarta) in the chip row', async () => {
  renderChart({ visits: [visit] })
  const chip = await screen.findByRole('note', { name: 'Status kunjungan' })
  expect(chip).toHaveTextContent(/^Sedang dirawat · drg\. Uji Sintetis · sejak 10\.00$/)
  expect(chip).toHaveClass('visit-chip')
  expect(chip).not.toHaveClass('alert-chip')
  expect(chip.closest('.patient-chip-row')).toContainElement(screen.getByRole('region', { name: 'Peringatan medis pasien' }))
  expect(document.body).not.toHaveTextContent('Kunjungan aktif')
})

test('header: no visit chip for a finished or signed visit', async () => {
  const signed = { ...visit, notes: [{ id: 'n1', author_id: 'u1', versions: [{ status: 'final', signed_at: '2026-01-05T04:00:00Z' }] }] }
  const { unmount } = renderChart({ visits: [{ ...visit, status: 'selesai' }] })
  await screen.findByRole('region', { name: 'Odontogram' })
  expect(screen.queryByRole('note', { name: 'Status kunjungan' })).toBeNull()
  unmount()
  renderChart({ visits: [signed] })
  await screen.findByRole('region', { name: 'Odontogram' })
  expect(screen.queryByRole('note', { name: 'Status kunjungan' })).toBeNull()
})

test('visitStatusText: adds "drg." only when missing; omits an unknown dentist', () => {
  const at = '2026-01-05T03:00:00Z'
  expect(visitStatusText({ started_at: at, dentist: { id: 'u2', name: 'Nadia Putri' } })).toBe('Sedang dirawat · drg. Nadia Putri · sejak 10.00')
  expect(visitStatusText({ started_at: at, dentist: { id: 'u2', name: 'Drg. Nadia Putri' } })).toBe('Sedang dirawat · Drg. Nadia Putri · sejak 10.00')
  expect(visitStatusText({ started_at: at, dentist: { id: 'u2', name: 'dr. Nadia Putri' } })).toBe('Sedang dirawat · dr. Nadia Putri · sejak 10.00')
  expect(visitStatusText({ started_at: at, dentist: { id: 'u2', name: null } })).toBe('Sedang dirawat · sejak 10.00')
  expect(visitStatusText({ started_at: at, dentist: { id: 'u2', name: '  ' } })).toBe('Sedang dirawat · sejak 10.00')
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
  expect(panel).toHaveTextContent('Molar pertama kanan atas')
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
  expect(within(panel).getByRole('heading', { name: 'Gigi 36' })).toBeInTheDocument()
  expect(panel).toHaveTextContent('Molar pertama kiri bawah')
  expect(within(panel).getByRole('status')).toHaveTextContent('Dipilih: Gigi 36 · Oklusal (O)')

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

// jsdom menilai @media pada lebar tetap 1024px: geser ambang agar CSS berlaku seperti pada lebar w.
const cssAt = (text: string, w: number) => text.replace(/@media[^{]+/g, (m) => m.replace(/(\d+)px/g, (_, n) => `${Number(n) - (w - 1024)}px`))

test('1280px: odontogram (8) and tooth panel (4) sit side by side; 1320px (full sidebar) stacks; surface keys stay 44px', async () => {
  const style = document.head.appendChild(document.createElement('style'))
  style.textContent = cssAt(baseCss + css, 1280)
  renderChart()
  const odo = await screen.findByRole('region', { name: 'Odontogram' })
  const panel = screen.getByRole('complementary', { name: 'Detail gigi' })
  expect(odo.closest('.chart-grid')).toBe(panel.parentElement)
  expect(getComputedStyle(odo).gridColumn).toBe('span 8')
  expect(getComputedStyle(panel).gridColumn).toBe('span 4')
  fireEvent.click(document.getElementById('t16-O')!)
  for (const b of pad().getAllByRole('button')) {
    expect(parseFloat(getComputedStyle(b).minWidth)).toBeGreaterThanOrEqual(44)
    expect(parseFloat(getComputedStyle(b).minHeight)).toBeGreaterThanOrEqual(44)
  }
  // 1281–1365px: sidebar penuh, chart dan panel bertumpuk.
  style.textContent = cssAt(baseCss + css, 1320)
  expect(getComputedStyle(odo).gridColumn).toBe('span 12')
  expect(getComputedStyle(panel).gridColumn).toBe('span 12')
  style.remove()
})

test('390px: selecting a tooth opens a bottom sheet named for the tooth; keypad labels + 44px; backdrop closes and clears the pick', async () => {
  vi.stubGlobal('matchMedia', (q: string) => ({ media: q, matches: true, addEventListener() {}, removeEventListener() {} }))
  const style = document.head.appendChild(document.createElement('style'))
  style.textContent = cssAt(baseCss + css, 390)
  renderChart({ visits: [visit] })
  await screen.findByRole('region', { name: 'Odontogram' })
  expect(screen.queryByRole('complementary', { name: 'Detail gigi' })).toBeNull()
  expect(screen.queryByRole('dialog')).toBeNull()

  fireEvent.click(document.getElementById('t16-O')!)
  const sheet = screen.getByRole('dialog', { name: 'Detail gigi 16' })
  expect(sheet).toHaveClass('tooth-sheet')
  expect(sheet).toHaveAttribute('aria-modal', 'true')
  expect(sheet).toHaveTextContent('Molar pertama kanan atas')
  expect(surfaces()).toEqual(['P', 'M', 'O', 'D', 'B'])
  for (const b of pad().getAllByRole('button')) {
    expect(parseFloat(getComputedStyle(b).minWidth)).toBeGreaterThanOrEqual(44)
    expect(parseFloat(getComputedStyle(b).minHeight)).toBeGreaterThanOrEqual(44)
  }
  expect(within(sheet).getByRole('group', { name: 'Pilih kondisi' })).toBeInTheDocument() // same editable rule as desktop
  expect(within(sheet).getByRole('button', { name: 'Simpan ke kunjungan hari ini' })).toBeDisabled() // no condition chosen yet
  expect(within(sheet).getByRole('button', { name: 'Tutup detail gigi' })).toHaveFocus()
  // Designer note: patient strip (name, No. RM, allergies) pinned at the top of the sheet, from the header patient (no refetch).
  const strip = sheet.querySelector('.sheet-strip') as HTMLElement
  expect(strip).toBe(sheet.firstElementChild)
  expect(strip).toHaveTextContent('Budi Contoh')
  expect(strip).toHaveTextContent('No. RM BT-000007')
  expect(await within(strip).findByText('Alergi: Penisilin')).toBeInTheDocument()
  expect(strip).not.toHaveTextContent('Kondisi Sintetis') // safety chips only
  expect(getComputedStyle(strip).position).toBe('sticky')
  expect(vi.mocked(fetch).mock.calls.filter(([u]) => /\/patients\/p1$/.test(String(u)))).toHaveLength(1)
  const sheetButtons = within(sheet).getAllByRole('button').filter((b) => b.closest('.cond-row') || b.classList.contains('tooth-save'))
  expect(sheetButtons.length).toBeGreaterThan(5)
  for (const b of sheetButtons) expect(parseFloat(getComputedStyle(b).minHeight)).toBeGreaterThanOrEqual(44)
  // Focus trap: Tab from the last control wraps to the first; Shift+Tab from the first wraps to the last.
  const focusables = [...sheet.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), input:not([disabled]), select:not([disabled])')]
  const last = focusables[focusables.length - 1]
  last.focus()
  fireEvent.keyDown(last, { key: 'Tab' })
  expect(focusables[0]).toHaveFocus()
  fireEvent.keyDown(focusables[0], { key: 'Tab', shiftKey: true })
  expect(last).toHaveFocus()
  focusables[1].focus()
  fireEvent.keyDown(focusables[1], { key: 'Tab' }) // middle: browser default, no wrap
  expect(focusables[1]).toHaveFocus()

  fireEvent.click(document.querySelector('.sheet-backdrop')!)
  expect(screen.queryByRole('dialog')).toBeNull()
  expect(document.querySelector('.tooth-surface.is-sel')).toBeNull()

  fireEvent.click(document.getElementById('t36-O')!)
  expect(surfaces()).toEqual(['L', 'M', 'O', 'D', 'B'])
  expect(screen.getByRole('dialog', { name: 'Detail gigi 36' })).toHaveTextContent('Molar pertama kiri bawah')
  fireEvent.keyDown(screen.getByRole('dialog', { name: 'Detail gigi 36' }), { key: 'Escape' })
  expect(screen.queryByRole('dialog')).toBeNull()
  style.remove()
})

test('≤480px: one labelled, independent scroller per jaw; 1280px: one combined SVG without jaw labels', async () => {
  vi.stubGlobal('matchMedia', (q: string) => ({ media: q, matches: true, addEventListener() {}, removeEventListener() {} }))
  const style = document.head.appendChild(document.createElement('style'))
  style.textContent = cssAt(baseCss + css, 390)
  const { unmount } = renderChart({ visits: [visit] })
  const card = await screen.findByRole('region', { name: 'Odontogram' })
  const upper = within(card).getByRole('group', { name: 'Rahang atas' })
  const lower = within(card).getByRole('group', { name: 'Rahang bawah' })
  expect(upper).not.toBe(lower)
  expect(upper).not.toContainElement(lower)
  for (const el of [upper, lower]) {
    expect(getComputedStyle(el).overflowX).toBe('auto')
    expect(getComputedStyle(el).overscrollBehaviorX).toBe('contain')
    expect(el.querySelectorAll('svg.odontogram')).toHaveLength(1)
  }
  expect(upper.querySelector('#t11')).not.toBeNull()
  expect(upper.querySelector('#t21')).not.toBeNull()
  expect(upper.querySelector('#t41')).toBeNull()
  expect(lower.querySelector('#t41')).not.toBeNull()
  expect(lower.querySelector('#t31')).not.toBeNull()
  expect(card.querySelectorAll('svg.odontogram')).toHaveLength(2)
  expect(within(card).getAllByText('kanan ← kiri pasien')).toHaveLength(2)
  expect(card).toHaveTextContent(/geser rahang, ketuk gigi untuk detail/)
  // Midline centring (scrollLeft) needs real layout; checked visually at 390px.
  expect(upper).toHaveAttribute('data-centred')
  fireEvent.click(document.getElementById('t16-O')!)
  expect(screen.getByRole('dialog', { name: 'Detail gigi 16' })).toBeInTheDocument()
  unmount()
  style.remove()

  // 481–720px (only the 720px query matches) and 1280px (none): one combined SVG, no jaw labels, as before.
  for (const [w, mq] of [[600, (q: string) => q.includes('720')], [1280, () => false]] as const) {
    vi.stubGlobal('matchMedia', (q: string) => ({ media: q, matches: mq(q), addEventListener() {}, removeEventListener() {} }))
    const st = document.head.appendChild(document.createElement('style'))
    st.textContent = cssAt(baseCss + css, w)
    const r = renderChart({ visits: [visit] })
    const card2 = await screen.findByRole('region', { name: 'Odontogram' })
    const svgs = card2.querySelectorAll('svg.odontogram')
    expect(svgs).toHaveLength(1)
    expect(svgs[0].querySelector('#t11')).not.toBeNull()
    expect(svgs[0].querySelector('#t41')).not.toBeNull()
    expect(within(card2).getByRole('group', { name: /^Odontogram \(FDI\)/ })).toBe(svgs[0])
    expect(within(card2).queryByText('Rahang atas')).toBeNull()
    expect(within(card2).queryByText('Rahang bawah')).toBeNull()
    r.unmount()
    st.remove()
  }
})

test.each([[390, true], [1280, false]])('%ipx: walk-in "Mulai kunjungan" pinned bar only on a phone', async (w, pinned) => {
  vi.stubGlobal('matchMedia', (q: string) => ({ media: q, matches: w <= Number(q.match(/(\d+)px/)?.[1] ?? 0), addEventListener() {}, removeEventListener() {} }))
  walkInFetch()
  render(<ChartPage patientId="p1" me={me} />)
  const start = await screen.findByRole('button', { name: 'Mulai kunjungan' })
  expect(!!start.closest('.walk-in-bar')).toBe(pinned)
  expect(screen.getAllByRole('button', { name: 'Mulai kunjungan' })).toHaveLength(1)
})

// --- #69: from the RM to the Tagihan (billing readers, e.g. an owner who is also a dentist) ---
test('Selesai offers "Lanjut ke tagihan" to billing readers; RM > Billing lists visits with "Buka tagihan"', async () => {
  const draftNote = { id: 'n1', author_id: 'u1', created_at: '2026-01-05T03:00:00Z', pending_correction: null, versions: [{ id: 'nv1', version: 1, revision: 1,
    supersedes_id: null, status: 'draf', source: 'manual', signed_by: null, signed_by_name: null, signed_at: null, reason: null, correction_request_id: null,
    content_hash: 'h', soap: { S: 'Nyeri.', O: 'Karies.', A: { codes: ['K02.1'], text: '' }, P: { codes: [], text: '' } } }] }
  let closed = false
  const owner: Me = { ...me, roles: ['owner', 'dentist'], permissions: [...me.permissions, 'billing.read', 'billing.adjust', 'appointment.transition'] }
  vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
    if (url.endsWith('/selesai') && init?.method === 'POST') { closed = true; return new Response('{}', { status: 200 }) }
    const v = closed ? { ...visit, status: 'selesai', notes: [] } : { ...visit, notes: [draftNote] }
    return new Response(JSON.stringify(url.endsWith('manifest.json') ? manifest : url.endsWith('/chart') ? { ...chart, findings, visits: [v] }
      : url.endsWith('/alerts') ? alerts : full), { status: 200 })
  }))
  window.Tooth3D = mockTooth3D
  render(<ChartPage patientId="p1" me={owner} />)
  await screen.findByRole('region', { name: 'Odontogram' })
  fireEvent.click(screen.getByRole('tab', { name: 'Catatan Klinis' }))
  fireEvent.click(await screen.findByRole('button', { name: 'Selesai' }))
  const dlg = screen.getByRole('dialog')
  fireEvent.click(within(dlg).getByRole('checkbox'))
  fireEvent.click(within(dlg).getByRole('button', { name: 'Selesai' }))
  expect(await screen.findByRole('link', { name: 'Lanjut ke tagihan' })).toHaveAttribute('href', '#/tagihan/v1')
  expect(screen.getByRole('link', { name: 'Lanjut ke tagihan' })).toHaveClass('btn-primary') // review-2 P1: payment is the next step

  fireEvent.click(screen.getByRole('tab', { name: 'Billing' }))
  expect(screen.getByRole('heading', { name: 'Tagihan per kunjungan' })).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Buka tagihan' })).toHaveAttribute('href', '#/tagihan/v1')
})

test('RM > Billing without billing.read stays "Belum tersedia"', async () => {
  renderChart({ visits: [visit] })
  await screen.findByRole('region', { name: 'Odontogram' })
  fireEvent.click(screen.getByRole('tab', { name: 'Billing' }))
  expect(document.body).toHaveTextContent('Belum tersedia')
  expect(screen.queryByRole('link', { name: 'Buka tagihan' })).toBeNull()
})

// --- #70 Dokter mode: one-tap procedure, SOAP template, Selesai saves first, phone sticky bar (synthetic data) ---
function dokterChart(w: number, appt?: string) {
  localStorage.clear()
  vi.stubGlobal('matchMedia', (q: string) => ({ media: q, matches: w <= Number(q.match(/(\d+)px/)?.[1] ?? 0), addEventListener() {}, removeEventListener() {} }))
  const calls: { url: string; method: string; body: any }[] = []
  let noteSaved = false
  vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
    const method = init?.method ?? 'GET'
    if (method !== 'GET') calls.push({ url, method, body: init?.body ? JSON.parse(init.body as string) : null })
    if (url.endsWith('/procedures') && method === 'POST') return new Response(JSON.stringify({ id: 'x1' }), { status: 201 })
    if (url.endsWith('/visit') && method === 'POST') return new Response(JSON.stringify({ id: visit.id }), { status: 200 })
    if ((url.endsWith('/transition') || url.endsWith('/selesai')) && method === 'POST') return new Response(JSON.stringify({ ok: true }), { status: 200 })
    if (url.endsWith('/note') && method === 'PUT') { noteSaved = true; return new Response(JSON.stringify({ revision: 1 }), { status: 200 }) }
    const draftNote = { id: 'n1', author_id: 'u1', created_at: '', pending_correction: null, versions: [{ id: 'nv1', version: 1, revision: 1, supersedes_id: null,
      status: 'draf', source: 'manual', signed_by: null, signed_by_name: null, signed_at: null, reason: null, correction_request_id: null, content_hash: 'h',
      soap: { S: 'Gigi berlubang, ngilu saat makan/minum dingin.', O: '', A: { codes: [], text: '' }, P: { codes: [], text: '' } } }] }
    const older = { ...visit, id: 'v0', status: 'selesai', started_at: '2025-12-01T03:00:00Z', notes: [{ ...draftNote, id: 'n0', versions: [{ ...draftNote.versions[0],
      id: 'nv0', status: 'berlaku', signed_at: '2025-12-01T04:00:00Z', soap: { S: 'Kontrol lama.', O: 'Baik.', A: { codes: ['Z01.2'], text: '' }, P: { codes: [], text: '' } } }] }] }
    const v = { ...visit, notes: noteSaved ? [draftNote] : [] }
    return new Response(JSON.stringify(url.endsWith('manifest.json') ? manifest : url.endsWith('/chart') ? { ...chart, findings, visits: [v, older] }
      : url.endsWith('/alerts') ? alerts : full), { status: 200 })
  }))
  window.Tooth3D = mockTooth3D
  render(<ChartPage patientId="p1" appointmentId={appt} me={appt ? { ...me, permissions: [...me.permissions, 'appointment.transition'] } : me} />)
  return calls
}

test('#70 RM Selesai from an appointment also frees the chair (appointment -> done), so "Pasien saya" stays current', async () => {
  const calls = dokterChart(412, 'a1')
  await screen.findByRole('region', { name: 'Odontogram' })
  fireEvent.click(screen.getByRole('tab', { name: 'Catatan Klinis' }))
  fireEvent.click(within(screen.getByRole('group', { name: 'Template catatan' })).getByRole('button', { name: 'Tambal' }))
  fireEvent.click(within(document.querySelector('.rm-actionbar') as HTMLElement).getByRole('button', { name: 'Selesai' }))
  const dlg = await screen.findByRole('dialog')
  fireEvent.click(within(dlg).getByRole('checkbox'))
  fireEvent.click(within(dlg).getByRole('button', { name: 'Selesai' }))
  await waitFor(() => expect(calls.find((c) => c.url.endsWith('/appointments/a1/transition'))?.body).toEqual({ to: 'done' }))
  expect(calls.findIndex((c) => c.url.endsWith('/selesai'))).toBeLessThan(calls.findIndex((c) => c.url.endsWith('/transition')))
})

test('#70 tooth panel: one tap "Tambal 23.2" saves procedure + diagnosis (no typing) and becomes this dentist\'s favourite', async () => {
  const calls = dokterChart(1280)
  await screen.findByRole('region', { name: 'Odontogram' })
  fireEvent.click(document.getElementById('t26-O')!)
  const quick = within(screen.getByRole('group', { name: 'Tindakan cepat' }))
  fireEvent.click(quick.getByRole('button', { name: 'Tambal (23.2, diagnosis K02.1) di gigi 26' }))
  await waitFor(() => expect(calls.find((c) => c.url.endsWith('/procedures'))).toBeTruthy())
  expect(calls.find((c) => c.url.endsWith('/procedures'))!.body).toMatchObject({ tooth: 26, surfaces: 'O', status: 'selesai', procedure_code: '23.2', diagnosis_code: 'K02.1' })
  expect(JSON.parse(localStorage.getItem('bt.quick-proc.u1')!)[0]).toMatchObject({ code: '23.2', dx: 'K02.1', n: 1 })
})

test('#70 phone: a quick procedure closes the tooth sheet so the tabs and Selesai bar are reachable again', async () => {
  const calls = dokterChart(412)
  await screen.findByRole('region', { name: 'Odontogram' })
  fireEvent.click(document.getElementById('t26-O')!)
  const quick = within(screen.getByRole('group', { name: 'Tindakan cepat' }))
  fireEvent.click(quick.getByRole('button', { name: 'Tambal (23.2, diagnosis K02.1) di gigi 26' }))
  await waitFor(() => expect(calls.find((c) => c.url.endsWith('/procedures'))).toBeTruthy())
  await waitFor(() => expect(screen.queryByRole('heading', { name: 'Gigi 26' })).toBeNull())
  expect(await screen.findByText('Tambal gigi 26 (O) tersimpan.')).toBeInTheDocument()
})

test('#70 Catatan: template fills only empty fields; "Ulangi kunjungan terakhir" copies the last signed SOAP; Selesai saves the draft first', async () => {
  const calls = dokterChart(1280)
  await screen.findByRole('region', { name: 'Odontogram' })
  fireEvent.click(screen.getByRole('tab', { name: 'Catatan Klinis' }))
  const tpl = within(screen.getByRole('group', { name: 'Template catatan' }))
  fireEvent.change(screen.getByLabelText('S'), { target: { value: 'Keluhan saya sendiri.' } })
  fireEvent.click(tpl.getByRole('button', { name: 'Tambal' }))
  expect(screen.getByLabelText('S')).toHaveValue('Keluhan saya sendiri.') // typed text kept
  fireEvent.click(screen.getByRole('tab', { name: 'O — Objektif' }))
  expect(screen.getByLabelText('O')).toHaveValue('Karies dentin, tes dingin (+), perkusi (-).')
  expect(tpl.getByRole('button', { name: 'Ulangi kunjungan terakhir' })).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Selesai' })) // dirty: saves, then opens the dialog
  await waitFor(() => expect(calls.some((c) => c.url.endsWith('/note') && c.method === 'PUT')).toBe(true))
  expect(calls.find((c) => c.url.endsWith('/note'))!.body.soap).toMatchObject({ S: 'Keluhan saya sendiri.', A: { codes: ['K02.1'] }, P: { codes: ['23.2'] } })
  expect(await screen.findByRole('dialog')).toHaveTextContent('Selesai: kunci rekam medis')
})

test('#70 phone: SOAP stacked (no sub-tabs), sticky Selesai bar, Rencana/Resep tabs hidden, details folded', async () => {
  dokterChart(412)
  await screen.findByRole('region', { name: 'Odontogram' })
  expect(screen.queryByRole('tab', { name: 'Resep' })).toBeNull()
  expect(screen.queryByRole('tab', { name: 'Rencana Perawatan' })).toBeNull()
  expect(document.querySelector('.rm-actionbar')).toHaveTextContent('Selesai')
  expect(screen.queryByRole('button', { name: 'Semua gigi' })).toBeNull() // Temuan & tindakan folded
  expect(screen.getByRole('button', { name: /^Lihat \(\d+\)$/ })).toHaveAttribute('aria-expanded', 'false')
  fireEvent.click(screen.getByRole('tab', { name: 'Catatan Klinis' }))
  expect(screen.queryByRole('tab', { name: 'O — Objektif' })).toBeNull()
  for (const f of ['S', 'O', 'Kode ICD-10', 'Kode ICD-9-CM']) expect(screen.getByLabelText(f)).toBeInTheDocument()
  expect(screen.queryByRole('heading', { name: 'Riwayat kunjungan' })).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: 'Tutup kunjungan & riwayat' }))
  expect(screen.getByRole('heading', { name: 'Riwayat kunjungan' })).toBeInTheDocument()
})
