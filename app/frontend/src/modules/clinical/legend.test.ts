import { expect, test } from 'vitest'
import { findingText, STATUSES, surfaceLabel, surfaceName, surfacesOf, toothAnatomicalName } from './legend'

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

test('B is Labial on anterior teeth and Bukal on posterior teeth', () => {
  for (const t of [11, 13, 43, 51, 83]) expect(surfaceName(t, 'B')).toBe('Labial')
  for (const t of [14, 16, 46, 55, 85]) expect(surfaceName(t, 'B')).toBe('Bukal')
})

test.each([
  [11, 'Insisor sentral kanan atas'], [16, 'Molar pertama kanan atas'], [21, 'Insisor sentral kiri atas'], [23, 'Kaninus kiri atas'],
  [36, 'Molar pertama kiri bawah'], [44, 'Premolar pertama kanan bawah'], [48, 'Molar ketiga kanan bawah'],
  [54, 'Molar pertama sulung kanan atas'], [62, 'Insisor lateral sulung kiri atas'], [71, 'Insisor sentral sulung kiri bawah'], [85, 'Molar kedua sulung kanan bawah'],
])('toothAnatomicalName(%i) = %s', (t, name) => expect(toothAnatomicalName(t)).toBe(name))

test.each([0, 10, 19, 56, 66, 86, 90, 99, 100, -11, 36.5, NaN])('toothAnatomicalName(%s) falls back to "Gigi n"', (t) => {
  expect(toothAnatomicalName(t)).toBe(`Gigi ${t}`)
})
