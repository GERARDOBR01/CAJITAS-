// Google Play graphics: phone screenshots (1080×1920) with sample cajitas
// and the 1024×500 feature graphic. `node scripts/play-assets.mjs` builds the
// app as the public sees it (no owner tools) and takes them.
import { spawn, spawnSync } from "node:child_process";
import { mkdir } from "node:fs/promises";
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
    pet: "otter",
    petName: "Nuri",
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
      provider: "BBVA",
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

const build = spawnSync(
  process.execPath,
  ["node_modules/vite/bin/vite.js", "build"],
  {
    cwd: project,
    stdio: "inherit",
    env: { ...process.env, VITE_OWNER_TOOLS: "0" },
  },
);
if (build.status !== 0) process.exit(build.status ?? 1);
const server = spawn(
  process.execPath,
  [
    "node_modules/vite/bin/vite.js",
    "preview",
    "--port",
    String(port),
    "--strictPort",
  ],
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
    // The listing shows the app, not the gentle nudge to make an account.
    localStorage.setItem("guardadito:account-nudge", "1");
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
  // The companion as the app draws it, for the feature graphic.
  const pet = (
    await page
      .locator(".home-mascot")
      .first()
      .screenshot({ omitBackground: true })
  ).toString("base64");
  await page.locator(".goal-card").first().scrollIntoViewIfNeeded();
  await page.evaluate(() => scrollBy(0, -90));
  await shot("2-cajita");
  await tab("Mi mascota");
  await shot("3-mascota");
  await tab("Actividad");
  await shot("4-actividad");
  await tab("Más");
  await shot("5-mas");

  // Feature graphic, in the colors of the app.
  const banner = await browser.newPage({
    viewport: { width: 1024, height: 500 },
  });
  await banner.setContent(`<!doctype html><html><body style="margin:0">
    <div style="width:1024px;height:500px;display:flex;align-items:center;gap:40px;
      padding:0 64px;box-sizing:border-box;font-family:'Nunito',ui-rounded,system-ui,sans-serif;
      background:linear-gradient(135deg,#fbf6ec 0%,#ffe4ed 55%,#e3f6ee 100%);color:#2b1b3a">
      <div style="width:330px;height:330px;flex:none;display:grid;place-items:center;
        border-radius:56px;background:#ffffff;border:3px solid #e8dfcf;box-shadow:0 8px 0 #e8dfcf">
        <img src="data:image/png;base64,${pet}" style="max-width:290px;max-height:290px"></div>
      <div>
        <div style="font-size:80px;font-weight:900;letter-spacing:-2px;color:#4b2a7b">guardadito</div>
        <div style="font-size:38px;font-weight:850;margin-top:6px">Ahorra en pareja,<br>poquito a poquito</div>
        <div style="font-size:24px;font-weight:700;margin-top:18px;color:#655a6d">Metas compartidas · sorpresas · con cualquier banco</div>
      </div></div></body></html>`);
  await banner.screenshot({ path: join(out, "grafico-destacado.png") });
  console.log(`Listo: ${out}`);
} finally {
  await browser.close();
  server.kill();
}
