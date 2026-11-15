// A4 screenshots (synthetic data): KTP section on "Pasien Baru" (phone 390px + desktop 1280px) and the masked NIK +
// reveal control on the patient detail, with a >= 48px tap-target check. Starts nothing itself and saves nothing to the DB.
// Expects a seeded backend + SPA with dev quick login at BASE (default http://127.0.0.1:5173/) and PATIENT=<uuid> of tenant
// Senyum Sehat for the detail shot. Output: OUT (default /workspace/audit/ai).
import { mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { chromium } from 'playwright-core'

const base = process.env.BASE ?? 'http://127.0.0.1:5173/'
const out = process.env.OUT ?? '/workspace/audit/ai'
const patient = process.env.PATIENT ?? (() => { throw new Error('PATIENT=<uuid> required') })()
mkdirSync(out, { recursive: true })

const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', headless: true, args: ['--lang=id-ID'] })
const page = async (email, phone) => {
  const ctx = await browser.newContext(phone
    ? { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: 'id-ID', timezoneId: 'Asia/Jakarta' }
    : { viewport: { width: 1280, height: 900 }, locale: 'id-ID', timezoneId: 'Asia/Jakarta' })
  const p = await ctx.newPage()
  await p.goto(base)
  await p.locator(`button[title="${email}"]`).click()
  await p.getByRole('button', { name: 'Keluar' }).waitFor()
  return p
}
const tapCheck = async (p, label, selector) => {
  const all = await p.locator(selector).evaluateAll((els) => els
    .filter((e) => e.offsetParent !== null)
    .map((e) => { const r = e.getBoundingClientRect(); return { t: (e.getAttribute('aria-label') || e.textContent || e.tagName).trim().slice(0, 30), w: Math.round(r.width), h: Math.round(r.height) } }))
  const small = all.filter((r) => r.w < 48 || r.h < 48)
  console.log(label, `${all.length} controls,`, small.length ? 'TAP TARGETS < 48px: ' + JSON.stringify(small) : 'all >= 48px')
  if (small.length) process.exitCode = 1
}
const KTP = '.ktp input, .ktp select, .ktp button, .patient-form .dialog-actions .btn'
const fill = async (p, mismatch) => {
  await p.getByLabel('Nama lengkap *').fill('Budi KTP Sintetis')
  await p.getByLabel('NIK').fill('3201011501900001')
  await p.getByLabel(/^Tanggal lahir/).fill(mismatch ? '1990-01-16' : '1990-01-15')
  await p.getByLabel(/^Jenis kelamin/).selectOption(mismatch ? 'perempuan' : 'laki_laki')
  await p.getByLabel(/^Prov/).fill('32')
  await p.getByLabel(/^Kab\/Kota/).fill(mismatch ? '02' : '01')
  await p.getByLabel(/^Kec/).fill('01')
}
const toKtp = (p) => p.evaluate(() => [...document.querySelectorAll('h2')].find((h) => h.textContent === 'KTP')?.scrollIntoView({ block: 'start' }))
try {
  const hp = await page('depan@senyum.test', true)
  await hp.goto(`${base}#/pasien/baru`)
  await fill(hp, false)
  await toKtp(hp)
  await tapCheck(hp, 'hp-390 form', KTP)
  await hp.screenshot({ path: join(out, 'a4-hp-390.png') })
  await fill(hp, true)
  await hp.getByText('Tidak cocok').first().waitFor()
  await toKtp(hp)
  await hp.screenshot({ path: join(out, 'a4-hp-390-cocok.png') })
  console.log('saved a4-hp-390.png, a4-hp-390-cocok.png')

  const desk = await page('depan@senyum.test', false)
  await desk.goto(`${base}#/pasien/baru`)
  await fill(desk, true)
  await tapCheck(desk, 'desktop form', KTP)
  await toKtp(desk)
  await desk.screenshot({ path: join(out, 'a4-desktop.png') })

  const doc = await page('dokter@senyum.test', false)
  await doc.goto(`${base}#/pasien/${patient}`)
  await doc.getByText('NIK (disamarkan)').waitFor()
  await tapCheck(doc, 'desktop detail', '.ktp-reveal')
  await doc.screenshot({ path: join(out, 'a4-desktop-detail.png') }) // masked; "Lihat" is not clicked (it writes a ktp_lihat audit row)
  console.log('saved a4-desktop.png, a4-desktop-detail.png')
} finally {
  await browser.close()
}
