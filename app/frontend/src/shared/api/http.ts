// The one HTTP client: same-origin cookies (Sanctum session) + XSRF header. Nothing is cached or stored client-side.
// Modules build their endpoint functions on top of this in modules/<m>/api.ts.
export class ApiError extends Error {
  constructor(public status: number, public data: any) {
    super(data?.message ?? `HTTP ${status}`)
  }
}

const xsrf = () => decodeURIComponent(document.cookie.match(/(?:^|; )XSRF-TOKEN=([^;]+)/)?.[1] ?? '')

// Session cookie (<slug APP_NAME>-session, e.g. bittodent-session) is HttpOnly, so the JS-visible XSRF-TOKEN is our only hint that a session may exist.
export const hasCsrfCookie = () => xsrf() !== ''

export const csrfCookie = () => fetch('/sanctum/csrf-cookie', { credentials: 'same-origin' })

export async function api<T = any>(path: string, opts: { method?: string; body?: unknown } = {}): Promise<T> {
  const method = opts.method ?? 'GET'
  if (method !== 'GET' && !xsrf()) await csrfCookie()
  const res = await fetch(path, {
    method,
    credentials: 'same-origin',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json', 'X-XSRF-TOKEN': xsrf() },
    body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
  })
  const data = res.status === 204 ? null : await res.json().catch(() => null)
  if (!res.ok) {
    if (res.status === 401) window.dispatchEvent(new Event('ehr:unauthorized'))
    throw new ApiError(res.status, data)
  }
  return data as T
}

export const errorText = (e: unknown) =>
  e instanceof ApiError && e.status === 403 ? 'Anda tidak punya akses untuk ini.' : 'Gagal memuat data. Coba lagi.'

/** Multipart POST of one file (clinic logo, QRIS photo); same session cookie + XSRF header as api(). */
export async function upload<T = any>(path: string, field: string, file: Blob): Promise<T> {
  if (!xsrf()) await csrfCookie()
  const body = new FormData()
  body.append(field, file)
  const res = await fetch(path, { method: 'POST', credentials: 'same-origin', headers: { Accept: 'application/json', 'X-XSRF-TOKEN': xsrf() }, body })
  const data = await res.json().catch(() => null)
  if (!res.ok) {
    if (res.status === 401) window.dispatchEvent(new Event('ehr:unauthorized'))
    throw new ApiError(res.status, data)
  }
  return data as T
}
