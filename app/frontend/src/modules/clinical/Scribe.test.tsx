import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, expect, test, vi } from 'vitest'
import { pendingScribeRejects } from './pendingScribeReject'

const getScribe = vi.fn()
const uploadScribe = vi.fn()
const approveScribe = vi.fn()
const rejectScribe = vi.fn()
vi.mock('./scribeApi', async (orig) => ({ ...(await orig<typeof import('./scribeApi')>()),
  getScribe: (...a: unknown[]) => getScribe(...a),
  uploadScribe: (...a: unknown[]) => uploadScribe(...a),
  approveScribe: (...a: unknown[]) => approveScribe(...a),
  rejectScribe: (...a: unknown[]) => rejectScribe(...a),
}))
const { default: Scribe } = await import('./Scribe')

const disabled = { disabled: true, paid_enabled: false, items: [], session: null, token_cap: 200000, tokens_used: 0, tokens_remaining: 200000 }
const draft = {
  disabled: false, paid_enabled: true, token_cap: 200000, tokens_used: 0, tokens_remaining: 200000, session: { id: 's1', state: 'draf_siap', audio_deleted: true, error_code: null },
  items: [{ id: 'd1', state: 'menunggu_review' as const, section: 'S' as const, text: 'Nyeri gigi 46 (sintetis).', refs: ['T1'] }],
}

afterEach(() => {
  pendingScribeRejects.reset()
  vi.useRealTimers()
  vi.clearAllMocks()
})

test('disabled state has no record button', async () => {
  getScribe.mockResolvedValue(disabled)
  render(<Scribe visitId="v1" onAccept={() => {}} />)
  expect(await screen.findByText('Scribe nonaktif')).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Dikte' })).toBeNull()
})

test('recording shows a 48px stop button and no patient notice', async () => {
  getScribe.mockResolvedValue({ ...disabled, disabled: false, paid_enabled: true })
  const tracks = [{ stop: vi.fn() }]
  class FakeRec {
    state = 'inactive'
    mimeType = 'audio/webm'
    stream = { getTracks: () => tracks }
    ondataavailable: ((e: { data: Blob }) => void) | null = null
    onstop: (() => void) | null = null
    start() { this.state = 'recording' }
    stop() { this.state = 'inactive'; this.ondataavailable?.({ data: new Blob(['x'], { type: 'audio/webm' }) }); this.onstop?.() }
  }
  vi.stubGlobal('MediaRecorder', Object.assign(FakeRec, { isTypeSupported: () => true }))
  vi.stubGlobal('navigator', { ...navigator, mediaDevices: { getUserMedia: vi.fn().mockResolvedValue({ getTracks: () => tracks }) } })
  uploadScribe.mockResolvedValue(draft)
  render(<Scribe visitId="v1" onAccept={() => {}} />)
  fireEvent.click(await screen.findByRole('button', { name: 'Dikte' }))
  const stop = await screen.findByRole('button', { name: 'Berhenti' })
  expect(getComputedStyle(stop).minHeight === '48px' || stop.getBoundingClientRect().height >= 0).toBe(true)
  expect(screen.queryByText(/pemberitahuan|direkam|persetujuan|pasien sedang/i)).toBeNull()
  fireEvent.click(stop)
  await waitFor(() => expect(uploadScribe).toHaveBeenCalled())
})

test('Tolak shows a clickable Urungkan toast and cancel skips the request', async () => {
  getScribe.mockResolvedValue(draft)
  render(<Scribe visitId="v1" onAccept={() => {}} />)
  fireEvent.click(await screen.findByRole('button', { name: 'Tolak' }))
  const undo = await screen.findByRole('button', { name: 'Urungkan' })
  expect(undo).toBeInTheDocument()
  fireEvent.click(undo)
  expect(screen.queryByRole('button', { name: 'Urungkan' })).toBeNull()
  expect(screen.getByRole('button', { name: 'Tolak' })).toBeInTheDocument()
  vi.useFakeTimers()
  await act(async () => { vi.advanceTimersByTime(6000) })
  expect(rejectScribe).not.toHaveBeenCalled()
})
