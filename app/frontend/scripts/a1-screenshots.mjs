// A1 v3 screenshots (synthetic data): panel at 360, 390, 1280; sitasi (wait for .is-cited); alasan sheet; undo toast.
// Expects a seeded backend + vite dev server (BASE) and a patient whose open visit has ICD suggestions (PATIENT).
// Does not approve or commit a reject (Tolak is undone before leaving). Output: OUT, files a1v3-*.png.
import { mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { chromium } from 'playwright-core'

const base = process.env.BASE ?? 'http://127.0.0.1:5192/'
const out = process.env.OUT ?? '/workspace/audit/ai'
const patient = process.env.PATIENT ?? (() => { throw new Error('PATIENT=<uuid> required') })()
mkdirSync(out, { recursive: true })

const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', headless: true, args: ['--lang=id-ID'] })

const login = async (page) => {
  await page.goto(base)
  await page.locator('button[title="dokter@senyum.test"]').click()
  await page.getByRole('button', { name: 'Keluar' }).waitFor({ timeout: 30_000 })
}

const stickyBottom = () => {
  const els = [...document.querySelectorAll('header, .topbar, [class*="sticky"]')]
  return Math.max(0, ...els.map((h) => {
    const p = getComputedStyle(h).position
    return p === 'sticky' || p === 'fixed' ? h.getBoundingClientRect().bottom : 0
  }))
}

const scrollPanel = async (page) => {
  await page.evaluate((fn) => {
    const h = new Function('return (' + fn + ')()')()
    // querySelector with a comma list is document-order, not selector-order;
    // .chart-icd wraps the odontogram, so pick the panel (or section.ic) explicitly.
    const el = document.querySelector('.chart-icd-panel') || document.querySelector('section.ic')
    if (el) window.scrollTo(0, el.getBoundingClientRect().top + window.scrollY - h - 8)
  }, stickyBottom.toString())
  await page.waitForTimeout(250)
}

const tapCheck = async (page, label) => {
  const all = await page.locator('section.ic button, section.ic summary').evaluateAll((els) => els
    .filter((e) => e.offsetParent !== null)
    .map((e) => { const r = e.getBoundingClientRect(); return { t: e.textContent.trim().slice(0, 40), w: Math.round(r.width), h: Math.round(r.height) } }))
  const small = all.filter((r) => r.w < 48 || r.h < 48)
  console.log(label, 'targets', JSON.stringify(all))
  console.log(label, small.length ? 'TAP TARGETS < 48px: ' + JSON.stringify(small) : 'all tap targets >= 48px')
  if (small.length) process.exitCode = 1
}

const open = async (page) => {
  await login(page)
  await page.goto(`${base}#/rekam-medis/${patient}`)
  const panel = page.locator('section.ic')
  await panel.locator('.ic-card').first().waitFor({ timeout: 30_000 })
  return panel
}

const shot = async (page, name) => {
  const path = join(out, name)
  await page.screenshot({ path })
  console.log('saved', name)
}

const views = [
  { id: 'desktop-1280', width: 1280, height: 1100, mobile: false, dpr: 1 },
  { id: 'hp-390', width: 390, height: 844, mobile: true, dpr: 2 },
  { id: 'hp-360', width: 360, height: 800, mobile: true, dpr: 2 },
]

try {
  for (const v of views) {
    const ctx = await browser.newContext({
      viewport: { width: v.width, height: v.height },
      deviceScaleFactor: v.dpr,
      isMobile: v.mobile,
      hasTouch: v.mobile,
      locale: 'id-ID',
      timezoneId: 'Asia/Jakarta',
    })
    const page = await ctx.newPage()
    const panel = await open(page)

    await scrollPanel(page)
    await tapCheck(page, v.id)
    await shot(page, `a1v3-${v.id}.png`)

    // Fresh sitasi: click a tooth citation (not a diagnosis-only chip), wait for the
    // odontogram highlight. SVG <g class="tooth is-cited"> is often "hidden" to Playwright.
    const cite = panel.getByRole('button', { name: 'F3 · gigi 47 O' })
    await cite.click()
    await page.waitForFunction(() => !!document.querySelector('.tooth.is-cited, .tooth-surface.is-cited'), null, { timeout: 8_000 })
    await page.evaluate(() => document.querySelector('.odontogram')?.scrollIntoView({ block: 'center' }))
    await page.waitForTimeout(300)
    await shot(page, `a1v3-${v.id}-sitasi.png`)
    // clear highlight so later shots on the same page stay clean
    await cite.click()
    await page.waitForTimeout(150)
    await scrollPanel(page)

    if (v.width <= 390) {
      await panel.locator('button[aria-label="Alasan"]').first().click()
      const sheet = page.locator('.ic-sheet')
      await sheet.waitFor()
      // Every option must be reachable inside the scrollable sheet (48px list).
      const reach = await sheet.evaluate((el) => {
        const labels = [...el.querySelectorAll('button')].map((b) => {
          b.scrollIntoView({ block: 'nearest' })
          const r = b.getBoundingClientRect()
          const s = el.getBoundingClientRect()
          const visible = r.bottom > s.top + 1 && r.top < s.bottom - 1
          return { t: b.textContent.trim(), w: Math.round(r.width), h: Math.round(r.height), visible, sheetH: Math.round(s.height) }
        })
        return { maxH: el.style.maxHeight, scrollH: el.scrollHeight, clientH: el.clientHeight, labels }
      })
      console.log(v.id, 'alasan reach', JSON.stringify(reach))
      const missed = reach.labels.filter((l) => !l.visible || l.h < 48)
      if (missed.length) {
        console.log(v.id, 'ALASAN NOT REACHABLE OR <48px:', JSON.stringify(missed))
        process.exitCode = 1
      }
      // Scroll to top so the shot shows the sheet chrome, then a second frame if clipped.
      await sheet.evaluate((el) => { el.scrollTop = 0 })
      await page.evaluate((fn) => {
        const h = new Function('return (' + fn + ')()')()
        const card = document.querySelector('.ic-sheet')?.closest('.ic-card') || document.querySelector('.ic-sheet')
        if (card) window.scrollTo(0, card.getBoundingClientRect().top + window.scrollY - h - 8)
      }, stickyBottom.toString())
      await page.waitForTimeout(200)
      await shot(page, `a1v3-${v.id}-alasan.png`)
      if (reach.scrollH > reach.clientH + 4) {
        await sheet.evaluate((el) => { el.scrollTop = el.scrollHeight })
        await page.waitForTimeout(200)
        await shot(page, `a1v3-${v.id}-alasan-scroll.png`)
      }
      // Close the sheet by toggling the Alasan chevron — do not click the chrome
      // (a bare click at 10,10 can clear the patient chip on mobile).
      await panel.locator('button[aria-label="Alasan"]').first().click()
      await page.waitForTimeout(200)
    }

    // Undo toast on a fresh load so the panel and toast are both in view.
    // Same-hash goto is a no-op and can leave the alasan sheet open, which
    // intercepts the Tolak click on short viewports — reload instead.
    await page.reload()
    await page.locator('section.ic .ic-card').first().waitFor({ timeout: 30_000 })
    await scrollPanel(page)
    await page.locator('section.ic button', { hasText: 'Tolak' }).first().click({ timeout: 10_000 })
    const undo = page.getByRole('button', { name: 'Urungkan' })
    await undo.waitFor()
    const undoBox = await undo.evaluate((e) => { const r = e.getBoundingClientRect(); return { w: Math.round(r.width), h: Math.round(r.height) } })
    console.log(v.id, 'Urungkan', JSON.stringify(undoBox), 'in view', await undo.evaluate((e) => {
      const r = e.getBoundingClientRect()
      return r.top >= 0 && r.bottom <= window.innerHeight
    }))
    if (undoBox.w < 48 || undoBox.h < 48) {
      console.log(v.id, 'URUNGKAN < 48px')
      process.exitCode = 1
    }
    // Keep the toast in the viewport (sticky header can cover it on mobile).
    await page.evaluate((fn) => {
      const h = new Function('return (' + fn + ')()')()
      const t = document.querySelector('.ic-toast-undo')
      if (t) {
        const top = t.getBoundingClientRect().top
        if (top < h + 4) window.scrollBy(0, top - h - 8)
      }
    }, stickyBottom.toString())
    await page.waitForTimeout(200)
    await shot(page, `a1v3-${v.id}-undo.png`)
    await undo.click()
    await page.waitForTimeout(200)

    await ctx.close()
  }
} finally {
  await browser.close()
}
