import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// fs.allow '..' so the app can import ../tokens.json (design tokens live one level up).
export default defineConfig({
  plugins: [react()],
  server: { fs: { allow: ['..'] } },
})
