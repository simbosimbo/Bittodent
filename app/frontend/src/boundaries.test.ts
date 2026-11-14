import { expect, test } from 'vitest'

// Module boundaries: src/modules/<a> may import src/modules/<b> only via its index.ts; src/shared imports no module.
// Paths are relative to src/ (e.g. 'modules/scheduling/Schedule.tsx').
const resolvePath = (fromFile: string, spec: string) => {
  const parts = fromFile.split('/').slice(0, -1)
  for (const seg of spec.split('/')) {
    if (seg === '..') parts.pop()
    else if (seg !== '.') parts.push(seg)
  }
  return parts
}

export function violations(file: string, code: string): string[] {
  const from = file.split('/')
  const own = from[0] === 'modules' ? from[1] : null
  const bad: string[] = []
  for (const m of code.matchAll(/(?:import|export)[^'"]*?from\s*['"]([^'"]+)['"]|import\s*\(\s*['"]([^'"]+)['"]/g)) {
    const spec = m[1] ?? m[2]
    if (!spec.startsWith('.')) continue
    const to = resolvePath(file, spec)
    if (to[0] !== 'modules' || to[1] === own) continue
    if (from[0] === 'shared') bad.push(`${file}: shared must not import ${spec}`)
    else if (own && !(to.length === 2 || (to.length === 3 && to[2] === 'index'))) bad.push(`${file}: ${spec} (use modules/${to[1]}/index.ts)`)
  }
  return bad
}

test('no file imports another module internals; shared imports no module', () => {
  const files = import.meta.glob<string>('./**/*.{ts,tsx}', { query: '?raw', import: 'default', eager: true })
  expect(Object.keys(files).length).toBeGreaterThan(15)
  const bad = Object.entries(files).flatMap(([path, code]) => violations(path.slice(2), code))
  expect(bad).toEqual([])
})

test('self-check: the scanner flags forbidden imports', () => {
  const sched = 'modules/scheduling/Schedule.tsx'
  expect(violations(sched, "import { PatientPicker } from '../patients'")).toEqual([])
  expect(violations(sched, "import { PatientPicker } from '../patients/index'")).toEqual([])
  expect(violations(sched, "import { x } from './api'")).toEqual([])
  expect(violations(sched, "import { PatientPicker } from '../patients/Patients'")).toHaveLength(1)
  expect(violations(sched, "export { searchPatients } from '../patients/api'")).toHaveLength(1)
  expect(violations('shared/layout/Shell.tsx', "import { Login } from '../../modules/auth'")).toHaveLength(1)
  expect(violations('App.tsx', "import { Login } from './modules/auth'")).toEqual([])
})
