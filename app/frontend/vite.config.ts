/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const backend = 'http://127.0.0.1:8000'
// Same-origin proxy so Sanctum session + XSRF cookies stay first-party.
const proxy = Object.fromEntries(
  ['/api', '/login', '/logout', '/two-factor-challenge', '/sanctum', '/user', '/dev/quick-login'].map((p) => [p, { target: backend }]),
)

export default defineConfig({
  plugins: [react()],
  server: { host: '127.0.0.1', port: 5173, strictPort: true, proxy },
  // css.include: lets the Shell test load styles.css?raw (vitest blanks CSS by default) to assert the pill name is never ellipsized.
  test: { environment: 'jsdom', setupFiles: ['./src/test-setup.ts'], css: { include: [/styles\.css/] } },
})
