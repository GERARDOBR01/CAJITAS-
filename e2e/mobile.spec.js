import { test, expect } from "@playwright/test";
import { createGoal, home, saveIn, settings } from "./helpers.js";

test("crear meta, guardar, usar parte sin culpa, meta cumplida y respaldo a 390×844", async ({
  page,
}) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "¡Hola, soy Pipo!" }),
  ).toBeVisible();
  const future = new Date();
  future.setDate(future.getDate() + 30);
  const local = `${future.getFullYear()}-${String(future.getMonth() + 1).padStart(2, "0")}-${String(future.getDate()).padStart(2, "0")}`;
  await createGoal(page, { name: "Mi escapadita", amount: 1000, when: local });
  const card = page.locator(".cajita");
  await expect(card).toContainText("Faltan 30 días");
  await saveIn(page, "Mi escapadita", 600);
  await page
    .getByRole("button", { name: "Ver detalle de Mi escapadita" })
    .click();
  await page.getByRole("button", { name: "Usé parte de este ahorro" }).click();
  const use = page.getByRole("dialog", { name: "Usé parte de mi ahorro" });
  await expect(use).toContainText("también es cumplir su propósito");
  await use.getByLabel("Monto", { exact: true }).fill("100");
  await use.getByRole("button", { name: /^Registrar/ }).click();
  await expect(page.locator(".toast")).toContainText("cumplir su propósito");
  await home(page);
  await expect(card).toContainText("$500");
  await expect(page.locator(".home .mascot").first()).not.toHaveAttribute(
    "data-mood",
    "sad",
  );
  await saveIn(page, "Mi escapadita", 500);
  await expect(page.locator(".confetti")).toBeAttached();
  await expect(page.locator(".hero")).toContainText("¡Lo lograste!");
  await page.getByRole("button", { name: "Cumplidas (1)" }).click();
  await expect(card).toContainText("¡Cumplida!");
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
  await page.reload();
  await settings(page, "Respaldo");
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
  await home(page);
  await page.getByRole("button", { name: "Cumplidas (1)" }).click();
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
  await settings(page, "Rendimiento");
  await expect(
    page.getByText("Configura el token de Banxico", { exact: false }),
  ).toBeVisible();
  await page.getByLabel("Tasa anual de tu app (%)").fill("10");
  await expect(page.locator(".custom")).toContainText("$7.67");
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
  await createGoal(page, { name: "Mi guardadito", amount: 1000 });
  await settings(page, "Conexiones");
  await page.getByRole("button", { name: "Buscar depósitos" }).click();
  await page
    .getByRole("combobox", { name: "Cajita", exact: true })
    .selectOption({ label: "Mi guardadito" });
  await page.getByLabel("Recordar esta cajita para el patrón").check();
  await page.getByRole("button", { name: "Confirmar depósito" }).click();
  await page.getByRole("button", { name: "Buscar depósitos" }).click();
  await expect(
    page.getByRole("button", { name: "Confirmar depósito" }),
  ).toHaveCount(0);
  await home(page);
  await expect(page.locator(".cajita")).toContainText("$250");
});
test("un patrón validado con cajita recordada se registra automáticamente una sola vez", async ({
  page,
}) => {
  await page.addInitScript(() =>
    localStorage.setItem(
      "guardadito:v1",
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
  await settings(page, "Conexiones");
  await page.getByRole("button", { name: "Buscar depósitos" }).click();
  await expect(
    page.getByText("1 depósitos automáticos.", { exact: false }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Buscar depósitos" }).click();
  await expect(
    page.getByText("0 depósitos automáticos.", { exact: false }),
  ).toBeVisible();
  await home(page);
  await expect(page.locator(".cajita")).toContainText("$300");
});
test("datos locales dañados no se sobrescriben al intentar crear una meta", async ({
  page,
}) => {
  await page.addInitScript(() =>
    localStorage.setItem("guardadito:v1", '{"datos":"incompletos"}'),
  );
  await page.goto("/");
  await expect(
    page.getByRole("button", { name: "Descargar datos originales" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Crear mi primera cajita" }).click();
  const form = page.getByRole("dialog", { name: "Nueva cajita" });
  await form.getByLabel("¿Para qué es?").fill("Prueba");
  await form.getByLabel("¿Cuánto quieres juntar?").fill("10");
  await form.getByRole("button", { name: "Crear cajita" }).click();
  expect(await page.evaluate(() => localStorage.getItem("guardadito:v1"))).toBe(
    '{"datos":"incompletos"}',
  );
});
