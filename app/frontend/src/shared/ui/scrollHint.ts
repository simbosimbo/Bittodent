import { useEffect } from 'react'

/** Horizontal scrollers that get an edge fade on a phone (styles.css `[data-more]`). */
export const SCROLL_HINT = '.pl-filters, .tabs, .chair-pills, .odo2d-wrap, .table-scroll, .tl-scroll'

/** data-more = "start" | "end" | "both" while more content exists past that edge; removed when it all fits. */
export function markScroll(el: Element) {
  const max = el.scrollWidth - el.clientWidth
  const start = el.scrollLeft > 1, end = el.scrollLeft < max - 1
  const v = start && end ? 'both' : start ? 'start' : end ? 'end' : null
  if (v) { if (el.getAttribute('data-more') !== v) el.setAttribute('data-more', v) }
  else el.removeAttribute('data-more')
}

/** While `on` (mobile only, so the desktop DOM stays untouched): keep data-more current on every SCROLL_HINT element. */
export function useScrollHints(on: boolean) {
  useEffect(() => {
    if (!on) return
    const all = () => document.querySelectorAll(SCROLL_HINT).forEach(markScroll)
    const onScroll = (e: Event) => { if (e.target instanceof Element && e.target.matches(SCROLL_HINT)) markScroll(e.target) }
    let frame = 0
    const later = () => { cancelAnimationFrame(frame); frame = requestAnimationFrame(all) }
    const mo = new MutationObserver(later) // new pages / tabs / loaded rows
    mo.observe(document.body, { childList: true, subtree: true })
    document.addEventListener('scroll', onScroll, true)
    addEventListener('resize', later)
    all()
    return () => {
      mo.disconnect()
      cancelAnimationFrame(frame)
      document.removeEventListener('scroll', onScroll, true)
      removeEventListener('resize', later)
      document.querySelectorAll('[data-more]').forEach((el) => el.removeAttribute('data-more'))
    }
  }, [on])
}
