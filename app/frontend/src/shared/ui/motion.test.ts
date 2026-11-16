import { expect, test } from 'vitest'
// @ts-expect-error -- @types/node is not installed; vitest runs on Node, so node:fs exists at test time.
import { readFileSync } from 'node:fs'
import { createElement } from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { Presence } from './presence'

const css = (f: string): string => readFileSync(new URL(f, import.meta.url), 'utf8')
const tokens = css('tokens.css'), motion = css('motion.css')

test('tokens.css memuat token gerak 120/200/280 ms dan easing dari design/tokens.json', () => {
  expect(tokens).toMatch(/--motion-fast:\s*120ms/)
  expect(tokens).toMatch(/--motion-std:\s*200ms/)
  expect(tokens).toMatch(/--motion-slow:\s*280ms/)
  expect(tokens).toContain('--motion-ease-standard: cubic-bezier(0.2, 0, 0, 1)')
  expect(tokens).toContain('--motion-ease-enter: cubic-bezier(0.16, 1, 0.3, 1)')
  expect(tokens).toContain('--motion-ease-exit: cubic-bezier(0.4, 0, 1, 1)')
  expect(tokens).toContain('--motion-ease-spring: cubic-bezier(0.32, 0.72, 0, 1)')
  expect(tokens).toMatch(/--motion-distance-page:\s*8px/)
})

test('motion.css mematikan geser dan skala saat prefers-reduced-motion', () => {
  expect(motion).toContain('@media (prefers-reduced-motion: reduce)')
  expect(motion).toContain('transform: none !important')
})

test('Presence unmount segera di mode tes setelah ditutup (agar assertion sinkron tetap lolos)', () => {
  const dialog = createElement('div', { role: 'dialog' }, createElement('button', { type: 'button' }, 'Tutup'))
  const { rerender } = render(createElement(Presence, { open: true, children: dialog }))
  expect(screen.getByRole('dialog')).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Tutup' }))
  rerender(createElement(Presence, { open: false, children: dialog }))
  expect(screen.queryByRole('dialog')).toBeNull()
})
