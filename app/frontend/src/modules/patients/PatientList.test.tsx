import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import css from './patients.css?raw'
import { afterEach, expect, test, vi } from 'vitest'
import { PatientList } from './Patients'

// Synthetic rows. p3 never visited: no date, no dentist, no allergies (nothing invented).
const rows = [{ id: 'p1', mrn: 'BT-000214', name: 'Sari Sintetis', dob: '1990-02-03', sex: 'perempuan', payer_type: 'umum', status: 'aktif',
  care_status: 'dalam_perawatan', last_visit_at: '2026-11-13T17:30:00.000000Z', last_dentist_id: 'd1', last_dentist_name: 'drg. Andi Contoh', allergies: ['Penisilin', 'Lateks'] },
{ id: 'p2', mrn: 'BT-000215', name: 'Budi Contoh', dob: '1985-07-01', sex: 'laki_laki', payer_type: 'asuransi', status: 'aktif',
  care_status: 'perlu_kontrol', last_visit_at: '2026-09-01T03:00:00Z', last_dentist_id: 'd2', last_dentist_name: 'drg. Citra Contoh', allergies: [] },
{ id: 'p3', mrn: null, name: 'Nadia Anak Contoh Wijaya Utama', dob: null, sex: null, payer_type: 'umum', status: 'aktif',
  care_status: 'tidak_aktif', last_visit_at: null, last_dentist_id: null, last_dentist_name: null, allergies: [] }]
const dentists = [{ id: 'd1', name: 'drg. Andi Contoh' }, { id: 'd2', name: 'drg. Citra Contoh' }]
const ok = (body: unknown) => new Response(JSON.stringify(body), { status: 200 })
/** Fake API: /api/dentists + /api/patients (server-side care_status / dentist_id filters). Returns the fetch mock. */
const serve = (data: Record<string, unknown>[] = rows) => {
  const f = vi.fn(async (url: string) => {
    if (url.startsWith('/api/dentists')) return ok({ data: dentists })
    const u = new URL(url, 'http://x')
    const care = u.searchParams.get('care_status'); const dentist = u.searchParams.get('dentist_id')
    return ok({ data: data.filter((r) => (!care || r.care_status === care) && (!dentist || r.last_dentist_id === dentist)), next_cursor: null })
  })
  vi.stubGlobal('fetch', f)
  return f
}
const list = (canChart?: boolean) => {
  const f = serve()
  render(<PatientList canCreate={false} canChart={canChart} />)
  return f
}
const rowOf = (name: string) => screen.getByText(name).closest('tr')!

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

test('table: last visit in Asia/Jakarta, dentist, care status chip; honest dashes when missing', async () => {
  list()
  await screen.findByText('Sari Sintetis')
  expect(screen.getAllByRole('columnheader').map((h) => h.textContent)).toEqual(['Pasien', 'No. RM', 'Umur', 'Kunjungan terakhir', 'Dokter', 'Status', 'Aksi'])
  const r1 = rowOf('Sari Sintetis').querySelectorAll('td')
  expect(r1[3]).toHaveTextContent('14 Nov 2026') // 17:30 UTC on the 13th = 00:30 WIB on the 14th
  expect(r1[4]).toHaveTextContent('drg. Andi Contoh')
  expect(within(r1[5] as HTMLElement).getByText('Dalam perawatan')).toHaveClass('chip', 'chip-aktif')
  expect(within(rowOf('Budi Contoh')).getByText('Perlu kontrol')).toHaveClass('chip', 'chip-kontrol')
  const r3 = rowOf('Nadia Anak Contoh Wijaya Utama').querySelectorAll('td')
  expect(r3[3]).toHaveTextContent('Belum ada')
  expect(r3[3]).not.toHaveTextContent(/\d/) // no fabricated date
  expect(r3[4]).toHaveTextContent('Belum ada')
  expect(within(r3[5] as HTMLElement).getByText('Tidak aktif')).toHaveClass('chip-neutral')
  expect(screen.queryByText('Aktif')).toBeNull() // admin status is not the list status
})

test('allergy chips from the list payload only (no /alerts per row)', async () => {
  const f = list()
  await screen.findByText('Sari Sintetis')
  const r1 = rowOf('Sari Sintetis')
  expect(within(r1).getByText('Penisilin')).toHaveClass('chip', 'chip-alergi')
  expect(within(r1).getByText('Lateks')).toHaveClass('chip-alergi')
  expect(within(r1).getByText('Alergi:')).toHaveClass('sr-only')
  expect(rowOf('Budi Contoh').querySelector('.chip-alergi')).toBeNull()
  expect(f.mock.calls.some(([u]) => String(u).includes('/alerts'))).toBe(false)
})

test('care status filter chips call the API with care_status', async () => {
  const f = list()
  await screen.findByText('Sari Sintetis')
  expect(screen.getAllByRole('button').map((b) => b.textContent)).toEqual(['Semua', 'Dalam perawatan', 'Perlu kontrol', 'Tidak aktif'])
  expect(screen.getByRole('button', { name: 'Semua' })).toHaveAttribute('aria-pressed', 'true')
  fireEvent.click(screen.getByRole('button', { name: 'Perlu kontrol' }))
  await waitFor(() => expect(screen.queryByText('Sari Sintetis')).toBeNull())
  expect(screen.getByText('Budi Contoh')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Perlu kontrol' })).toHaveAttribute('aria-pressed', 'true')
  expect(f.mock.calls.some(([u]) => String(u).includes('care_status=perlu_kontrol'))).toBe(true)
  fireEvent.click(screen.getByRole('button', { name: 'Tidak aktif' }))
  await screen.findByText('Nadia Anak Contoh Wijaya Utama')
  expect(screen.queryByText('Budi Contoh')).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: 'Semua' }))
  await screen.findByText('Sari Sintetis')
  expect(screen.getByText('Budi Contoh')).toBeInTheDocument()
})

test('dentist select: "Semua dokter" + /api/dentists, filters via dentist_id', async () => {
  const f = list()
  await screen.findByText('Sari Sintetis')
  const select = screen.getByRole('combobox', { name: 'Dokter' })
  await waitFor(() => expect(within(select).getAllByRole('option').map((o) => o.textContent)).toEqual(['Semua dokter', 'drg. Andi Contoh', 'drg. Citra Contoh']))
  fireEvent.change(select, { target: { value: 'd2' } })
  await waitFor(() => expect(screen.queryByText('Sari Sintetis')).toBeNull())
  expect(screen.getByText('Budi Contoh')).toBeInTheDocument()
  expect(f.mock.calls.some(([u]) => String(u).includes('dentist_id=d2'))).toBe(true)
  fireEvent.click(screen.getByRole('button', { name: 'Dalam perawatan' }))
  expect(await screen.findByText('Tidak ada pasien dengan saringan ini.')).toBeInTheDocument()
})

test('rows without care fields (older API) show dashes and do not crash', async () => {
  serve([{ id: 'p9', name: 'Tanpa Status', dob: null, sex: null, payer_type: 'umum' }])
  render(<PatientList canCreate={false} />)
  await screen.findByText('Tanpa Status')
  const cells = rowOf('Tanpa Status').querySelectorAll('td')
  expect(cells[3]).toHaveTextContent('Belum ada')
  expect(cells[5]).toHaveTextContent('Belum ada')
  expect(document.querySelector('.chip')).toBeNull()
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
  expect(within(card).getByText('Dalam perawatan')).toHaveClass('chip-aktif')
  expect(card).toHaveTextContent('Terakhir: 14 Nov 2026 · drg. Andi Contoh')
  expect(card).toHaveTextContent(/No\. RM BT-000214 · \d+ th · Perempuan/)
  expect(within(card).getByText('Penisilin')).toHaveClass('chip-alergi')
  const never = within(cards).getByText('Nadia Anak Contoh Wijaya Utama').closest('li')!
  expect(never).toHaveTextContent('Belum ada kunjungan')
  expect(within(never).getByText('Tidak aktif')).toHaveClass('chip-neutral')
  expect(within(card).getByRole('link', { name: 'Sari Sintetis' })).toHaveAttribute('href', '#/pasien/p1')
  const rm = within(card).getByRole('link', { name: 'Rekam Medis Sari Sintetis' })
  expect(rm).toHaveAttribute('href', '#/rekam-medis/p1')
  fireEvent.click(rm)
  expect(location.hash).not.toBe('#/pasien/p1')
  fireEvent.click(within(cards).getByText('Budi Contoh').closest('li')!)
  expect(location.hash).toBe('#/pasien/p2')
})

test('390px: title "Pasien" with a loaded count, short placeholder, FAB only with patient.create', async () => {
  viewport(390)
  serve()
  const { unmount } = render(<PatientList canCreate />)
  await screen.findByRole('list', { name: 'Daftar pasien' })
  expect(screen.getByRole('heading', { level: 1, name: 'Pasien' })).toBeInTheDocument()
  expect(screen.getByText('3 pasien')).toBeInTheDocument()
  expect(screen.getByRole('searchbox')).toHaveAttribute('placeholder', 'Cari nama atau No. RM')
  const fab = screen.getByRole('link', { name: 'Pasien baru' })
  expect(fab).toHaveClass('fab')
  expect(fab).toHaveAttribute('href', '#/pasien/baru')
  expect(document.querySelector('.pl-toolbar .btn-primary')).toBeNull()
  unmount()
  render(<PatientList canCreate={false} />)
  await screen.findByRole('list', { name: 'Daftar pasien' })
  expect(screen.queryByRole('link', { name: 'Pasien baru' })).toBeNull()
})

test('1280px: still the table', async () => {
  viewport(1280)
  list()
  await screen.findByText('Sari Sintetis')
  expect(screen.getByRole('table')).toHaveClass('pl-table')
  expect(screen.getByRole('heading', { level: 1, name: 'Daftar Pasien' })).toBeInTheDocument()
  expect(screen.queryByText(/\d+ pasien$/)).toBeNull()
  expect(screen.queryByRole('list', { name: 'Daftar pasien' })).toBeNull()
})

// jsdom evaluates @media at a fixed 1024px: shift the thresholds so patients.css applies as at width w (same trick as navHref.test).
const cssAt = (w: number) => css.replace(/@media[^{]+/g, (m) => m.replace(/(\d+)px/g, (_, n) => `${Number(n) - (w - 1024)}px`))
test.each([[390, true], [1280, false]])('%ipx: duplicate "Pasien" h1 hidden visually only on a phone (still a heading)', async (w, hidden) => {
  viewport(w)
  const style = document.head.appendChild(document.createElement('style'))
  style.textContent = cssAt(w)
  try {
    list()
    await screen.findByText('Sari Sintetis')
    const h1 = screen.getByRole('heading', { level: 1 })
    expect(getComputedStyle(h1).position === 'absolute' && getComputedStyle(h1).width === '1px').toBe(hidden)
  } finally { style.remove() }
})
