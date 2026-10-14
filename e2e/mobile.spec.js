import { test, expect } from "@playwright/test";
import { mkdir } from "node:fs/promises";
test("crear meta, countdown, retiro anticipado, meta alcanzada y respaldo a 390×844", async ({
  page,
}) => {
  await mkdir("docs/screenshots", { recursive: true });
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "¿Qué te hace ilusión?" }),
  ).toBeVisible();
  await page.screenshot({
    path: "docs/screenshots/01-inicio-mobile.png",
    fullPage: true,
  });
  await page
    .getByRole("button", { name: "+ Nueva cajita", exact: true })
    .click();
  await page.getByLabel("Nombre de tu meta").fill("Mi escapadita");
  await page.getByLabel("¿Cuánto quieres ahorrar? (MXN)").fill("1000");
  const future = new Date();
  future.setDate(future.getDate() + 30);
  const local = `${future.getFullYear()}-${String(future.getMonth() + 1).padStart(2, "0")}-${String(future.getDate()).padStart(2, "0")}`;
  await page.getByLabel("Fecha de desbloqueo").fill(local);
  await page.getByRole("button", { name: "Crear cajita", exact: true }).click();
  const card = page.locator(".goal-card");
  await expect(card).toContainText("días ·");
  await expect(card).toContainText("Ahorro registrado");
  await page.screenshot({
    path: "docs/screenshots/02-meta-countdown-mobile.png",
    fullPage: true,
  });
  await card.getByRole("button", { name: "+ Registrar ahorro" }).click();
  await page.getByLabel("Monto (MXN)").fill("600");
  await page
    .getByRole("button", { name: "Registrar ahorro", exact: true })
    .click();
  await card
    .getByRole("button", { name: "Registrar retiro", exact: true })
    .click();
  await page.getByLabel("Monto (MXN)").fill("100");
  await page.getByRole("button", { name: "Continuar con el retiro" }).click();
  await expect(
    page.getByText(
      "Los planes cambian. Puedes ajustar tu meta y seguir después.",
    ),
  ).toBeVisible();
  await page.screenshot({
    path: "docs/screenshots/03-retiro-confirmacion-mobile.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Sí, registrar retiro" }).click();
  await expect(card.locator(".saved")).toContainText("$500.00");
  await expect(
    page.getByRole("img", { name: "La mascota está triste y te acompaña" }),
  ).toBeVisible();
  await card.getByRole("button", { name: "+ Registrar ahorro" }).click();
  await page.getByLabel("Monto (MXN)").fill("500");
  await page
    .getByRole("button", { name: "Registrar ahorro", exact: true })
    .click();
  await expect(card).toContainText("¡Lo lograste!");
  await expect(page.locator(".confetti")).toBeAttached();
  await expect
    .poll(() =>
      card
        .locator(".progress")
        .evaluate(
          (el) =>
            el.firstElementChild.getBoundingClientRect().width /
            el.getBoundingClientRect().width,
        ),
    )
    .toBeGreaterThan(0.99);
  await page.screenshot({
    path: "docs/screenshots/04-meta-alcanzada-mobile.png",
    fullPage: true,
  });
  await page.reload();
  await expect(card.locator(".saved")).toContainText("$1,000.00");
  await page.getByRole("button", { name: "Respaldo", exact: true }).click();
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "↓ Descargar respaldo" }).click();
  const download = await downloadPromise;
  await download.saveAs("test-results/respaldo.json");
  await page
    .locator("input[type=file]")
    .setInputFiles("test-results/respaldo.json");
  await expect(
    page.getByRole("heading", { name: "Revisar respaldo" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Reemplazar con este respaldo" })
    .click();
  await page.getByRole("button", { name: "Mis cajitas", exact: true }).click();
  await expect(card).toContainText("Mi escapadita");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
test("simulador sin token muestra configuración pendiente, sin tasas inventadas", async ({
  page,
}) => {
  await page.route("**/api/rates", (route) =>
    route.fulfill({
      status: 503,
      json: {
        error:
          "Configura el token de Banxico en el servidor para consultar tasas reales.",
      },
    }),
  );
  await page.goto("/");
  await page.getByRole("button", { name: "Rendimiento", exact: true }).click();
  await expect(
    page.getByText("Configura el token de Banxico", { exact: false }),
  ).toBeVisible();
  await page.getByLabel("Tasa anual de tu app (%)").fill("10");
  await expect(page.locator(".custom")).toContainText("$7.67");
  await page.screenshot({
    path: "docs/screenshots/05-simulador-mobile.png",
    fullPage: true,
  });
});
test("Gmail revisa depósitos, recuerda asignación y evita duplicados", async ({
  page,
}) => {
  await page.route("**/api/status", (route) =>
    route.fulfill({
      json: {
        gmailConnected: true,
        gmailConfigured: true,
        bitsoConfigured: false,
      },
    }),
  );
  await page.route("**/api/gmail/sync", (route) =>
    route.fulfill({
      json: {
        receipts: [
          {
            id: "fixture-email-hash",
            provider: "Nu",
            patternId: "nu-deposit-v1",
            validated: false,
            amountCents: 25000,
            at: "2026-10-01T12:00:00Z",
          },
        ],
        ignored: 0,
        nextPageToken: null,
      },
    }),
  );
  await page.goto("/");
  await page
    .getByRole("button", { name: "+ Nueva cajita", exact: true })
    .click();
  await page.getByLabel("Nombre de tu meta").fill("Mi guardadito");
  await page.getByLabel("¿Cuánto quieres ahorrar? (MXN)").fill("1000");
  await page.getByRole("button", { name: "Crear cajita", exact: true }).click();
  await page.getByRole("button", { name: "Conexiones", exact: true }).click();
  await page.getByRole("button", { name: "Buscar depósitos" }).click();
  await page
    .getByRole("combobox", { name: "Cajita", exact: true })
    .selectOption({ label: "Mi guardadito" });
  await page.getByLabel("Recordar esta cajita para el patrón").check();
  await page.screenshot({
    path: "docs/screenshots/06-conexiones-mobile.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Confirmar depósito" }).click();
  await page.getByRole("button", { name: "Buscar depósitos" }).click();
  await expect(
    page.getByRole("button", { name: "Confirmar depósito" }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Mis cajitas", exact: true }).click();
  await expect(page.locator(".goal-card .saved")).toContainText("$250.00");
});
test("un patrón validado con cajita recordada se registra automáticamente una sola vez", async ({
  page,
}) => {
  await page.addInitScript(() =>
    localStorage.setItem(
      "cajitas:v1",
      JSON.stringify({
        version: 1,
        goals: [
          {
            id: "g-auto",
            name: "Automática",
            targetCents: 100000,
            unlockDate: "2027-01-01",
            provider: "Nu",
            icon: "star",
            entries: [],
          },
        ],
        assignments: { "nu-deposit-v1": "g-auto" },
        importedIds: [],
      }),
    ),
  );
  await page.route("**/api/status", (route) =>
    route.fulfill({ json: { gmailConnected: true, gmailConfigured: true } }),
  );
  await page.route("**/api/gmail/sync", (route) =>
    route.fulfill({
      json: {
        receipts: [
          {
            id: "validated-fixture-hash",
            provider: "Nu",
            patternId: "nu-deposit-v1",
            validated: true,
            amountCents: 30000,
            at: "2026-10-01T12:00:00Z",
          },
        ],
        ignored: 0,
        nextPageToken: null,
      },
    }),
  );
  await page.goto("/");
  await page.getByRole("button", { name: "Conexiones", exact: true }).click();
  await page.getByRole("button", { name: "Buscar depósitos" }).click();
  await expect(
    page.getByText("1 depósitos automáticos.", { exact: false }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Buscar depósitos" }).click();
  await expect(
    page.getByText("0 depósitos automáticos.", { exact: false }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Mis cajitas", exact: true }).click();
  await expect(page.locator(".goal-card .saved")).toContainText("$300.00");
});
test("datos locales dañados no se sobrescriben al intentar crear una meta", async ({
  page,
}) => {
  await page.addInitScript(() =>
    localStorage.setItem("cajitas:v1", '{"datos":"incompletos"}'),
  );
  await page.goto("/");
  await expect(
    page.getByRole("button", { name: "Descargar datos originales" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "+ Nueva cajita", exact: true })
    .click();
  await page.getByLabel("Nombre de tu meta").fill("Prueba");
  await page.getByLabel("¿Cuánto quieres ahorrar? (MXN)").fill("10");
  await page.getByRole("button", { name: "Crear cajita", exact: true }).click();
  expect(await page.evaluate(() => localStorage.getItem("cajitas:v1"))).toBe(
    '{"datos":"incompletos"}',
  );
});
