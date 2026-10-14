import { chromium } from "@playwright/test";
import { readFile } from "node:fs/promises";
const browser = await chromium.launch({ headless: true });
const svg = await readFile("public/mascot.svg", "utf8");
for (const size of [192, 512]) {
  const page = await browser.newPage({
    viewport: { width: size, height: size },
    deviceScaleFactor: 1,
  });
  await page.setContent(
    `<style>body{margin:0}svg{width:100vw;height:100vh;display:block}</style>${svg}`,
  );
  await page.screenshot({ path: `public/icon-${size}.png` });
  await page.close();
}
await browser.close();
