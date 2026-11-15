import { render } from '@testing-library/react'
import { expect, test } from 'vitest'
import { Odontogram } from './Odontogram'

const teeth = (svg: Element) => [...svg.querySelectorAll('.tooth')].map((t) => Number(t.getAttribute('data-tooth')))

test('arch omitted: one combined SVG, same viewBox and row order as before', () => {
  const { container } = render(<Odontogram marks={{}} dentition="campuran" />)
  const svgs = container.querySelectorAll('svg.odontogram')
  expect(svgs).toHaveLength(1)
  expect(svgs[0]).toHaveAttribute('viewBox', '-6 -6 906 358') // 4 rows × 82 + 30
  expect(svgs[0]).toHaveAttribute('aria-label', 'Odontogram (FDI). Pilih permukaan untuk mengisi kondisi.')
  expect(teeth(svgs[0]).slice(0, 2)).toEqual([18, 17])
  expect(teeth(svgs[0])).toEqual(expect.arrayContaining([11, 21, 51, 61, 81, 71, 41, 31]))
  expect(render(<Odontogram marks={{}} dentition="tetap" />).container.querySelector('svg')).toHaveAttribute('viewBox', '-6 -6 906 194')
})

test('arch: only that jaw, tight viewBox; campuran keeps the jaw’s primary row', () => {
  const up = render(<Odontogram marks={{}} dentition="campuran" arch="upper" />).container.querySelector('svg')!
  expect(up).toHaveAttribute('viewBox', '-6 -6 906 194') // 2 rows
  expect(up).toHaveAttribute('aria-label', 'Rahang atas (FDI). Pilih permukaan untuk mengisi kondisi.')
  expect(teeth(up)).toEqual(expect.arrayContaining([11, 21, 51, 61]))
  expect(teeth(up)).not.toContain(41)
  const low = render(<Odontogram marks={{}} dentition="tetap" arch="lower" compact />).container.querySelector('svg')!
  expect(low).toHaveClass('odontogram', 'is-compact')
  expect(low).toHaveAttribute('viewBox', '-6 -6 906 112') // 1 row
  expect(teeth(low)).toHaveLength(16)
  expect(teeth(low)).not.toContain(81)
  // Lower row sits at the top of its own SVG (no empty upper row above it).
  expect(low.querySelector('#t48')).toHaveAttribute('transform', 'translate(12,22)')
})

test('#70 phone (arch set): the centre surface is larger (28 of 44 units) than on desktop (20 of 44)', () => {
  const centre = (el: HTMLElement) => Number(el.querySelector('#t26-O rect')!.getAttribute('width'))
  const desk = render(<Odontogram marks={{}} />)
  expect(centre(desk.container)).toBe(20)
  desk.unmount()
  const phone = render(<Odontogram marks={{}} arch="upper" />)
  expect(centre(phone.container)).toBe(28)
})
