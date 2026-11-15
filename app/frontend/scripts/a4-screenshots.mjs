// A4 v2 screenshots (synthetic data only). Expects BASE (SPA) + PATIENT uuid on tenant Senyum Sehat.
// Output: OUT/a4v2-*.png. Does not start servers.
import { mkdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { chromium } from 'playwright-core'

const base = process.env.BASE ?? 'http://127.0.0.1:5189/'
const out = process.env.OUT ?? '/workspace/audit/ai'
const patient = process.env.PATIENT ?? (() => { throw new Error('PATIENT=<uuid> required') })()
const fixture = process.env.KTP_IMG ?? join(import.meta.dirname, 'fixtures/synthetic-ktp.png')
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
    .map((e) => { const r = e.getBoundingClientRect(); return { t: (e.getAttribute('aria-label') || e.textContent || e.tagName).trim().slice(0, 40), w: Math.round(r.width), h: Math.round(r.height) } }))
  const small = all.filter((r) => r.w < 48 || r.h < 48)
  console.log(label, `${all.length} controls,`, small.length ? 'TAP TARGETS < 48px: ' + JSON.stringify(small) : 'all >= 48px')
  if (small.length) process.exitCode = 1
}
const FIELDS = '.patient-form input:not([type="file"]), .patient-form select, .patient-form .btn, .patient-form-tabs button, .patient-form-dock .btn, .ktp-reveal, .ktp-att .btn'
const fill = async (p, mismatch) => {
  await p.getByLabel('Nama lengkap *').fill('Budi KTP Sintetis')
  await p.getByRole('textbox', { name: 'NIK' }).fill('3201011501900001')
  await p.getByRole('textbox', { name: 'NIK' }).blur()
  await p.getByLabel(/^Tanggal lahir/).fill(mismatch ? '1990-01-16' : '1990-01-15')
  await p.getByLabel(/^Jenis kelamin/).selectOption(mismatch ? 'perempuan' : 'laki_laki')
  await p.getByLabel(/^Prov/).fill('32')
  await p.getByLabel(/^Kab\/Kota/).fill(mismatch ? '02' : '01')
  await p.getByLabel(/^Kec/).fill('01')
}
const toKtp = (p) => p.evaluate(() => document.querySelector('.ktp-head, .ktp')?.scrollIntoView({ block: 'start' }))
const grid = async (p, label) => {
  const a = await p.getByLabel('Nama lengkap *').boundingBox()
  const b = await p.getByLabel('No. HP').boundingBox()
  const stacked = !!a && !!b && Math.abs(a.y - b.y) > 24
  const overflowX = await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
  console.log(label, 'grid-2', stacked ? 'stacked (1 col)' : 'side-by-side', `overflowX=${overflowX}`)
  if (label.includes('390') && !stacked) process.exitCode = 1
  if (label.includes('390') && overflowX > 1) process.exitCode = 1
}
async function attachPhoto(p, patientId) {
  const b64 = readFileSync(fixture).toString('base64')
  const res = await p.evaluate(async ({ b64, patientId }) => {
    const bin = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0))
    const fd = new FormData()
    fd.append('photo', new File([bin], 'ktp-sintetis.png', { type: 'image/png' }))
    const token = decodeURIComponent(document.cookie.match(/XSRF-TOKEN=([^;]+)/)?.[1] ?? '')
    const post = await fetch('/api/ktp/photos', { method: 'POST', body: fd, credentials: 'same-origin', headers: { 'X-XSRF-TOKEN': token } })
    if (!post.ok) return { ok: false, step: 'post', status: post.status, body: await post.text() }
    const { id } = await post.json()
    const put = await fetch(`/api/patients/${patientId}/ktp`, { method: 'PUT', credentials: 'same-origin', headers: { 'X-XSRF-TOKEN': token, Accept: 'application/json', 'Content-Type': 'application/json' }, body: JSON.stringify({ photo_id: id }) })
    if (!put.ok) return { ok: false, step: 'put', status: put.status, body: await put.text() }
    return { ok: true, id }
  }, { b64, patientId })
  if (!res.ok) throw new Error('photo attach ' + JSON.stringify(res))
  console.log('attached encrypted photo', res.id)
}

try {
  const hp = await page('depan@senyum.test', true)
  await hp.goto(`${base}#/pasien/baru`)
  await hp.getByRole('tab', { name: 'Daftar' }).waitFor()
  await fill(hp, false)
  await toKtp(hp)
  await tapCheck(hp, 'hp-390 form', FIELDS)
  await grid(hp, 'hp-390')
  const nikVal = await hp.getByRole('textbox', { name: 'NIK' }).inputValue()
  console.log('hp-390 NIK after blur', nikVal)
  if (nikVal !== '3201********0001') process.exitCode = 1
  await hp.screenshot({ path: join(out, 'a4v2-hp-390.png'), fullPage: true })
  await hp.getByLabel(/^Tanggal lahir/).fill('1990-01-16')
  await hp.getByLabel(/^Jenis kelamin/).selectOption('perempuan')
  await hp.getByLabel(/^Kab\/Kota/).fill('02')
  await hp.getByText('Tidak cocok').first().waitFor({ timeout: 10_000 })
  await toKtp(hp)
  await hp.screenshot({ path: join(out, 'a4v2-hp-390-cocok.png'), fullPage: true })
  console.log('saved a4v2-hp-390.png, a4v2-hp-390-cocok.png')
  await hp.context().close()

  const hpScan = await page('depan@senyum.test', true)
  await hpScan.goto(`${base}#/pasien/baru`)
  await hpScan.getByRole('tab', { name: 'Daftar' }).waitFor()
  const t0 = Date.now()
  await hpScan.getByLabel('Foto KTP', { exact: true }).setInputFiles(fixture)
  try {
    await hpScan.waitForFunction(() => { const l = [...document.querySelectorAll('label')].find((el) => el.textContent.includes('Nama lengkap')); return (l?.querySelector('input')?.value || '').length > 2 }, null, { timeout: 90_000 })
    const ms = Date.now() - t0
    const name = await hpScan.getByLabel('Nama lengkap *').inputValue()
    const hasil = await hpScan.getByLabel('Hasil').innerText()
    console.log('browser OCR ms', ms, 'name', name, 'hasil', hasil.replaceAll('\n', ' / '))
    await toKtp(hpScan)
    await hpScan.screenshot({ path: join(out, 'a4v2-hp-390-pindai.png') })
    console.log('saved a4v2-hp-390-pindai.png')
  } catch (e) {
    console.log('browser OCR did not fill the form in', Date.now() - t0, 'ms:', e.message)
    await hpScan.screenshot({ path: join(out, 'a4v2-hp-390-pindai.png') })
  }
  await hpScan.context().close()

  const desk = await page('depan@senyum.test', false)
  await desk.goto(`${base}#/pasien/baru`)
  await fill(desk, true)
  await tapCheck(desk, 'desktop form', FIELDS)
  await grid(desk, 'desktop')
  await toKtp(desk)
  await desk.screenshot({ path: join(out, 'a4v2-desktop.png') })
  console.log('saved a4v2-desktop.png')
  await desk.context().close()

  const deskScan = await page('depan@senyum.test', false)
  await deskScan.goto(`${base}#/pasien/baru`)
  const t1 = Date.now()
  await deskScan.getByLabel('Foto KTP', { exact: true }).setInputFiles(fixture)
  try {
    await deskScan.waitForFunction(() => { const l = [...document.querySelectorAll('label')].find((el) => el.textContent.includes('Nama lengkap')); return (l?.querySelector('input')?.value || '').length > 2 }, null, { timeout: 90_000 })
    console.log('desktop OCR ms', Date.now() - t1)
    await deskScan.screenshot({ path: join(out, 'a4v2-desktop-pindai.png') })
    console.log('saved a4v2-desktop-pindai.png')
  } catch (e) {
    console.log('desktop OCR did not fill', Date.now() - t1, e.message)
    await deskScan.screenshot({ path: join(out, 'a4v2-desktop-pindai.png') })
  }
  await deskScan.context().close()

  const doc = await page('dokter@senyum.test', false)
  await attachPhoto(doc, patient)
  await doc.goto(`${base}#/pasien/${patient}`)
  await doc.locator('.details, .ktp-att, .ktp-nik').first().waitFor()
  await tapCheck(doc, 'desktop detail dentist', '.ktp-reveal, .ktp-att .btn')
  const buka = await doc.getByRole('button', { name: 'Buka' }).count()
  console.log('dentist Buka buttons', buka)
  await doc.screenshot({ path: join(out, 'a4v2-desktop-detail.png') })
  await doc.context().close()

  const depan = await page('depan@senyum.test', false)
  await depan.goto(`${base}#/pasien/${patient}`)
  await depan.locator('.details, .ktp-nik').first().waitFor()
  const bukaDepan = await depan.getByRole('button', { name: 'Buka' }).count()
  const card = await depan.locator('.ktp-att').count()
  console.log('front desk Buka', bukaDepan, 'ktp-att', card)
  if (bukaDepan !== 0 || card !== 0) process.exitCode = 1
  await depan.screenshot({ path: join(out, 'a4v2-desktop-detail-depan.png') })
  console.log('saved a4v2-desktop-detail.png, a4v2-desktop-detail-depan.png')
  await depan.context().close()
} finally {
  await browser.close()
}
