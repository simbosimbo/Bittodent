import { rejectIcd, rejectIcdKeepalive, type IcdRejectReason } from './icdApi'

// Delayed commit for Tolak (A1). Drafts are immutable once rejected, so the API call waits 5 seconds (or page leave)
// and can be cancelled with Urungkan. The same pattern should be applied to A2 later (PR #57 is not changed here).
export const REJECT_DELAY_MS = 5000

export type PendingReject = { id: string; reason?: IcdRejectReason }

type Entry = PendingReject & { timer: ReturnType<typeof setTimeout> }

class PendingRejects {
  private entries = new Map<string, Entry>()
  private listeners = new Set<() => void>()
  private hooked = false
  private last: string | null = null

  subscribe(fn: () => void) {
    this.listeners.add(fn)
    return () => { this.listeners.delete(fn) }
  }

  private emit() {
    this.listeners.forEach((fn) => fn())
  }

  list(): PendingReject[] {
    return [...this.entries.values()].map(({ id, reason }) => ({ id, reason }))
  }

  has(id: string) {
    return this.entries.has(id)
  }

  latest(): PendingReject | null {
    if (!this.last || !this.entries.has(this.last)) return null
    const e = this.entries.get(this.last)!
    return { id: e.id, reason: e.reason }
  }

  queue(id: string, reason?: IcdRejectReason, delay = REJECT_DELAY_MS) {
    this.cancel(id)
    this.hook()
    const timer = setTimeout(() => { void this.send(id, false) }, delay)
    this.entries.set(id, { id, reason, timer })
    this.last = id
    this.emit()
  }

  cancel(id: string): boolean {
    const e = this.entries.get(id)
    if (!e) return false
    clearTimeout(e.timer)
    this.entries.delete(id)
    if (this.last === id) this.last = [...this.entries.keys()].at(-1) ?? null
    this.emit()
    return true
  }

  /** Send every pending reject now (page leave). Uses keepalive so the browser will not cancel the request. */
  flush = (): number => {
    const ids = [...this.entries.keys()]
    for (const id of ids) void this.send(id, true)
    return ids.length
  }

  private onVisibility = () => {
    if (document.visibilityState === 'hidden') this.flush()
  }

  hook() {
    if (this.hooked || typeof window === 'undefined') return
    this.hooked = true
    window.addEventListener('pagehide', this.flush)
    document.addEventListener('visibilitychange', this.onVisibility)
  }

  unhook() {
    if (!this.hooked || typeof window === 'undefined') return
    window.removeEventListener('pagehide', this.flush)
    document.removeEventListener('visibilitychange', this.onVisibility)
    this.hooked = false
  }

  /** Drop pending work without sending. For tests. */
  reset() {
    for (const e of this.entries.values()) clearTimeout(e.timer)
    this.entries.clear()
    this.last = null
    this.unhook()
    this.emit()
  }

  private async send(id: string, keepalive: boolean) {
    const e = this.entries.get(id)
    if (!e) return
    clearTimeout(e.timer)
    this.entries.delete(id)
    if (this.last === id) this.last = [...this.entries.keys()].at(-1) ?? null
    this.emit()
    try {
      if (keepalive) void rejectIcdKeepalive(id, e.reason)
      else await rejectIcd(id, e.reason)
    } catch {
      // Already removed from the queue so a retry does not double-send. The caller reloads and the item may reappear as draf.
    }
  }
}

export const pendingRejects = new PendingRejects()
