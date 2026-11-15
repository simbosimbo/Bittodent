import { expect, test } from 'vitest'
// @ts-expect-error -- @types/node is not installed; vitest runs on Node, so node:fs exists at test time.
import { readFileSync } from 'node:fs'

// #70 gloved hands (phone): the Selesai attestation checkbox itself is 48px, inside a 48px row; phone teeth are drawn wider.
const css: string = readFileSync(new URL('clinical.css', import.meta.url), 'utf8')

test('Selesai attestation checkbox is 48x48 on a phone', () => {
  expect(css).toMatch(/\.dialog \.check input \{ width: 48px; height: 48px;/)
  expect(css).toMatch(/\.dialog \.check \{ min-height: 48px;/)
})

test('phone odontogram is wide enough for ~52px teeth', () => {
  expect(css).toMatch(/\.odo-jaw-scroll \.odontogram \{ min-width: 1100px; \}/)
})
