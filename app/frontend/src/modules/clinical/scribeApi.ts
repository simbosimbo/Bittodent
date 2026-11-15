import { ApiError, api, csrfCookie, hasCsrfCookie } from '../../shared/api/http'

export type ScribeSection = 'S' | 'O' | 'A' | 'P'
export type ScribeItemState = 'menunggu_review' | 'disetujui' | 'ditolak' | 'digantikan'

export type ScribeItem = {
  id: string
  state: ScribeItemState
  section: ScribeSection | null
  text: string
  refs: string[]
}

export type ScribeStatus = {
  paid_enabled: boolean
  disabled: boolean
  token_cap: number
  tokens_used: number
  tokens_remaining: number
  session: { id: string; state: string; audio_deleted: boolean; error_code: string | null } | null
  items: ScribeItem[]
}

export const getScribe = (visitId: string) => api<ScribeStatus>(`/api/visits/${visitId}/scribe`)

const xsrf = () => decodeURIComponent(document.cookie.match(/(?:^|; )XSRF-TOKEN=([^;]+)/)?.[1] ?? '')

export async function uploadScribe(visitId: string, blob: Blob, durationSec: number): Promise<ScribeStatus> {
  if (!hasCsrfCookie()) await csrfCookie()
  const body = new FormData()
  body.append('audio', blob, 'dikte.webm')
  body.append('duration_sec', String(durationSec))
  const res = await fetch(`/api/visits/${visitId}/scribe`, {
    method: 'POST', credentials: 'same-origin',
    headers: { Accept: 'application/json', 'X-XSRF-TOKEN': xsrf() },
    body,
  })
  const data = await res.json().catch(() => null)
  if (!res.ok) {
    if (res.status === 401) window.dispatchEvent(new Event('ehr:unauthorized'))
    throw new ApiError(res.status, data)
  }
  return data as ScribeStatus
}

export const approveScribe = (id: string, text?: string) =>
  api(`/api/scribe/drafts/${id}/approve`, { method: 'POST', body: text ? { text } : {} })

export const rejectScribe = (id: string, reason: string) =>
  api(`/api/scribe/drafts/${id}/reject`, { method: 'POST', body: { reason } })

export function rejectScribeKeepalive(id: string, reason: string) {
  return fetch(`/api/scribe/drafts/${id}/reject`, {
    method: 'POST', credentials: 'same-origin', keepalive: true,
    headers: { Accept: 'application/json', 'Content-Type': 'application/json', 'X-XSRF-TOKEN': xsrf() },
    body: JSON.stringify({ reason }),
  })
}
