import { fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, expect, test, vi } from 'vitest'
import type { IcdItem, IcdSuggestions as Data } from './icdApi'
import IcdSuggestions from './IcdSuggestions'
import { REJECT_DELAY_MS, pendingRejects } from './pendingReject'

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status })
const item = (id: string, over: Partial<IcdItem> = {}): IcdItem => ({
  id, state: 'draf', system: 'icd10', code: 'K02.1', display: 'Caries of dentine', version: 'ICD10_2010', reason: 'Cocok dengan istilah "gigi berlubang"',
  citations: [{ ref: 'F1', type: 'finding', id: 'f1', version: 1, tooth: 36, surface: 'O' }, { ref: 'A', type: 'note_draft', id: 'n1', version: 2 }],
  source: 'deterministik', rank: 1, why: 'synonym', perlu_dicek: true, ...over,
})
const payload = (items: IcdItem[], locked = false): Data => ({
  visit_id: 'v1', patient_id: 'p1', locked, paid: false, items,
  counts: { draf: items.filter((i) => i.state === 'draf').length, disetujui: items.filter((i) => i.state === 'disetujui').length, ditolak: items.filter((i) => i.state === 'ditolak').length },
})

function server(initial: IcdItem[], locked = false) {
  let items = initial
  const calls: string[] = []
  vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
    const m = init?.method ?? 'GET'
    calls.push(`${m} ${url}${init?.body ? ' ' + init.body : ''}${init?.keepalive ? ' keepalive' : ''}`)
    if (url === '/sanctum/csrf-cookie') { document.cookie = 'XSRF-TOKEN=abc'; return new Response(null, { status: 204 }) }
    if (m === 'GET' && url === '/api/visits/v1/icd-suggestions') return json(payload(items, locked))
    if (m === 'GET' && url === '/api/patients/p1/icd-suggestions') return json({ ...payload(items, true), visit_id: null })
    const one = url.match(/^\/api\/icd-suggestions\/(\w+)\/(approve|reject)$/)
    if (one) {
      items = items.map((i) => (i.id === one[1] ? { ...i, state: one[2] === 'approve' ? 'disetujui' : 'ditolak' } : i))
      return json({ id: one[1] })
    }
    throw new Error('unexpected ' + url)
  }))
  return calls
}
afterEach(() => {
  pendingRejects.reset()
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

const two = () => [item('a'), item('b', { system: 'icd9cm', code: '23.09', display: 'Extraction of other tooth', version: 'ICD9CM_2010',
  citations: [{ ref: 'P', type: 'note_draft', id: 'n1', version: 2 }] })]

test('one tap approves: chip counts update, toast shows, chart reloads, zero rejected chip hidden', async () => {
  const calls = server(two())
  const onChanged = vi.fn()
  render(<IcdSuggestions patientId="p1" visitId="v1" onChanged={onChanged} />)

  expect(await screen.findByText('✎ 2 draf')).toBeInTheDocument()
  expect(screen.queryByText(/disetujui/)).not.toBeInTheDocument()
  expect(screen.queryByText(/ditolak/)).not.toBeInTheDocument()
  const card = screen.getByRole('listitem', { name: 'ICD-10 K02.1' })
  expect(within(card).getByText('Caries of dentine')).toBeInTheDocument()
  fireEvent.click(within(card).getByRole('button', { name: '✓ Setujui' }))

  expect(await screen.findByText('✓ 1 disetujui')).toBeInTheDocument()
  expect(screen.getByRole('status')).toHaveTextContent('K02.1 masuk A')
  expect(screen.getByText('1 sudah diulas')).toBeInTheDocument()
  expect(onChanged).toHaveBeenCalledOnce()
  expect(calls).toContain('POST /api/icd-suggestions/a/approve')
})

test('one tap Tolak is optimistic: Ditolak + Urungkan toast, no request yet, chart not reloaded', async () => {
  const calls = server(two())
  const onChanged = vi.fn()
  render(<IcdSuggestions patientId="p1" visitId="v1" onChanged={onChanged} />)
  const card = await screen.findByRole('listitem', { name: 'ICD-9-CM 23.09' })
  fireEvent.click(within(card).getByRole('button', { name: 'Tolak' }))

  expect(await screen.findByText('✕ 1 ditolak')).toBeInTheDocument()
  expect(screen.getByRole('status')).toHaveTextContent('Ditolak')
  expect(screen.getByRole('button', { name: 'Urungkan' })).toBeInTheDocument()
  expect(calls.filter((c) => c.includes('/reject'))).toEqual([])
  expect(onChanged).not.toHaveBeenCalled()
})

test('citation chip highlights only odontogram findings and toggles off', async () => {
  server(two())
  const onHighlight = vi.fn()
  render(<IcdSuggestions patientId="p1" visitId="v1" onHighlight={onHighlight} />)
  const chip = await screen.findByRole('button', { name: /F1 · gigi 36 O · A · diagnosis/ })
  fireEvent.click(chip)
  expect(onHighlight).toHaveBeenLastCalledWith(['t36-O'])
  expect(chip).toHaveAttribute('aria-pressed', 'true')
  fireEvent.click(chip)
  expect(onHighlight).toHaveBeenLastCalledWith([])
})

test('dirty SOAP form disables Setujui and asks to save first', async () => {
  server(two())
  render(<IcdSuggestions patientId="p1" visitId="v1" dirty />)
  const card = await screen.findByRole('listitem', { name: 'ICD-10 K02.1' })
  expect(within(card).getByRole('button', { name: '✓ Setujui' })).toBeDisabled()
  expect(within(card).getByRole('button', { name: 'Tolak' })).toBeEnabled()
  expect(screen.getByText('Simpan draf SOAP dulu.')).toBeInTheDocument()
})

test('locked visit and patient preview are read-only; empty state', async () => {
  server(two(), true)
  const { unmount } = render(<IcdSuggestions patientId="p1" visitId="v1" />)
  expect(await screen.findByText('Terkunci: kunjungan sudah ditandatangani.')).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: '✓ Setujui' })).not.toBeInTheDocument()
  unmount()

  render(<IcdSuggestions patientId="p1" visitId={null} />)
  expect(await screen.findByText('Pratinjau: buka kunjungan untuk menyetujui.')).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Tolak' })).not.toBeInTheDocument()
})

test('empty list', async () => {
  server([])
  render(<IcdSuggestions patientId="p1" visitId="v1" />)
  expect(await screen.findByText('Belum ada saran.')).toBeInTheDocument()
  expect(screen.queryByText(/draf/)).not.toBeInTheDocument()
})

// The 48px minimum lives on these classes in icd.css (vitest does not load CSS; scripts/a1-screenshots.mjs measures real sizes).
test('every button and summary uses a 48px target class', async () => {
  server([...two(), item('c', { state: 'ditolak', code: 'K02.9' })])
  const { container } = render(<IcdSuggestions patientId="p1" visitId="v1" />)
  await screen.findByText('✕ 1 ditolak')
  fireEvent.click(within(screen.getByRole('listitem', { name: 'ICD-9-CM 23.09' })).getByRole('button', { name: 'Tolak' }))
  await screen.findByRole('button', { name: 'Urungkan' })
  fireEvent.click(within(screen.getByRole('listitem', { name: 'ICD-10 K02.1' })).getByRole('button', { name: 'Alasan' }))
  await screen.findByRole('dialog', { name: 'Alasan' })
  const targets = [...container.querySelectorAll('button, summary')]
  expect(targets.length).toBeGreaterThan(5)
  for (const el of targets) {
    expect(el.tagName === 'SUMMARY' ? el.closest('.ic-done') : el.className, el.textContent ?? '').toBeTruthy()
    if (el.tagName === 'BUTTON') expect(el.className).toMatch(/\bic-(info|cite|btn|tab|undo)\b/)
  }
})

test('hides a zero disetujui chip the same way as ditolak, then shows it after approve', async () => {
  server(two())
  render(<IcdSuggestions patientId="p1" visitId="v1" />)
  await screen.findByText('✎ 2 draf')
  expect(screen.queryByText('✓ 0 disetujui')).not.toBeInTheDocument()
  expect(screen.queryByText('✕ 0 ditolak')).not.toBeInTheDocument()
  expect(screen.queryByText('✎ 0 draf')).not.toBeInTheDocument()
  fireEvent.click(within(screen.getByRole('listitem', { name: 'ICD-10 K02.1' })).getByRole('button', { name: '✓ Setujui' }))
  expect(await screen.findByText('✓ 1 disetujui')).toBeInTheDocument()
  expect(screen.queryByText(/ditolak/)).not.toBeInTheDocument()
})

test('Semua / Draf / Diulas tabs match A2: semua lists open items plus reviewed under details', async () => {
  server([...two(), item('c', { state: 'disetujui', code: 'K02.9' })])
  render(<IcdSuggestions patientId="p1" visitId="v1" />)
  await screen.findByText('✓ 1 disetujui')
  const tabs = screen.getByRole('radiogroup', { name: 'Tampilkan' })
  expect(within(tabs).getByRole('radio', { name: 'Semua' })).toHaveAttribute('aria-checked', 'true')
  expect(screen.getByRole('listitem', { name: 'ICD-10 K02.1' })).toBeInTheDocument()
  expect(screen.getByText('1 sudah diulas')).toBeInTheDocument()

  fireEvent.click(within(tabs).getByRole('radio', { name: 'Diulas' }))
  expect(screen.queryByRole('listitem', { name: 'ICD-10 K02.1' })).not.toBeInTheDocument()
  expect(screen.getByRole('listitem', { name: 'ICD-10 K02.9' })).toBeInTheDocument()
  expect(screen.queryByText('sudah diulas')).not.toBeInTheDocument()

  fireEvent.click(within(tabs).getByRole('radio', { name: 'Draf' }))
  expect(screen.getByRole('listitem', { name: 'ICD-10 K02.1' })).toBeInTheDocument()
  expect(screen.queryByRole('listitem', { name: 'ICD-10 K02.9' })).not.toBeInTheDocument()
})

test('Tolak is one tap (no reason body); the alasan sheet sends a picked reason', async () => {
  const calls = server(two())
  render(<IcdSuggestions patientId="p1" visitId="v1" />)
  const card = await screen.findByRole('listitem', { name: 'ICD-10 K02.1' })
  expect(screen.queryByRole('dialog', { name: 'Alasan' })).not.toBeInTheDocument()
  fireEvent.click(within(card).getByRole('button', { name: 'Alasan' }))
  const sheet = screen.getByRole('dialog', { name: 'Alasan' })
  expect(within(sheet).getByRole('button', { name: 'Tidak sesuai' })).toBeInTheDocument()
  expect(within(sheet).getAllByRole('button')).toHaveLength(5)
  vi.useFakeTimers()
  fireEvent.click(within(sheet).getByRole('button', { name: 'Sudah dicatat' }))

  expect(screen.getByText('✕ 1 ditolak')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Urungkan' })).toBeInTheDocument()
  expect(calls.filter((c) => c.includes('/reject'))).toEqual([])
  expect(screen.queryByRole('dialog', { name: 'Alasan' })).not.toBeInTheDocument()

  await vi.advanceTimersByTimeAsync(REJECT_DELAY_MS)
  vi.useRealTimers()
  expect(calls.filter((c) => c.startsWith('POST /api/icd-suggestions/a/reject') && c.includes('sudah_dicatat') && !c.includes('keepalive'))).toHaveLength(1)
})

test('ICD codes render as K02.9 without spaces around the dot', async () => {
  server([item('c', { code: 'K02.9' })])
  render(<IcdSuggestions patientId="p1" visitId="v1" />)
  const code = await screen.findByText('K02.9')
  expect(code).toHaveClass('ic-code')
  expect(code.textContent).toBe('K02.9')
  expect(code.textContent).not.toMatch(/\s/)
})

test('Urungkan cancels a pending Tolak: nothing is sent, the item returns to draf', async () => {
  const calls = server(two())
  render(<IcdSuggestions patientId="p1" visitId="v1" />)
  fireEvent.click(within(await screen.findByRole('listitem', { name: 'ICD-10 K02.1' })).getByRole('button', { name: 'Tolak' }))
  expect(await screen.findByText('✕ 1 ditolak')).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Urungkan' }))
  expect(screen.queryByText('✕ 1 ditolak')).not.toBeInTheDocument()
  expect(screen.getByText('✎ 2 draf')).toBeInTheDocument()
  expect(screen.getByRole('listitem', { name: 'ICD-10 K02.1' }).className).toMatch(/ic-draf/)
  vi.useFakeTimers()
  await vi.advanceTimersByTimeAsync(REJECT_DELAY_MS + 200)
  vi.useRealTimers()
  expect(calls.filter((c) => c.includes('/reject'))).toEqual([])
})

test('pending Tolak is sent once after 5 seconds, with no reason body', async () => {
  const calls = server(two())
  render(<IcdSuggestions patientId="p1" visitId="v1" />)
  const card = await screen.findByRole('listitem', { name: 'ICD-9-CM 23.09' })
  vi.useFakeTimers()
  fireEvent.click(within(card).getByRole('button', { name: 'Tolak' }))
  expect(screen.getByRole('button', { name: 'Urungkan' })).toBeInTheDocument()
  expect(calls.filter((c) => c.includes('/reject'))).toEqual([])
  await vi.advanceTimersByTimeAsync(REJECT_DELAY_MS)
  await vi.advanceTimersByTimeAsync(REJECT_DELAY_MS)
  vi.useRealTimers()
  const rejects = calls.filter((c) => c.includes('/reject'))
  expect(rejects).toEqual(['POST /api/icd-suggestions/b/reject {}'])
})

test('leaving the page flushes a pending Tolak once via keepalive, and the timer does not send again', async () => {
  const calls = server(two())
  render(<IcdSuggestions patientId="p1" visitId="v1" />)
  fireEvent.click(within(await screen.findByRole('listitem', { name: 'ICD-10 K02.1' })).getByRole('button', { name: 'Tolak' }))
  expect(await screen.findByRole('button', { name: 'Urungkan' })).toBeInTheDocument()
  window.dispatchEvent(new Event('pagehide'))
  expect(calls.filter((c) => c.includes('/reject'))).toEqual(['POST /api/icd-suggestions/a/reject {} keepalive'])
  vi.useFakeTimers()
  await vi.advanceTimersByTimeAsync(REJECT_DELAY_MS + 200)
  vi.useRealTimers()
  expect(calls.filter((c) => c.includes('/reject'))).toHaveLength(1)
})
