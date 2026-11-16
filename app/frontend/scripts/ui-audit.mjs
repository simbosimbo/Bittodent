// Per-role UI audit for the HeroUI migration. Starts nothing itself. Expects backend :8000 with DEV_QUICK_LOGIN=true and `npm run dev` on :5173.
// For each role × route × width: horizontal overflow, controls past the right edge, touch targets < 44px (phone only), text < 12px, and a screenshot.
// Usage: node scripts/ui-audit.mjs [--roles dokter,depan] [--routes /,/pasien] [--widths 390,1440] [--out ../../screenshots/ui-audit]
// Exit 1 when any page fails a check. Report: <out>/report.json
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright-core'

const arg = (k, d) => { const i = process.argv.indexOf(`--${k}`); return i > 0 ? process.argv[i + 1] : d }
const base = 'http://127.0.0.1:5173/'
const ROLES = { dokter: 'dokter@senyum.test', depan: 'depan@senyum.test', kasir: 'kasir@senyum.test', pemilik: 'pemilik@senyum.test', asisten: 'asisten@senyum.test' }
const roles = arg('roles', Object.keys(ROLES).join(',')).split(',')
const routes = arg('routes', '/,/jadwal,/pasien,/rekam-medis,/pengaturan-rm,/kasir,/pengaturan-klinik,/laporan').split(',')
const widths = arg('widths', '390,1440').split(',').map(Number)
const out = arg('out', fileURLToPath(new URL('../../../screenshots/ui-audit', import.meta.url)))
const chrome = process.env.CHROME ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'

const measure = ({ phone, width }) => {
  const vis = (e) => { const r = e.getBoundingClientRect(); const c = getComputedStyle(e); return r.width > 0 && r.height > 0 && c.visibility !== 'hidden' && r.bottom > 0 }
  const label = (e) => (e.getAttribute('aria-label') || e.textContent || e.tagName).trim().replace(/\s+/g, ' ').slice(0, 40)
  const small = phone
    ? [...document.querySelectorAll('a[href],button,input:not([type=hidden]),select,textarea,[role=button],[role=tab],[role=link]')]
        .filter(vis)
        .filter((e) => { const r = e.getBoundingClientRect(); return r.height < 44 || r.width < 44 })
        .filter((e) => !e.closest('[data-audit-skip]'))
        .map((e) => { const r = e.getBoundingClientRect(); return `${label(e)} ${Math.round(r.width)}x${Math.round(r.height)}` })
    : []
  const tiny = [...document.querySelectorAll('body *')]
    .filter((e) => [...e.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim()) && vis(e) && parseFloat(getComputedStyle(e).fontSize) < 12)
    .map((e) => `${label(e)} ${getComputedStyle(e).fontSize}`)
  const offscreen = [...document.querySelectorAll('a[href],button,input:not([type=hidden]),select,textarea,[role=button],[role=tab]')]
    .filter(vis).filter((e) => e.getBoundingClientRect().right > width + 1 && !e.closest('[data-audit-skip],[data-more]'))
    .map((e) => `${label(e)} right=${Math.round(e.getBoundingClientRect().right)}`)
  return { offscreen, overflowX: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) - width, small, tiny }
}

mkdirSync(out, { recursive: true })
const browser = await chromium.launch({ executablePath: chrome, headless: true, args: ['--lang=id-ID'] })
const report = []
try {
  for (const role of roles) {
    for (const width of widths) {
      const phone = width <= 720
      const ctx = await browser.newContext({ viewport: { width, height: phone ? 844 : 900 }, locale: 'id-ID', timezoneId: 'Asia/Jakarta', isMobile: phone, hasTouch: phone })
      const page = await ctx.newPage()
      await page.goto(base)
      const ok = await page.evaluate(async (email) => {
        await fetch('/sanctum/csrf-cookie', { credentials: 'include' })
        const xsrf = decodeURIComponent(document.cookie.match(/XSRF-TOKEN=([^;]+)/)?.[1] ?? '')
        const r = await fetch('/dev/quick-login', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json', Accept: 'application/json', 'X-XSRF-TOKEN': xsrf }, body: JSON.stringify({ user_email: email }) })
        return r.ok
      }, ROLES[role])
      if (!ok) throw new Error(`quick login failed for ${role} (DEV_QUICK_LOGIN=true?)`)
      await page.reload()
      await page.waitForLoadState('networkidle').catch(() => {})
      if (await page.getByRole('heading', { name: 'Masuk', exact: true }).count()) throw new Error(`still on the login page after quick login as ${role}`)
      for (const route of routes) {
        await page.goto(base + '#' + route)
        await page.waitForLoadState('networkidle').catch(() => {})
        await page.waitForTimeout(500)
        const landed = new URL(page.url()).hash.slice(1) || '/'
        if (landed !== route) { report.push({ role, width, route, skipped: `redirected to ${landed}` }); continue }
        if (await page.getByRole('heading', { name: 'Masuk', exact: true }).count()) throw new Error(`session lost on ${route} as ${role}`)
        const m = await page.evaluate(measure, { phone, width })
        const file = join(out, `${width}-${role}-${route.replace(/\//g, '_') || '_'}.png`)
        await page.screenshot({ path: file, fullPage: true })
        const fail = m.overflowX > 0 || m.offscreen.length > 0 || m.small.length > 0 || m.tiny.length > 0
        report.push({ role, width, route, fail, ...m, file })
        console.log(`${fail ? 'FAIL' : 'ok  '} ${width} ${role.padEnd(8)} ${route.padEnd(20)} overflow=${m.overflowX} offscreen=${m.offscreen.length} small=${m.small.length} tiny=${m.tiny.length}`)
      }
      await ctx.close()
    }
  }
} finally {
  await browser.close()
}
writeFileSync(join(out, 'report.json'), JSON.stringify(report, null, 2))
const failed = report.filter((r) => r.fail).length
console.log(`${failed} failing page(s) of ${report.filter((r) => !r.skipped).length}. Report: ${join(out, 'report.json')}`)
process.exit(failed ? 1 : 0)
