import { expect, test } from 'vitest'
import { age, dob } from './Patients'

const fmt = (s: string) => new Intl.DateTimeFormat('id-ID', { timeZone: 'UTC', day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(s + 'T00:00:00Z'))

test('date-only keeps existing output', () => {
  expect(dob('2017-11-14')).toBe(fmt('2017-11-14'))
  expect(dob('2017-11-14')).toMatch(/14 Nov.* 2017/)
  expect(age('2017-11-14')).toMatch(/^\d+ th$/)
})

test('ISO datetime with fractional seconds (Family API) matches date-only', () => {
  expect(dob('2017-11-14T00:00:00.000000Z')).toBe(dob('2017-11-14'))
  expect(age('2017-11-14T00:00:00.000000Z')).toBe(age('2017-11-14'))
})

test('ISO datetime without fraction, with or without Z, does not shift the day', () => {
  expect(dob('2017-11-14T00:00:00Z')).toBe(dob('2017-11-14'))
  expect(dob('2017-11-14T23:30:00')).toBe(dob('2017-11-14'))
  expect(age('2017-11-14T00:00:00Z')).toBe(age('2017-11-14'))
})

test.each([null, '', 'garbage', '2017-13-45', 'Nov 14 2017'])('unparseable %j renders like null', (v) => {
  expect(() => dob(v)).not.toThrow()
  expect(dob(v)).toBe('—')
  expect(age(v)).toBe('')
})
