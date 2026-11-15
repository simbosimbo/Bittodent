// @ts-expect-error -- @types/node is not installed; vitest runs on Node.
import { readFileSync } from 'node:fs'
import { expect, test } from 'vitest'
import { defaultRoles, padLabel, padsFor, spanTeeth, storedSurface, TAXONOMY } from './taxonomy'

test('taxonomy.json is the generated copy of the backend table (npm run taxonomy)', () => {
  const back = JSON.parse(readFileSync(`${(globalThis as unknown as { process: { cwd(): string } }).process.cwd()}/../backend/resources/odontogram/taxonomy.json`, 'utf8'))
  expect(TAXONOMY).toEqual(back)
})
test('official codes are lowercase; V is stored as B; pads per tooth', () => {
  for (const c of TAXONOMY.conditions) if (c.code) expect(c.code).toBe(c.code.toLowerCase())
  expect(storedSurface('V')).toBe('B')
  expect(padsFor(26).map((s) => s.key)).toEqual(['M', 'O', 'D', 'V', 'L'])
  expect(padsFor(11).map((s) => s.key)).toEqual(['M', 'I', 'D', 'V', 'L'])
  expect(padLabel(26, 'L')).toBe('P')
  expect(TAXONOMY.dentitions.primary).toContain(85)
})
test('bridge span: teeth along the drawn arch, ends abutment, middle pontic', () => {
  expect(spanTeeth(36, 34)).toEqual([34, 35, 36])
  expect(spanTeeth(14, 44)).toEqual([])
  expect(defaultRoles([34, 35, 36])).toEqual({ 34: 'abutment', 35: 'pontic', 36: 'abutment' })
})
