import { expect, test } from 'vitest'
// @ts-expect-error -- @types/node is not installed; vitest runs on Node, so node:fs exists at test time.
import { readFileSync } from 'node:fs'

// #70 gloved hands (phone): the Selesai attestation checkbox itself is 48px, inside a 48px row; phone teeth are drawn wider.
// vitest runs from app/frontend (jsdom's import.meta.url is not a file URL)
const root: string = (globalThis as unknown as { process: { cwd(): string } }).process.cwd()
const css: string = readFileSync(`${root}/src/modules/clinical/clinical.css`, 'utf8')
const styles: string = readFileSync(`${root}/src/shared/ui/styles.css`, 'utf8')

test('Selesai attestation: the whole row is a >=48px target with pressed/checked states; the 20px phone rule skips dialogs', () => {
  expect(css).toMatch(/\.dialog \.check \{ min-height: 56px; width: 100%;/)
  expect(css).toMatch(/\.dialog \.check:active \{/)
  expect(css).toMatch(/\.dialog \.check:has\(input:checked\) \{/)
  expect(styles).toMatch(/label\.check:not\(\.dialog \*\) input \{ width: 20px;/)
})

test('phone odontogram is wide enough for ~52px teeth', () => {
  expect(css).toMatch(/\.odo-jaw-scroll \.odontogram \{ min-width: 1100px; \}/)
})
