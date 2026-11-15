import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, test, vi } from 'vitest'
import { DateField } from './DateField'

const viewport = (w: number) => vi.stubGlobal('matchMedia', (q: string) => ({ media: q, matches: w <= 720, addEventListener() {}, removeEventListener() {} }))
afterEach(() => vi.unstubAllGlobals())

test('desktop: the plain native input, nothing else', () => {
  viewport(1280)
  const { container } = render(<DateField aria-label="Tanggal" value="2026-11-15" onChange={() => {}} />)
  const plain = render(<input type="date" aria-label="Tanggal" value="2026-11-15" onChange={() => {}} />).container
  expect(container.innerHTML).toBe(plain.innerHTML) // same DOM as before DateField existed
})

test('phone: Indonesian label over the native input; changes still flow through the input', () => {
  viewport(390)
  const change = vi.fn()
  const { container, rerender } = render(<DateField aria-label="Tanggal" value="2026-11-15" onChange={(e) => change(e.target.value)} />)
  expect(container.querySelector('.date-field-text')).toHaveTextContent('15 Nov 2026')
  expect(container.querySelector('.date-field-text')).toHaveAttribute('aria-hidden', 'true')
  fireEvent.change(screen.getByLabelText('Tanggal'), { target: { value: '2026-12-01' } })
  expect(change).toHaveBeenCalledWith('2026-12-01')
  rerender(<DateField aria-label="Tanggal" value="" placeholder="Hari ini" onChange={() => {}} />)
  expect(container.querySelector('.date-field-text')).toHaveTextContent('Hari ini')
})
