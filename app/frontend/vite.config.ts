/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

declare const process: { env: Record<string, string | undefined> } // no @types/node in this project
const backend = process.env.BACKEND_URL ?? 'http://127.0.0.1:8000' // override for a second checkout, e.g. BACKEND_URL=http://127.0.0.1:8010
// Same-origin proxy so Sanctum session + XSRF cookies stay first-party.
const proxy = Object.fromEntries(
  ['/api', '/login', '/logout', '/two-factor-challenge', '/sanctum', '/user', '/dev/quick-login'].map((p) => [p, { target: backend }]),
)

export default defineConfig({
  plugins: [react()],
  server: { host: '127.0.0.1', port: 5173, strictPort: true, proxy },
  // css.include: lets the Shell / PatientList / Chart tests load styles.css / patients.css ?raw (vitest blanks CSS by default) to assert computed styles (pill name never ellipsized, 44px surface buttons).
  test: { environment: 'jsdom', setupFiles: ['./src/test-setup.ts'], css: { include: [/styles\.css/, /patients\.css/, /clinical\.css/] } },
})
