import { expect, test } from 'vitest'
import { CHOOSABLE, findingText, procedureText, sameSite, STATUSES, surfaceLabel, surfacesOf } from './legend'

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

test('procedure statuses mirror ProcedureStatus::TRANSITIONS: eight keys, selesai final, every target exists', () => {
  expect(STATUSES.map((s) => s.key)).toEqual(['kondisi_pantau', 'ada_di_klinik_ini', 'ada_di_tempat_lain', 'direncanakan', 'selesai', 'dirujuk', 'cancelled', 'superseded'])
  expect(CHOOSABLE.map((s) => s.key)).not.toContain('superseded')
  expect(STATUSES.find((s) => s.key === 'selesai')!.next).toEqual([])
  for (const s of STATUSES) for (const n of s.next) expect(STATUSES.some((x) => x.key === n)).toBe(true)
})

test('a MOD filling is one line of text with every surface (upper L shown as P)', () => {
  expect(procedureText({ tooth: 26, surfaces: 'MODL', name: 'Tumpatan', procedure_code: '23.2' })).toBe('Gigi 26 MODP: Tumpatan (ICD-9-CM 23.2)')
  expect(procedureText({ tooth: null, surfaces: null, name: 'Scaling', procedure_code: '96.54' })).toBe('Mulut: Scaling (ICD-9-CM 96.54)')
})

test('sameSite mirrors external_same_surface: shared surface or whole tooth on the same tooth', () => {
  expect(sameSite(16, 'OD', { tooth: 16, surfaces: 'MO' })).toBe(true)
  expect(sameSite(16, 'B', { tooth: 16, surfaces: 'MO' })).toBe(false)
  expect(sameSite(16, null, { tooth: 16, surfaces: 'B' })).toBe(true)
  expect(sameSite(16, 'B', { tooth: 16, surfaces: null })).toBe(true)
  expect(sameSite(31, null, { tooth: 16, surfaces: null })).toBe(false)
})
