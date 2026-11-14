// Screenshots of the SPA with synthetic seed data. Starts nothing itself. Expects:
//   backend  http://127.0.0.1:8000 (freshly seeded MySQL ehr_dev: migrate:fresh --database=mysql_admin --seed)
//   frontend http://127.0.0.1:5173 (npm run dev)
// Front desk logs in with TOTP (01-05); the dentist then uses dev quick login (DEV_QUICK_LOGIN=true) and signs with a fresh TOTP code (06-10).
// Fortify rejects reusing a TOTP code inside the same 30 s window, so signing waits for the next code. Mutates ehr_dev (check-in, sign, correction).
import { execFileSync } from 'node:child_process'
import { mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright-core'

const here = dirname(fileURLToPath(import.meta.url))
const backend = join(here, '../../backend')
const out = join(here, '../../../screenshots')
const php = process.env.PHP ?? '/opt/php84/bin/php'
const email = 'depan@senyum.test'
const base = 'http://127.0.0.1:5173/'
mkdirSync(out, { recursive: true })

const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', headless: true, args: ['--lang=id-ID'] })
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, locale: 'id-ID', timezoneId: 'Asia/Jakarta' })
let lastCode = ''
const totp = async (who) => {
  for (;;) {
    const code = execFileSync(php, ['artisan', 'dev:totp', who], { cwd: backend, encoding: 'utf8' }).trim()
    if (!/^\d{6}$/.test(code)) throw new Error('dev:totp gave no code: ' + code)
    if (code !== lastCode) return (lastCode = code)
    await new Promise((r) => setTimeout(r, 2000))
  }
}
const shot = async (name) => {
  await page.waitForTimeout(400) // let debounced search / fonts settle
  await page.screenshot({ path: join(out, name) })
  console.log('saved', join(out, name))
}

try {
  await page.goto(base)
  await page.getByRole('heading', { name: 'Masuk' }).waitFor()
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Kata sandi').fill('rahasia-dev-123')
  await shot('01-login.png')

  await page.getByRole('button', { name: 'Masuk' }).click()
  await page.getByRole('heading', { name: 'Kode autentikator' }).waitFor()
  await page.getByLabel('Kode 6 angka').fill(await totp(email))
  await shot('02-2fa.png')

  await page.getByRole('button', { name: 'Verifikasi' }).click()
  await page.getByRole('button', { name: 'Keluar' }).waitFor()

  await page.goto(base + '#/jadwal')
  await page.locator('.appt').first().waitFor()
  await page.getByRole('button', { name: 'Check-in' }).first().click() // shows the check-in flow + a second status chip
  await page.locator('.chip-checked_in').first().waitFor()
  await shot('03-jadwal.png')

  await page.goto(base + '#/pasien')
  await page.getByLabel('Cari pasien').fill('sa')
  await page.waitForResponse((r) => r.url().includes('/api/patients?q=sa') && r.ok())
  await page.locator('.table tbody tr').first().waitFor()
  await shot('04-pasien.png')

  await page.goto(base + '#/pasien/baru')
  await page.getByLabel('Nama lengkap *').fill('Larasati Contoh Sintetis')
  await page.getByLabel('Tanggal lahir').fill('1992-04-17')
  await page.getByLabel('Jenis kelamin').selectOption('perempuan')
  await page.getByLabel('NIK').fill('9901000000009999')
  await page.getByLabel('No. HP').fill('0899 0100 9999')
  await page.getByLabel('Alamat').fill('Jl. Fiktif Raya No. 7, Kota Contoh')
  await page.getByLabel('Jenis penjamin').selectOption('asuransi')
  await page.getByLabel('Nama asuransi *').fill('Asuransi Fiktif Sejahtera')
  await page.getByLabel('No. peserta').fill('AFS-000123')
  await shot('05-pasien-baru.png')

  // Dentist: seeded demo patient (today's visit with draft odontogram + SOAP, medical alerts, family).
  await page.goto(base)
  await page.getByRole('button', { name: 'Keluar' }).click()
  await page.getByRole('button', { name: /Dokter/ }).and(page.locator('[title="dokter@senyum.test"]')).click()
  await page.getByRole('button', { name: 'Keluar' }).waitFor()
  const pid = await page.evaluate(async () => {
    const j = (u) => fetch(u, { headers: { Accept: 'application/json' } }).then((r) => r.json())
    for (const p of (await j('/api/patients?q=budi')).data) {
      const c = await j(`/api/patients/${p.id}/chart`)
      if (c.visits?.some((v) => v.notes?.some((n) => n.versions.some((x) => x.status === 'draf')))) return p.id
    }
    throw new Error('no seeded patient with a draft note')
  })

  await page.goto(base + '#/rekam-medis/' + pid)
  await page.locator('.alert-ribbon .alert-chip').first().waitFor()
  await page.getByRole('heading', { name: 'Catatan SOAP' }).waitFor()
  await shot('06-odontogram-draf.png')

  await page.getByRole('button', { name: 'Tanda Tangani' }).click()
  const dlg = page.getByRole('dialog')
  await dlg.getByRole('checkbox').check()
  await dlg.getByLabel('Kode autentikator (6 angka)').fill(await totp('dokter@senyum.test'))
  await shot('08-soap-konfirmasi-tanda-tangan.png')
  await dlg.getByRole('button', { name: 'Tanda Tangani' }).click()
  await page.getByText('Rekam medis ditandatangani dan terkunci.').waitFor()
  await shot('07-odontogram-ditandatangani.png')

  await page.getByRole('heading', { name: 'Riwayat kunjungan' }).scrollIntoViewIfNeeded()
  await page.getByRole('button', { name: 'Koreksi', exact: true }).last().click()
  await page.getByLabel('Alasan koreksi *').fill('Salah ketik nomor gigi pada rencana (data sintetis)')
  await shot('09-koreksi.png')
  await page.getByRole('dialog').getByRole('button', { name: 'Batal' }).click()

  await page.goto(base + '#/riwayat-medis/' + pid)
  await page.getByRole('heading', { name: /Riwayat medis terkini/ }).waitFor()
  await page.locator('.alert-ribbon .alert-chip').first().waitFor()
  await shot('10-peringatan-medis.png')
} finally {
  await browser.close()
}
