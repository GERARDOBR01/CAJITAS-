// Google Play graphics: phone screenshots (1080×1920) with sample cajitas
// and the 1024×500 feature graphic. `npm run build && node scripts/play-assets.mjs`
import { spawn } from "node:child_process";
import { mkdir, readFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";

const project = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const out = join(project, "docs", "play", "assets");
const port = 4179;
const base = `http://localhost:${port}`;

const day = 86400000;
const iso = (offset) => new Date(Date.now() + offset * day).toISOString();
const date = (offset) => iso(offset).slice(0, 10);
const entries = (list) =>
  list.map(([cents, offset], i) => ({
    id: `e${i}-${cents}`,
    cents,
    at: iso(offset),
    source: "manual",
  }));
const sample = {
  version: 2,
  savedAt: 1,
  importedIds: [],
  assignments: {},
  checkins: [],
  preferences: {
    pet: "pig",
    petName: "Pipo",
    accessory: "bow",
    animations: true,
    reminder: { enabled: false, day: 5, time: "20:00" },
  },
  goals: [
    {
      id: "viaje",
      name: "Viaje a la playa",
      targetCents: 800000,
      unlockDate: date(75),
      provider: "Mercado Pago",
      icon: "cloud",
      frequency: 15,
      archived: false,
      entries: entries([
        [150000, -40],
        [120000, -25],
        [100000, -10],
        [80000, -2],
      ]),
    },
    {
      id: "colchon",
      name: "Mi colchoncito",
      targetCents: 500000,
      unlockDate: null,
      provider: "Nu",
      icon: "star",
      frequency: 7,
      archived: false,
      entries: entries([
        [50000, -30],
        [50000, -16],
        [70000, -3],
      ]),
    },
    {
      id: "tenis",
      name: "Unos tenis",
      targetCents: 220000,
      unlockDate: date(20),
      provider: "Nu",
      icon: "flower",
      frequency: 7,
      archived: false,
      entries: entries([
        [60000, -20],
        [60000, -6],
      ]),
    },
  ],
};

const server = spawn(
  process.execPath,
  ["node_modules/vite/bin/vite.js", "preview", "--port", String(port), "--strictPort"],
  { cwd: project, stdio: "ignore" },
);
const browser = await chromium.launch();
try {
  for (let i = 0; i < 50; i++) {
    try {
      if ((await fetch(base)).ok) break;
    } catch {
      await new Promise((r) => setTimeout(r, 200));
    }
  }
  await mkdir(out, { recursive: true });
  const context = await browser.newContext({
    viewport: { width: 360, height: 640 },
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
    locale: "es-MX",
    timezoneId: "America/Mexico_City",
    reducedMotion: "reduce",
    serviceWorkers: "block",
  });
  await context.addInitScript((seed) => {
    localStorage.setItem("guardadito:v1", JSON.stringify(seed));
  }, sample);
  const page = await context.newPage();
  const shot = async (name) => {
    await page.waitForTimeout(400);
    await page.screenshot({ path: join(out, `${name}.png`) });
  };
  const tab = (name) =>
    page.getByRole("button", { name, exact: true }).first().click();

  await page.goto(base);
  await shot("1-inicio");
  await page.locator(".goal-card").first().scrollIntoViewIfNeeded();
  await page.evaluate(() => scrollBy(0, -90));
  await shot("2-cajita");
  await tab("Mi mascota");
  await shot("3-mascota");
  await tab("Actividad");
  await shot("4-actividad");
  await tab("Más");
  await shot("5-mas");

  // Feature graphic.
  const mascot = await readFile(join(project, "public", "mascot.svg"), "utf8");
  const banner = await browser.newPage({
    viewport: { width: 1024, height: 500 },
  });
  await banner.setContent(`<!doctype html><html><body style="margin:0">
    <div style="width:1024px;height:500px;display:flex;align-items:center;gap:48px;
      padding:0 72px;box-sizing:border-box;font-family:system-ui,'Segoe UI',sans-serif;
      background:linear-gradient(135deg,#fff7ef 0%,#f3eaff 60%,#e6dcff 100%);color:#2b2140">
      <div style="width:300px;height:300px;flex:none;display:grid;place-items:center;
        border-radius:48px;background:#fff;box-shadow:0 18px 40px #6c3fd122">
        <div style="width:240px;height:240px">${mascot}</div></div>
      <div>
        <div style="font-size:78px;font-weight:900;letter-spacing:-2px;color:#6c3fd1">Guardadito</div>
        <div style="font-size:36px;font-weight:800;margin-top:8px">Ahorra en pareja,<br>poquito a poquito</div>
        <div style="font-size:24px;margin-top:18px;color:#6b5f80">Metas compartidas · sorpresas · con cualquier banco</div>
      </div></div></body></html>`);
  await banner
    .locator("svg")
    .evaluate((svg) => {
      svg.setAttribute("width", "240");
      svg.setAttribute("height", "240");
    });
  await banner.screenshot({ path: join(out, "grafico-destacado.png") });
  console.log(`Listo: ${out}`);
} finally {
  await browser.close();
  server.kill();
}
