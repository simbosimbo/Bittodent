// A1 screenshots (synthetic data): "Saran ICD" panel in the chart, phone 390px + desktop 1280, plus a 48px tap-target check.
// Expects a seeded backend + vite dev server (BASE) and a patient whose open visit has ICD suggestions (PATIENT).
// Does not approve anything. Output: OUT (default /workspace/audit/ai), files a1v2-*.png.
import { mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { chromium } from 'playwright-core'

const base = process.env.BASE ?? 'http://127.0.0.1:5191/'
const out = process.env.OUT ?? '/workspace/audit/ai'
const patient = process.env.PATIENT ?? (() => { throw new Error('PATIENT=<uuid> required') })()
mkdirSync(out, { recursive: true })

const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', headless: true, args: ['--lang=id-ID'] })
const login = async (page) => {
  await page.goto(base)
  await page.locator('button[title="dokter@senyum.test"]').click()
  await page.getByRole('button', { name: 'Keluar' }).waitFor()
}
const tapCheck = async (page, label) => {
  const all = await page.locator('section.ic button, section.ic summary').evaluateAll((els) => els
    .filter((e) => e.offsetParent !== null)
    .map((e) => { const r = e.getBoundingClientRect(); return { t: e.textContent.trim().slice(0, 30), w: Math.round(r.width), h: Math.round(r.height) } }))
  const small = all.filter((r) => r.w < 48 || r.h < 48)
  console.log(label, 'targets', JSON.stringify(all))
  console.log(label, small.length ? 'TAP TARGETS < 48px: ' + JSON.stringify(small) : 'all tap targets >= 48px')
  if (small.length) process.exitCode = 1
}
const open = async (page) => {
  await login(page)
  await page.goto(`${base}#/rekam-medis/${patient}`)
  const panel = page.locator('section.ic')
  await panel.locator('.ic-card').first().waitFor()
  return panel
}
try {
  const desk = await browser.newPage({ viewport: { width: 1280, height: 1100 }, locale: 'id-ID', timezoneId: 'Asia/Jakarta' })
  const panel = await open(desk)
  await panel.locator('.ic-cite').first().click()
  await desk.waitForTimeout(400)
  await tapCheck(desk, 'desktop-1280')
  await desk.evaluate(() => { document.querySelector('.chart-icd')?.scrollIntoView({ block: 'start' }); window.scrollBy(0, -170) })
  await desk.waitForTimeout(300)
  await desk.screenshot({ path: join(out, 'a1v2-desktop-1280.png') })

  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: 'id-ID', timezoneId: 'Asia/Jakarta' })
  const hp = await ctx.newPage()
  const p2 = await open(hp)
  await tapCheck(hp, 'hp-390')
  const below = () => { // scroll an element just below the app's sticky header
    const top = Math.max(0, ...[...document.querySelectorAll('header, .topbar, [class*="sticky"]')].map((h) => getComputedStyle(h).position === 'sticky' || getComputedStyle(h).position === 'fixed' ? h.getBoundingClientRect().bottom : 0))
    return top
  }
  await hp.evaluate((fn) => { const h = new Function('return (' + fn + ')()')(); const el = document.querySelector('.chart-icd-panel'); if (el) window.scrollTo(0, el.getBoundingClientRect().top + window.scrollY - h - 8) }, below.toString())
  await hp.waitForTimeout(300)
  await hp.screenshot({ path: join(out, 'a1v2-hp-390.png') })
  const chip = p2.locator('.ic-cite').first()
  await chip.evaluate((e) => e.click())
  await hp.evaluate(() => document.querySelector('.odontogram')?.scrollIntoView({ block: 'center' }))
  await hp.waitForTimeout(300)
  await hp.screenshot({ path: join(out, 'a1v2-hp-390-sitasi.png') })
  console.log('saved a1v2-desktop-1280.png, a1v2-hp-390.png, a1v2-hp-390-sitasi.png')
} finally {
  await browser.close()
}
