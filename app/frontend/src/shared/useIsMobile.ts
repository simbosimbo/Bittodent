import { useSyncExternalStore } from 'react'

// Single mobile breakpoint for JS-driven layout; keep in sync with the CSS `@media (max-width: 720px)` blocks.
export const MOBILE_QUERY = '(max-width: 720px)'
const mql = () => (typeof window.matchMedia === 'function' ? window.matchMedia(MOBILE_QUERY) : null)
const subscribe = (f: () => void) => {
  const m = mql()
  m?.addEventListener?.('change', f)
  return () => m?.removeEventListener?.('change', f)
}

/** true at ≤720px. No matchMedia (jsdom default) = desktop. */
export const useIsMobile = () => useSyncExternalStore(subscribe, () => mql()?.matches ?? false)
