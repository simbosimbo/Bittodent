import { fireEvent, render, screen } from '@testing-library/react'
import { expect, test, vi } from 'vitest'
import Login from './Login'

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status })

test('password step then 6-digit authenticator step', async () => {
  const calls: string[] = []
  vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
    calls.push(`${init?.method ?? 'GET'} ${url}`)
    if (url === '/api/dev/status') return json({ message: 'Not Found' }, 404)
    if (url === '/sanctum/csrf-cookie') { document.cookie = 'XSRF-TOKEN=abc'; return new Response(null, { status: 204 }) }
    if (url === '/login') return json({ two_factor: true })
    if (url === '/two-factor-challenge') {
      const { code } = JSON.parse(init!.body as string)
      return code === '123456' ? new Response(null, { status: 204 }) : json({ message: 'invalid', errors: { code: ['x'] } }, 422)
    }
    throw new Error('unexpected ' + url)
  }))
  const onLoggedIn = vi.fn()
  render(<Login onLoggedIn={onLoggedIn} />)

  fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'depan@senyum.test' } })
  fireEvent.change(screen.getByLabelText('Kata sandi'), { target: { value: 'rahasia-dev-123' } })
  fireEvent.click(screen.getByRole('button', { name: 'Masuk' }))

  expect(await screen.findByRole('heading', { name: 'Kode autentikator' })).toBeInTheDocument()
  expect(onLoggedIn).not.toHaveBeenCalled()

  const input = screen.getByLabelText('Kode 6 angka')
  fireEvent.change(input, { target: { value: '000000' } })
  fireEvent.click(screen.getByRole('button', { name: 'Verifikasi' }))
  expect(await screen.findByText('Kode autentikator salah atau kedaluwarsa.')).toBeInTheDocument()

  fireEvent.change(input, { target: { value: '123456' } })
  fireEvent.click(screen.getByRole('button', { name: 'Verifikasi' }))
  await vi.waitFor(() => expect(onLoggedIn).toHaveBeenCalledOnce())
  expect(calls).toEqual(['GET /api/dev/status', 'GET /sanctum/csrf-cookie', 'POST /login', 'POST /two-factor-challenge', 'POST /two-factor-challenge'])
  vi.unstubAllGlobals()
})

test('dev quick-login picker: hidden when /api/dev/status is 404, logs in without TOTP when on', async () => {
  vi.stubGlobal('fetch', vi.fn(async () => json({ message: 'Not Found' }, 404)))
  const { unmount } = render(<Login onLoggedIn={vi.fn()} />)
  await vi.waitFor(() => expect(fetch).toHaveBeenCalledWith('/api/dev/status', expect.anything()))
  expect(screen.queryByRole('region', { name: 'Masuk cepat (dev)' })).not.toBeInTheDocument()
  unmount()

  const calls: string[] = []
  vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
    calls.push(`${init?.method ?? 'GET'} ${url}${init?.body ? ' ' + init.body : ''}`)
    if (url === '/api/dev/status') return json({ quick_login: true, accounts: [{ email: 'depan@senyum.test', name: 'Front Desk Contoh' }] })
    if (url === '/sanctum/csrf-cookie') return new Response(null, { status: 204 })
    if (url === '/dev/quick-login') return new Response(null, { status: 204 })
    throw new Error('unexpected ' + url)
  }))
  const onLoggedIn = vi.fn()
  render(<Login onLoggedIn={onLoggedIn} />)
  fireEvent.click(await screen.findByRole('button', { name: /Resepsionis/ }))
  await vi.waitFor(() => expect(onLoggedIn).toHaveBeenCalledOnce())
  expect(calls).toEqual(['GET /api/dev/status', 'GET /sanctum/csrf-cookie', 'POST /dev/quick-login {"user_email":"depan@senyum.test"}'])
  vi.unstubAllGlobals()
})

test('brand: Bittodent with DATA SINTETIS badge, no EHR Gigi or PROTOTIPE', async () => {
  vi.stubGlobal('fetch', vi.fn(async () => json({ message: 'Not Found' }, 404)))
  const { container } = render(<Login onLoggedIn={vi.fn()} />)
  await vi.waitFor(() => expect(fetch).toHaveBeenCalledWith('/api/dev/status', expect.anything()))
  expect(container.querySelector('.brand')).toHaveTextContent('Bittodent')
  expect(container.querySelector('.brand-mark svg')).toBeInTheDocument()
  expect(container.querySelector('.badge-synthetic')).toHaveTextContent(/^DATA SINTETIS$/)
  expect(container).not.toHaveTextContent('EHR Gigi')
  expect(container).not.toHaveTextContent('PROTOTIPE')
})
