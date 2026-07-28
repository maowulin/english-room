/* eslint-env node */

// Capture 390×844 real media UI states via Expo web + /qa-media harness.
// Evidence class: Web 注入态视觉布局 only — not native/real TRTC runtime.
const { chromium } = require("playwright-core");
const fs = require("fs");
const os = require("os");
const path = require("path");

const APP = process.env.APP_URL || "http://localhost:8081";
const OUT = path.resolve(__dirname, "..", ".qa-screenshots", "task23-real-390x844");

function resolveChromiumExecutable() {
  if (process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH) {
    return process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH;
  }
  try {
    if (typeof chromium.executablePath === "function") {
      const resolved = chromium.executablePath();
      if (resolved && fs.existsSync(resolved)) return resolved;
    }
  } catch {
    // fall through to cache scan
  }
  const cacheRoot = path.join(os.homedir(), "Library/Caches/ms-playwright");
  if (!fs.existsSync(cacheRoot)) {
    throw new Error(
      "Chromium executable not found. Set PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH or install Playwright browsers.",
    );
  }
  const candidates = fs
    .readdirSync(cacheRoot)
    .filter((name) => name.startsWith("chromium-"))
    .sort()
    .reverse()
    .map((name) =>
      path.join(cacheRoot, name, "chrome-mac/Chromium.app/Contents/MacOS/Chromium"),
    );
  const found = candidates.find((candidate) => fs.existsSync(candidate));
  if (!found) {
    throw new Error(
      "Chromium executable not found under ~/Library/Caches/ms-playwright. Set PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH.",
    );
  }
  return found;
}

const shots = [
  ["lobby", "real-lobby", "01-lobby-real.png", "ROOM LIVE"],
  ["waiting", "real-perm-denied", "02-waiting-perm-denied.png", "麦克风权限被拒绝"],
  ["waiting", "real-grant-loading", "03-waiting-grant-loading.png", "正在获取语音凭证"],
  ["waiting", "real-grant-failed", "04-waiting-grant-failed.png", "语音凭证获取失败"],
  ["waiting", "real-joining", "05-waiting-joining.png", "正在连接语音房间"],
  ["waiting", "real-joined", "06-waiting-joined.png", "麦克风与语音房间已就绪"],
  ["live", "real-joined", "07-live-joined.png", "语音进行中"],
  ["live", "real-reconnecting", "08-live-reconnecting.png", "正在重新连接"],
  ["live", "real-weak", "09-live-weak.png", "网络较弱"],
  ["live", "real-bad", "10-live-bad.png", "网络很差"],
  ["live", "real-kicked", "11-live-kicked.png", "你已离开语音房间"],
  ["live", "real-disconnected", "12-live-disconnected.png", "语音已断开"],
  ["live", "real-join-failed", "13-live-join-failed.png", "语音入房失败"],
  ["report", "real-report-processing", "14-report-processing.png", "报告生成中"],
  ["report", "real-recording-failed", "15-report-recording-failed.png", "录音上传失败"],
];

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const executablePath = resolveChromiumExecutable();
  const browser = await chromium.launch({ executablePath, headless: true });
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
  });
  const page = await context.newPage();
  for (const [screen, preset, file, marker] of shots) {
    const url = `${APP}/qa-media?screen=${encodeURIComponent(screen)}&preset=${encodeURIComponent(preset)}&t=${Date.now()}`;
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });
    await page.waitForTimeout(800);
    // Scroll waiting screens so the media notice enters the viewport.
    if (screen === "waiting") {
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await page.waitForTimeout(200);
      await page.evaluate(() => window.scrollTo(0, 0));
    }
    try {
      await page.getByText(marker).first().waitFor({ timeout: 10000 });
    } catch {
      console.warn("marker missing", file, marker);
    }
    if (screen === "waiting") {
      const handle = await page.getByText(marker).first().elementHandle().catch(() => null);
      if (handle) await handle.scrollIntoViewIfNeeded();
    }
    await page.screenshot({ path: path.join(OUT, file), fullPage: false });
    console.log("saved", file);
  }
  await browser.close();
  console.log("OUT", OUT);
  console.log("NOTE web-injected-layout-only not-native-trtc");
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
