import { expect, test, vi } from 'vitest'
import { clearLetterhead, loadLetterhead } from './letterhead'

test('the letterhead is cached for the session and fetched again after logout (no previous clinic kop)', async () => {
  const names = ['Klinik A', 'Klinik B']
  const fetchMock = vi.fn(async () => new Response(JSON.stringify({ name: names.shift() }), { status: 200, headers: { 'Content-Type': 'application/json' } }))
  vi.stubGlobal('fetch', fetchMock)
  expect((await loadLetterhead()).name).toBe('Klinik A')
  expect((await loadLetterhead()).name).toBe('Klinik A')
  expect(fetchMock).toHaveBeenCalledTimes(1)
  clearLetterhead()
  expect((await loadLetterhead()).name).toBe('Klinik B')
  vi.unstubAllGlobals()
})
