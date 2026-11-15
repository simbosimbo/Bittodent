import { render, screen } from '@testing-library/react'
import { afterEach, expect, test, vi } from 'vitest'
import App from './App'

const calls: string[] = []
const stubFetch = () => vi.stubGlobal('fetch', vi.fn(async (url: string) => {
  calls.push(url)
  return new Response(JSON.stringify({ message: 'x' }), { status: url === '/api/me' ? 401 : 404 })
}))
afterEach(() => { calls.length = 0; document.cookie = 'XSRF-TOKEN=; expires=Thu, 01 Jan 1970 00:00:00 GMT' })

test('fresh visit without XSRF-TOKEN shows login without calling /api/me', async () => {
  stubFetch()
  render(<App />)
  expect(await screen.findByLabelText('Email')).toBeInTheDocument()
  expect(calls).not.toContain('/api/me')
})

test('with XSRF-TOKEN it still asks /api/me, 401 → login', async () => {
  document.cookie = 'XSRF-TOKEN=abc'
  stubFetch()
  render(<App />)
  expect(await screen.findByLabelText('Email')).toBeInTheDocument()
  expect(calls).toContain('/api/me')
})
