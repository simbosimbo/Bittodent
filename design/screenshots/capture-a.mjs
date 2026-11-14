// Capture shell-A screens. New page per shot so query flags do not leak.
import { spawn } from "node:child_process";
import { join } from "node:path";
import puppeteer from "puppeteer-core";

const protoDir = "/workspace/ehr-dental/design/prototype";
const outDir = "/workspace/ehr-dental/design/screenshots";
const port = "4193";

const pages = [
  { name: "jadwal", hash: "#/jadwal", wait: "Jadwal" },
  { name: "pasien-list", hash: "#/keluarga?aktif=0", wait: "Daftar pasien" },
  { name: "pasien-profil", hash: "#/keluarga", wait: "Identitas" },
  { name: "registrasi", hash: "#/keluarga/baru", wait: "Registrasi" },
  { name: "charting", hash: "#/charting", wait: "Odontogram" },
  { name: "soap-draf", hash: "#/charting/soap?soap=draft", wait: "Draf" },
  { name: "soap-terkunci", hash: "#/charting/soap?soap=signed", wait: "ditandatangani" },
  { name: "rencana", hash: "#/rencana", wait: "Rencana" },
  { name: "presentasi", hash: "#/rencana/presentasi", wait: "Presentasi" },
  { name: "tagihan", hash: "#/tagihan", wait: "Tagihan" },
  { name: "tagihan-offline", hash: "#/tagihan?offline=1", wait: "Mode offline" },
  { name: "jadwal-kosong", hash: "#/jadwal?aktif=0", wait: "Belum ada pasien aktif" },
];

const sizes = [
  { suffix: "desktop", w: 1440, h: 900 },
  { suffix: "tablet", w: 1024, h: 768 },
];

const shots = [
  ...pages.flatMap((p) => sizes.map((s) => ({
    file: `a-${p.name}-${s.suffix}.png`,
    hash: p.hash,
    wait: p.wait,
    w: s.w,
    h: s.h,
  }))),
  { file: "a-jadwal-1280.png", hash: "#/jadwal", wait: "Jadwal", w: 1280, h: 800 },
  { file: "a-charting-1280.png", hash: "#/charting", wait: "Odontogram", w: 1280, h: 800 },
];

function waitForUrl(child, re, timeoutMs = 25000) {
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
  ["run", "preview", "--", "--host", "127.0.0.1", "--port", port],
  { cwd: protoDir, stdio: ["ignore", "pipe", "pipe"] }
);
try {
  await waitForUrl(preview, /http:\/\/(127\.0\.0\.1|localhost):\d+/);
  const base = `http://127.0.0.1:${port}/`;
  const browser = await puppeteer.launch({
    executablePath: "/usr/bin/google-chrome",
    headless: true,
    args: ["--no-sandbox", "--disable-gpu", "--disable-dev-shm-usage"],
  });
  for (const shot of shots) {
    const page = await browser.newPage();
    page.setDefaultTimeout(30000);
    await page.setViewport({ width: shot.w, height: shot.h, deviceScaleFactor: 1 });
    await page.goto(base + shot.hash, { waitUntil: "networkidle0", timeout: 30000 });
    await page.waitForFunction((w) => document.body && document.body.innerText.includes(w), { timeout: 15000 }, shot.wait).catch(() => {});
    await new Promise((r) => setTimeout(r, 400));
    const dest = join(outDir, shot.file);
    await page.screenshot({ path: dest, fullPage: false });
    const text = await page.evaluate(() => document.body.innerText.slice(0, 180).replace(/\s+/g, " "));
    console.log("wrote", dest, "text:", text);
    await page.close();
  }
  await browser.close();
  console.log("done", shots.length, "shots");
} finally {
  preview.kill("SIGTERM");
}
