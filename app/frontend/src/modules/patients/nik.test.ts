import { expect, test } from 'vitest'
import { nikMismatches, parseNik } from './nik'

test('parses male/female NIK like the backend', () => {
  expect(parseNik('3201011501900001')).toEqual({ province: '32', regency: '01', district: '01', dob: '1990-01-15', sex: 'laki_laki' })
  expect(parseNik('3201 0155 0190 0001')).toMatchObject({ dob: '1990-01-15', sex: 'perempuan' })
  expect(parseNik('3201011501100001')?.dob).toBe('2010-01-15')
  expect(parseNik('3201013201900001')).toBeNull()
  expect(parseNik('320101')).toBeNull()
})

test('reports only filled fields that disagree', () => {
  expect(nikMismatches('3201011501900001', {})).toEqual([])
  expect(nikMismatches('3201011501900001', { dob: '1990-01-15', sex: 'laki_laki', province: '32', regency: '1', district: '01' })).toEqual([])
  expect(nikMismatches('3201011501900001', { dob: '1990-01-16', sex: 'perempuan', province: '33', district: '02' })).toEqual(['dob', 'sex', 'province', 'district'])
})
