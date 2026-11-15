// The one HTTP client: same-origin cookies (Sanctum session) + XSRF header. Nothing is cached or stored client-side.
// Modules build their endpoint functions on top of this in modules/<m>/api.ts.
export class ApiError extends Error {
  constructor(public status: number, public data: any) {
    super(data?.message ?? `HTTP ${status}`)
  }
}

const xsrf = () => decodeURIComponent(document.cookie.match(/(?:^|; )XSRF-TOKEN=([^;]+)/)?.[1] ?? '')

export const csrfCookie = () => fetch('/sanctum/csrf-cookie', { credentials: 'same-origin' })

export async function api<T = any>(path: string, opts: { method?: string; body?: unknown } = {}): Promise<T> {
  const method = opts.method ?? 'GET'
  if (method !== 'GET' && !xsrf()) await csrfCookie()
  const form = opts.body instanceof FormData // multipart upload: the browser sets the boundary header
  const res = await fetch(path, {
    method,
    credentials: 'same-origin',
    headers: { Accept: 'application/json', ...(form ? {} : { 'Content-Type': 'application/json' }), 'X-XSRF-TOKEN': xsrf() },
    body: opts.body === undefined ? undefined : form ? (opts.body as FormData) : JSON.stringify(opts.body),
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
