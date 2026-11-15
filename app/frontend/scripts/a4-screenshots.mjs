// A4 v3 screenshots (synthetic data only). Expects BASE (SPA) + PATIENT uuid on tenant Senyum Sehat.
// Output: OUT/a4v3-*.png. Does not start servers.
import { mkdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { chromium } from 'playwright-core'

const base = process.env.BASE ?? 'http://127.0.0.1:5189/'
const out = process.env.OUT ?? '/workspace/audit/ai'
const patient = process.env.PATIENT ?? (() => { throw new Error('PATIENT=<uuid> required') })()
const fixture = process.env.KTP_IMG ?? join(import.meta.dirname, 'fixtures/synthetic-ktp.png')
mkdirSync(out, { recursive: true })

const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', headless: true, args: ['--lang=id-ID'] })
const page = async (email, width) => {
  const phone = width <= 480
  const ctx = await browser.newContext(phone
    ? { viewport: { width, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: 'id-ID', timezoneId: 'Asia/Jakarta' }
    : { viewport: { width, height: 900 }, locale: 'id-ID', timezoneId: 'Asia/Jakarta' })
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
const FIELDS = '.patient-form input:not([type="file"]), .patient-form select, .patient-form .btn, .patient-form-tabs button, .patient-form-dock .btn, .ktp-reveal, .ktp-att .btn, .chip.ktp-draft'
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
const toIdentitas = (p) => p.getByLabel('Nama lengkap *').evaluate((el) => el.scrollIntoView({ block: 'center' }))
const toKtp = (p) => p.evaluate(() => document.querySelector('.ktp-head, .ktp')?.scrollIntoView({ block: 'start' }))
const grid = async (p, label) => {
  const a = await p.getByLabel('Nama lengkap *').boundingBox()
  const b = await p.getByLabel('No. HP').boundingBox()
  const stacked = !!a && !!b && Math.abs(a.y - b.y) > 24
  const overflowX = await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
  console.log(label, 'grid-2', stacked ? 'stacked (1 col)' : 'side-by-side', `overflowX=${overflowX}`)
  if ((label.includes('360') || label.includes('390')) && !stacked) process.exitCode = 1
  if ((label.includes('360') || label.includes('390')) && overflowX > 1) process.exitCode = 1
}
const dockClear = async (p, label) => {
  await p.getByLabel('Nama lengkap *').focus()
  const hits = await p.evaluate(() => {
    const dock = document.querySelector('.patient-form-dock')
    if (!dock) return { error: 'no-dock' }
    const dr = dock.getBoundingClientRect()
    const overlap = (el) => {
      if (!el) return null
      const r = el.getBoundingClientRect()
      return { covered: r.bottom > dr.top + 1 && r.top < dr.bottom - 1, fieldBottom: Math.round(r.bottom), dockTop: Math.round(dr.top), dockH: Math.round(dr.height) }
    }
    const name = document.getElementById('f-name')
    const phone = document.getElementById('f-phone')
    return { name: overlap(name), phone: overlap(phone), pad: getComputedStyle(document.querySelector('.patient-form .ktp-daftar')).paddingBottom }
  })
  console.log(label, 'dock-clear', JSON.stringify(hits))
  if (hits.name?.covered || hits.phone?.covered) process.exitCode = 1
}
const noRawPreview = async (p, label) => {
  const imgs = await p.locator('.ktp-preview img, .ktp-att img').count()
  const enc = await p.getByText('Terenkripsi').count()
  console.log(label, 'preview-imgs', imgs, 'Terenkripsi', enc)
  if (imgs !== 0 || enc !== 0) process.exitCode = 1
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
async function waitOcr(p, t0, label) {
  try {
    await p.waitForFunction(() => (document.getElementById('f-name')?.value || '').length > 2, null, { timeout: 90_000 })
    const ms = Date.now() - t0
    const chips = await p.getByRole('button', { name: 'Dari pindai' }).count()
    const ctaOff = await p.getByRole('button', { name: 'Verifikasi dan daftar' }).isDisabled()
    console.log(label, 'OCR ms', ms, 'Dari pindai', chips, 'CTA disabled', ctaOff)
    if (!ctaOff || chips < 1) process.exitCode = 1
    return true
  } catch (e) {
    console.log(label, 'OCR did not fill in', Date.now() - t0, 'ms:', e.message)
    return false
  }
}

try {
  for (const width of [360, 390]) {
    const hp = await page('depan@senyum.test', width)
    await hp.goto(`${base}#/pasien/baru`)
    await hp.getByRole('tab', { name: 'Daftar' }).waitFor()
    await fill(hp, false)
    await toIdentitas(hp)
    await tapCheck(hp, `hp-${width} form`, FIELDS)
    await grid(hp, `hp-${width}`)
    await dockClear(hp, `hp-${width}`)
    await noRawPreview(hp, `hp-${width} fill`)
    const nikVal = await hp.getByRole('textbox', { name: 'NIK' }).inputValue()
    console.log(`hp-${width} NIK after blur`, nikVal)
    if (nikVal !== '3201********0001') process.exitCode = 1
    await hp.screenshot({ path: join(out, `a4v3-hp-${width}.png`) })
    console.log(`saved a4v3-hp-${width}.png`)
    await hp.context().close()

    const hpScan = await page('depan@senyum.test', width)
    await hpScan.goto(`${base}#/pasien/baru`)
    await hpScan.getByRole('tab', { name: 'Daftar' }).waitFor()
    const t0 = Date.now()
    await hpScan.getByLabel('Foto KTP', { exact: true }).setInputFiles(fixture)
    await waitOcr(hpScan, t0, `hp-${width} pindai`)
    await noRawPreview(hpScan, `hp-${width} pindai`)
    await toIdentitas(hpScan)
    await tapCheck(hpScan, `hp-${width} pindai`, FIELDS)
    await hpScan.screenshot({ path: join(out, `a4v3-hp-${width}-pindai.png`) })
    console.log(`saved a4v3-hp-${width}-pindai.png`)
    await hpScan.context().close()
  }

  const desk = await page('depan@senyum.test', 1280)
  await desk.goto(`${base}#/pasien/baru`)
  await fill(desk, true)
  await tapCheck(desk, 'desktop form', FIELDS)
  await grid(desk, 'desktop-1280')
  await noRawPreview(desk, 'desktop fill')
  await toKtp(desk)
  await desk.screenshot({ path: join(out, 'a4v3-desktop-1280.png') })
  console.log('saved a4v3-desktop-1280.png')
  await desk.context().close()

  const deskScan = await page('depan@senyum.test', 1280)
  await deskScan.goto(`${base}#/pasien/baru`)
  const t1 = Date.now()
  await deskScan.getByLabel('Foto KTP', { exact: true }).setInputFiles(fixture)
  await waitOcr(deskScan, t1, 'desktop pindai')
  await noRawPreview(deskScan, 'desktop pindai')
  await deskScan.screenshot({ path: join(out, 'a4v3-desktop-1280-pindai.png') })
  console.log('saved a4v3-desktop-1280-pindai.png')
  await deskScan.context().close()

  const doc = await page('dokter@senyum.test', 1280)
  await attachPhoto(doc, patient)
  await doc.goto(`${base}#/pasien/${patient}`)
  await doc.locator('.details, .ktp-nik').first().waitFor()
  try {
    await doc.locator('.ktp-att').waitFor({ timeout: 15_000 })
  } catch (e) {
    console.log('dentist photo card did not appear:', e.message)
    process.exitCode = 1
  }
  await tapCheck(doc, 'desktop detail dentist', '.ktp-reveal, .ktp-att .btn')
  const buka = await doc.getByRole('button', { name: 'Buka' }).count()
  const enc = await doc.getByText('Terenkripsi').count()
  console.log('dentist Buka', buka, 'Terenkripsi', enc)
  if (enc < 1 || buka < 1) process.exitCode = 1
  await doc.screenshot({ path: join(out, 'a4v3-desktop-1280-detail.png') })
  await doc.context().close()

  const depan = await page('depan@senyum.test', 1280)
  await depan.goto(`${base}#/pasien/${patient}`)
  await depan.locator('.details, .ktp-nik').first().waitFor()
  const bukaDepan = await depan.getByRole('button', { name: 'Buka' }).count()
  const card = await depan.locator('.ktp-att').count()
  console.log('front desk Buka', bukaDepan, 'ktp-att', card)
  if (bukaDepan !== 0 || card !== 0) process.exitCode = 1
  await depan.screenshot({ path: join(out, 'a4v3-desktop-1280-detail-depan.png') })
  console.log('saved a4v3 detail shots')
  await depan.context().close()
} finally {
  await browser.close()
}
