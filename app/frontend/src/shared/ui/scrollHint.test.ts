import { expect, test } from 'vitest'
import { markScroll } from './scrollHint'

const box = (scrollWidth: number, clientWidth: number, scrollLeft: number) => {
  const el = document.createElement('div')
  Object.defineProperties(el, { scrollWidth: { value: scrollWidth }, clientWidth: { value: clientWidth } })
  el.scrollLeft = scrollLeft
  Object.defineProperty(el, 'scrollLeft', { value: scrollLeft })
  return el
}

test('data-more marks which edge still has content; removed when it all fits', () => {
  const at = (sw: number, cw: number, sl: number) => { const el = box(sw, cw, sl); markScroll(el); return el.getAttribute('data-more') }
  expect(at(300, 300, 0)).toBeNull()
  expect(at(600, 300, 0)).toBe('end')
  expect(at(600, 300, 150)).toBe('both')
  expect(at(600, 300, 300)).toBe('start')
})
