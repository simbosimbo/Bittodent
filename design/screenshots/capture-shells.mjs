// Capture only the three Jadwal shell directions. New page per shot so query flags do not leak.
import { spawn } from "node:child_process";
import { join } from "node:path";
import puppeteer from "puppeteer-core";

const protoDir = "/workspace/ehr-dental/design/prototype";
const outDir = "/workspace/ehr-dental/design/screenshots";
const port = "4185";

const shots = [
  { file: "shell-A-jadwal-desktop.png", hash: "#/jadwal?shell=a", w: 1440, h: 900 },
  { file: "shell-A-jadwal-tablet.png", hash: "#/jadwal?shell=a", w: 1024, h: 768 },
  { file: "shell-B-jadwal-desktop.png", hash: "#/jadwal?shell=b", w: 1440, h: 900 },
  { file: "shell-B-jadwal-tablet.png", hash: "#/jadwal?shell=b", w: 1024, h: 768 },
  { file: "shell-C-jadwal-desktop.png", hash: "#/jadwal?shell=c", w: 1440, h: 900 },
  { file: "shell-C-jadwal-tablet.png", hash: "#/jadwal?shell=c", w: 1024, h: 768 },
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
    await page.waitForFunction(() => document.body && document.body.innerText.includes("Jadwal"), { timeout: 15000 });
    await new Promise((r) => setTimeout(r, 500));
    const dest = join(outDir, shot.file);
    await page.screenshot({ path: dest, fullPage: false });
    const text = await page.evaluate(() => document.body.innerText.slice(0, 200).replace(/\s+/g, " "));
    console.log("wrote", dest, "text:", text);
    await page.close();
  }
  await browser.close();
  console.log("done");
} finally {
  preview.kill("SIGTERM");
}
