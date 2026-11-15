// A2 v2 screenshots (synthetic data): treatment suggestions in the chart, phone 390px + desktop 1280, and a 48px tap-target check.
// Expects a seeded backend + `npm run dev` (BASE) and a patient whose open visit has suggestions (PATIENT).
// Mutates the DB (approves one suggestion). Output: OUT (default /workspace/audit/ai), files a2v2-*.png.
import { mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { chromium } from 'playwright-core'

const base = process.env.BASE ?? 'http://127.0.0.1:5173/'
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
  const small = await page.locator('.sg button, .sg summary').evaluateAll((els) => els
    .filter((e) => e.offsetParent !== null)
    .map((e) => { const r = e.getBoundingClientRect(); return { t: e.textContent.trim().slice(0, 30), w: Math.round(r.width), h: Math.round(r.height) } })
    .filter((r) => r.w < 48 || r.h < 48))
  const all = await page.locator('.sg button, .sg summary').evaluateAll((els) => els
    .filter((e) => e.offsetParent !== null)
    .map((e) => { const r = e.getBoundingClientRect(); return { t: e.textContent.trim().slice(0, 40), w: Math.round(r.width), h: Math.round(r.height) } }))
  console.log(label, 'targets', JSON.stringify(all))
  console.log(label, small.length ? 'TAP TARGETS < 48px: ' + JSON.stringify(small) : 'all tap targets >= 48px')
  if (small.length) process.exitCode = 1
}
try {
  // desktop 1280: panel should sit in a sticky right column beside the odontogram
  const desk = await browser.newPage({ viewport: { width: 1280, height: 1500 }, locale: 'id-ID', timezoneId: 'Asia/Jakarta' })
  await login(desk)
  await desk.goto(`${base}#/rekam-medis/${patient}`)
  const panel = desk.locator('section.sg')
  await panel.getByText('draf').first().waitFor()
  const approved = panel.getByText('✓ 1 disetujui')
  if (!await approved.count()) {
    await panel.getByRole('listitem', { name: /Pencabutan/ }).getByRole('button', { name: '✓ Setujui' }).click()
  }
  await approved.waitFor()
  await panel.getByRole('button', { name: /^Sumber: temuan 37/ }).click()
  await desk.waitForTimeout(500)
  await tapCheck(desk, 'desktop-1280')
  await desk.evaluate(() => {
    const split = document.querySelector('.chart-split')
    if (split) { split.scrollIntoView({ block: 'start' }); window.scrollBy(0, -170) }
  })
  await desk.waitForTimeout(300)
  await desk.screenshot({ path: join(out, 'a2v2-desktop.png') })
  console.log('saved a2v2-desktop.png')

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
  await hp.screenshot({ path: join(out, 'a2v2-hp-390.png') })
  const chip = p2.getByRole('button', { name: /^Sumber: temuan 37/ })
  await chip.evaluate((e) => e.scrollIntoView({ block: 'center' }))
  await chip.evaluate((e) => e.click())
  await hp.waitForTimeout(300)
  await hp.screenshot({ path: join(out, 'a2v2-hp-390-sitasi.png') })
  await hp.evaluate(() => document.querySelector('.odontogram')?.scrollIntoView({ block: 'end' }))
  await hp.waitForTimeout(300)
  await hp.screenshot({ path: join(out, 'a2v2-hp-390-odontogram-sorot.png') })
  const done = p2.getByText('1 sudah diulas')
  await done.evaluate((e) => e.click())
  await hp.waitForTimeout(200)
  await p2.locator('.sg-done').evaluate((el) => {
    const dock = document.querySelector('.sg-sticky')
    const dockH = dock ? dock.getBoundingClientRect().height : 0
    const room = window.innerHeight - dockH - 16
    const r = el.getBoundingClientRect()
    window.scrollBy(0, r.bottom - room)
  })
  await hp.waitForTimeout(300)
  await hp.screenshot({ path: join(out, 'a2v2-hp-390-diulas.png') })
  console.log('saved a2v2-hp-390*.png')
} finally {
  await browser.close()
}
