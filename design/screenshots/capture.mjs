// Capture Bitto prototype screens after `npm run build`.
// Usage: node capture.mjs
import { spawn } from "node:child_process";
import { join } from "node:path";
import puppeteer from 'puppeteer-core';

const protoDir = "/workspace/ehr-dental/design/prototype";
const outDir = "/workspace/ehr-dental/design/screenshots";

const shots = [
  { file: "desktop-01-login.png", hash: "#/login", w: 1440, h: 900 },
  { file: "desktop-02-login-totp.png", hash: "#/login/totp", w: 1440, h: 900 },
  { file: "desktop-03-login-recovery.png", hash: "#/login/recovery", w: 1440, h: 900 },
  { file: "desktop-04-pin.png", hash: "#/pin", w: 1440, h: 900 },
  { file: "desktop-05-desain.png", hash: "#/desain", w: 1440, h: 900 },
  { file: "desktop-06-jadwal.png", hash: "#/jadwal", w: 1440, h: 900 },
  { file: "desktop-07-keluarga.png", hash: "#/keluarga", w: 1440, h: 900 },
  { file: "desktop-08-registrasi.png", hash: "#/keluarga/baru", w: 1440, h: 900 },
  { file: "desktop-09-charting.png", hash: "#/charting", w: 1440, h: 900 },
  { file: "desktop-10-soap-draf.png", hash: "#/charting/soap?soap=draft", w: 1440, h: 900 },
  { file: "desktop-11-soap-terkunci.png", hash: "#/charting/soap?soap=signed", w: 1440, h: 900 },
  { file: "desktop-12-rencana.png", hash: "#/rencana", w: 1440, h: 900 },
  { file: "desktop-13-tagihan.png", hash: "#/tagihan", w: 1440, h: 900 },
  { file: "desktop-14-tagihan-offline.png", hash: "#/tagihan?offline=1", w: 1440, h: 900 },
  { file: "desktop-15-gambar.png", hash: "#/gambar", w: 1440, h: 900 },
  { file: "desktop-16-kelola.png", hash: "#/kelola", w: 1440, h: 900 },
  { file: "desktop-17-alur.png", hash: "#/alur", w: 1440, h: 900 },
  { file: "desktop-18-presentasi.png", hash: "#/rencana/presentasi", w: 1440, h: 900 },
  { file: "desktop-19-kelola.png", hash: "#/kelola", w: 1440, h: 900 },
  { file: "tablet-01-jadwal.png", hash: "#/jadwal", w: 1024, h: 768 },
  { file: "tablet-02-charting.png", hash: "#/charting", w: 1024, h: 768 },
  { file: "tablet-03-presentasi.png", hash: "#/rencana/presentasi", w: 1024, h: 768 },
];

function waitForUrl(child, re, timeoutMs = 20000) {
  return new Promise((resolve, reject) => {
    let buf = "";
    const t = setTimeout(() => reject(new Error("preview start timeout\n" + buf)), timeoutMs);
    const onData = (d) => {
      buf += d.toString();
      const m = buf.match(re);
      if (m) {
        clearTimeout(t);
        child.stdout.off("data", onData);
        child.stderr.off("data", onData);
        resolve(m[1] || m[0]);
      }
    };
    child.stdout.on("data", onData);
    child.stderr.on("data", onData);
  });
}

const preview = spawn(
  "npm",
  ["run", "preview", "--", "--host", "127.0.0.1", "--port", "4173"],
  { cwd: protoDir, stdio: ["ignore", "pipe", "pipe"] }
);
try {
  await waitForUrl(preview, /http:\/\/(127\.0\.0\.1|localhost):\d+/);
  const base = "http://127.0.0.1:4173/";
  const browser = await puppeteer.launch({
    executablePath: "/usr/bin/google-chrome",
    headless: true,
    args: ["--no-sandbox", "--disable-gpu", "--disable-dev-shm-usage"],
  });
  const page = await browser.newPage();
  page.setDefaultTimeout(30000);
  for (const shot of shots) {
    await page.setViewport({ width: shot.w, height: shot.h, deviceScaleFactor: 1 });
    await page.goto(base + shot.hash, { waitUntil: "networkidle0", timeout: 30000 });
    await page.waitForFunction(() => document.body && document.body.innerText.trim().length > 20, { timeout: 15000 }).catch(() => {});
    await new Promise((r) => setTimeout(r, 600));
    const dest = join(outDir, shot.file);
    await page.screenshot({ path: dest, fullPage: false });
    const text = await page.evaluate(() => document.body.innerText.slice(0, 180).replace(/\s+/g, " "));
    console.log("wrote", dest, "text:", text);
  }
  await browser.close();
  console.log("done");
} finally {
  preview.kill("SIGTERM");
}
