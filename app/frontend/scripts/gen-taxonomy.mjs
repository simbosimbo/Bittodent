// Copies the odontogram v2 taxonomy (the one data table, app/backend/resources/odontogram/taxonomy.json) into the frontend:
// src/modules/clinical/odontogram/taxonomy.json. Committed, like tokens.css; `npm run taxonomy` after editing the backend file.
// taxonomy.test.ts fails when the two differ.
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const src = resolve(here, '../../backend/resources/odontogram/taxonomy.json')
const out = resolve(here, '../src/modules/clinical/odontogram/taxonomy.json')
writeFileSync(out, JSON.stringify(JSON.parse(readFileSync(src, 'utf8')), null, 2) + '\n')
console.log('taxonomy.json:', out)
