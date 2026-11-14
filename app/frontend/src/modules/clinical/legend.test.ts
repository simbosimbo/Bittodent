import { expect, test } from 'vitest'
import { findingText, STATUSES, surfaceLabel, surfacesOf } from './legend'

test('L is labelled P on upper teeth (quadrants 1, 2, 5, 6) and L on lower teeth', () => {
  for (const t of [16, 21, 55, 61]) expect(surfaceLabel(t, 'L')).toBe('P')
  for (const t of [36, 41, 75, 85]) expect(surfaceLabel(t, 'L')).toBe('L')
  expect(surfaceLabel(16, 'B')).toBe('B')
  expect(findingText({ tooth: 26, surface: 'L', condition: 'karies' })).toBe('Gigi 26 P (Palatal): Karies')
})

test('anterior teeth use I, posterior teeth use O', () => {
  expect(surfacesOf(11)).toContain('I')
  expect(surfacesOf(53)).toContain('I')
  expect(surfacesOf(46)).toContain('O')
  expect(surfacesOf(46)).not.toContain('I')
})

test('procedure statuses mirror ProcedureStatus::TRANSITIONS: six keys, selesai final, every target exists', () => {
  expect(STATUSES.map((s) => s.key)).toEqual(['kondisi_pantau', 'ada_di_klinik_ini', 'ada_di_tempat_lain', 'direncanakan', 'selesai', 'dirujuk'])
  expect(STATUSES.find((s) => s.key === 'selesai')!.next).toEqual([])
  for (const s of STATUSES) for (const n of s.next) expect(STATUSES.some((x) => x.key === n)).toBe(true)
})
