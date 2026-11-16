import { expect, test } from 'vitest'
import type { Procedure } from './api'
import { findingSummary } from './Chart'

const row = (o: Partial<Procedure>) => ({ tooth: null, tooth_range: null, status: 'ada_di_klinik_ini', external_confirmation: null, condition: null, ...o }) as Procedure

test('summary counts odontogram v2 entries per tooth with the official code; legacy findings still counted; exclusions like the chart', () => {
  expect(findingSummary([], [])).toBe('')
  const procs = [row({ tooth: 18, condition: 'hilang' }), row({ tooth: 28, condition: 'hilang' }), row({ tooth: 28, condition: 'hilang' }), // same tooth once
    row({ tooth: 47, condition: 'tambalan_amalgam' }), row({ tooth_range: '44-46', condition: 'jembatan_porselen', status: 'direncanakan' }),
    row({ tooth: 11, condition: 'sehat' }), row({ tooth: 12, condition: 'sehat', status: 'cancelled' }), row({ tooth: 13, condition: 'karies', external_confirmation: 'pending' }),
    row({ tooth: 26, condition: null, status: 'selesai' })] // pre-v2 procedure without a condition: not a finding
  expect(findingSummary([{ condition: 'karies' }], procs)).toBe('1 karies · 1 sehat (sou) · 1 tambalan amalgam (amf) · 2 gigi hilang (mis) · 3 jembatan porselen (pob)')
})
