// A2 screenshots (synthetic data): treatment suggestions in the chart, phone 390px + desktop, and a 44px tap-target check.
// Expects a seeded backend + `npm run dev` (BASE, default http://127.0.0.1:5173/) and a patient whose open visit has suggestions
// (PATIENT). Mutates the DB (approves one suggestion). Output: OUT (default ../../../screenshots/ai).
import { mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { chromium } from 'playwright-core'

const base = process.env.BASE ?? 'http://127.0.0.1:5173/'
const out = process.env.OUT ?? new URL('../../../screenshots/ai', import.meta.url).pathname
const patient = process.env.PATIENT ?? (() => { throw new Error('PATIENT=<uuid> required') })()
mkdirSync(out, { recursive: true })

const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', headless: true, args: ['--lang=id-ID'] })
const login = async (page) => {
  await page.goto(base)
  await page.locator('button[title="dokter@senyum.test"]').click()
  await page.getByRole('button', { name: 'Keluar' }).waitFor()
}
const tapCheck = async (page, label) => {
  const small = await page.locator('.sg button, .sg summary').evaluateAll((els) => els
    .filter((e) => e.offsetParent !== null)
    .map((e) => { const r = e.getBoundingClientRect(); return { t: e.textContent.trim().slice(0, 30), w: Math.round(r.width), h: Math.round(r.height) } })
    .filter((r) => r.w < 44 || r.h < 44))
  console.log(label, small.length ? 'TAP TARGETS < 44px: ' + JSON.stringify(small) : 'all tap targets >= 44px')
  if (small.length) process.exitCode = 1
}
try {
  // desktop
  const desk = await browser.newPage({ viewport: { width: 1440, height: 1500 }, locale: 'id-ID', timezoneId: 'Asia/Jakarta' })
  await login(desk)
  await desk.goto(`${base}#/rekam-medis/${patient}`)
  const panel = desk.locator('section.sg')
  await panel.getByText('draf').first().waitFor()
  await panel.getByRole('listitem', { name: /Pencabutan/ }).getByRole('button', { name: '✓ Setujui' }).click()
  await panel.getByText('✓ 1 disetujui').waitFor()
  await panel.getByRole('button', { name: /^Sumber: temuan 37/ }).click()
  await desk.waitForTimeout(500)
  await tapCheck(desk, 'desktop')
  await desk.evaluate(() => { const c = [...document.querySelectorAll('.card h2')].find((h) => h.textContent === 'Odontogram')?.closest('.card'); window.scrollTo(0, (c?.getBoundingClientRect().top ?? 0) + window.scrollY - 150) })
  await desk.waitForTimeout(300)
  await desk.screenshot({ path: join(out, 'a2-desktop.png') }) // viewport only: a full-page capture misplaces the sticky bar
  console.log('saved a2-desktop.png')

  // phone 390
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: 'id-ID', timezoneId: 'Asia/Jakarta' })
  const hp = await ctx.newPage()
  await login(hp)
  await hp.goto(`${base}#/rekam-medis/${patient}`)
  const p2 = hp.locator('section.sg')
  await p2.getByText('✓ 1 disetujui').waitFor()
  await tapCheck(hp, 'hp-390')
  await p2.scrollIntoViewIfNeeded()
  await hp.evaluate(() => document.querySelector('section.sg')?.closest('.card')?.scrollIntoView({ block: 'start' }))
  await hp.waitForTimeout(300)
  await hp.screenshot({ path: join(out, 'a2-hp-390.png') })
  const chip = p2.getByRole('button', { name: /^Sumber: temuan 37/ })
  await chip.evaluate((e) => e.scrollIntoView({ block: 'center' }))
  await chip.evaluate((e) => e.click()) // main's phone shell has a tall sticky header; the tap itself is covered by vitest
  await hp.waitForTimeout(300)
  await hp.screenshot({ path: join(out, 'a2-hp-390-sitasi.png') })
  await hp.evaluate(() => document.querySelector('.odontogram')?.scrollIntoView({ block: 'end' }))
  await hp.waitForTimeout(300)
  await hp.screenshot({ path: join(out, 'a2-hp-390-odontogram-sorot.png') })
  await p2.getByText('1 sudah diulas').evaluate((e) => e.click())
  await p2.getByText('1 sudah diulas').evaluate((e) => e.scrollIntoView({ block: 'center' }))
  await hp.waitForTimeout(300)
  await hp.screenshot({ path: join(out, 'a2-hp-390-diulas.png') })
  console.log('saved a2-hp-390*.png')
} finally {
  await browser.close()
}
