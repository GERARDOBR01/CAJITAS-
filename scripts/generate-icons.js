import { chromium } from "@playwright/test";
import { readFile } from "node:fs/promises";
const browser = await chromium.launch({ headless: true });
const svg = await readFile("public/mascot.svg", "utf8");
// [file, size, padding]: the plain icons fill the square; the iPhone one and
// the maskable one keep the mascot inside the safe zone on the app color.
const icons = [
  ["icon-192.png", 192, 0],
  ["icon-512.png", 512, 0],
  ["apple-touch-icon.png", 180, 0.12],
  ["icon-maskable-512.png", 512, 0.2],
];
for (const [file, size, padding] of icons) {
  const page = await browser.newPage({
    viewport: { width: size, height: size },
    deviceScaleFactor: 1,
  });
  const inset = Math.round(size * padding);
  await page.setContent(
    `<style>body{margin:0;background:#f8f6f1}div{box-sizing:border-box;width:100vw;height:100vh;padding:${inset}px}svg{width:100%;height:100%;display:block}</style><div>${svg}</div>`,
  );
  await page.screenshot({ path: `public/${file}` });
  await page.close();
}
await browser.close();
