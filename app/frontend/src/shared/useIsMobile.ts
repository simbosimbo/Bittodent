import { useCallback, useSyncExternalStore } from 'react'

// Single mobile breakpoint for JS-driven layout; keep in sync with the CSS `@media (max-width: 720px)` blocks.
export const MOBILE_QUERY = '(max-width: 720px)'
/** Phone width (Claude Design sketch is 390px): odontogram splits into one scroller per jaw. */
export const PHONE_QUERY = '(max-width: 480px)'
const mql = (q: string) => (typeof window.matchMedia === 'function' ? window.matchMedia(q) : null)

/** true while the media query matches. No matchMedia (jsdom default) = desktop. */
export function useMedia(q: string) {
  const subscribe = useCallback((f: () => void) => {
    const m = mql(q)
    m?.addEventListener?.('change', f)
    return () => m?.removeEventListener?.('change', f)
  }, [q])
  return useSyncExternalStore(subscribe, () => mql(q)?.matches ?? false)
}

/** true at ≤720px. */
export const useIsMobile = () => useMedia(MOBILE_QUERY)
