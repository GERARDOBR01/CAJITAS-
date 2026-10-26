import { test, expect } from "@playwright/test";
import { createGoal, journal, saveIn, settings } from "./helpers.js";

test("elegir mascotas y accesorios se guarda solo y sobrevive a recargar", async ({
  page,
}) => {
  await page.goto("/");
  await settings(page, "Mi mascota");
  await page.getByRole("button", { name: "Elegir Vaquita" }).click();
  await expect(page.getByLabel("Su nombre")).toHaveValue("Mila");
  await page.getByRole("button", { name: /Bufanda/ }).click();
  await page.reload();
  await page.getByRole("button", { name: /^Mi mascota/ }).click();
  await expect(page.getByLabel("Su nombre")).toHaveValue("Mila");
  await expect(
    page.getByRole("button", { name: "Elegir Vaquita" }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.getByLabel("Animaciones y destellitos").uncheck();
  await expect(page.locator(".app")).toHaveClass(/reduced-motion/);
  const state = await journal(page);
  expect(state.preferences).toMatchObject({
    pet: "cow",
    accessory: "scarf",
    animations: false,
  });
  expect(state.goals).toHaveLength(0);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

test("plan persistente, edición y archivo reversible conservan dinero e historial", async ({
  page,
}) => {
  await page.goto("/");
  await createGoal(page, {
    name: "Una escapadita",
    amount: 1000,
    rhythm: "Cada quincena",
  });
  await saveIn(page, "Una escapadita", 100);
  await page
    .getByRole("button", { name: "Ver detalle de Una escapadita" })
    .click();
  await expect(
    page
      .getByRole("group", { name: "Frecuencia de Una escapadita" })
      .getByRole("button", { name: "Quincena" }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "Editar Una escapadita" }).click();
  await page.getByLabel("¿Para qué es?").fill("Mi viaje bonito");
  await page.getByRole("button", { name: "Guardar cambios" }).click();
  await page.getByRole("button", { name: "Volver al inicio" }).click();
  const card = page.locator(".cajita");
  await expect(card).toContainText("Mi viaje bonito");
  await expect(card).toContainText("$100");
  await page
    .getByRole("button", { name: "Ver detalle de Mi viaje bonito" })
    .click();
  await page.getByRole("button", { name: "Editar Mi viaje bonito" }).click();
  await page
    .getByRole("button", { name: "Archivar cajita", exact: true })
    .click();
  await page.getByRole("button", { name: "Volver al inicio" }).click();
  await expect(card).toHaveCount(0);
  await page.getByRole("button", { name: "Archivadas (1)" }).click();
  await expect(card).toContainText("$100");
  await expect(
    card.getByRole("button", { name: "Guardar en Mi viaje bonito" }),
  ).toHaveCount(0);
  await page
    .getByRole("button", { name: "Ver detalle de Mi viaje bonito" })
    .click();
  await page.getByRole("button", { name: "Recuperar cajita" }).click();
  await expect(page.getByRole("status")).toContainText("está de vuelta");
  await page.getByRole("button", { name: "Volver al inicio" }).click();
  await expect(
    page.getByRole("heading", { name: "Mis cajitas" }),
  ).toBeVisible();
  await expect(card).toContainText("Mi viaje bonito");
  await page.reload();
  await page
    .getByRole("button", { name: "Ver detalle de Mi viaje bonito" })
    .click();
  await expect(page.locator(".movement-list li")).toHaveCount(1);
  const goal = (await journal(page)).goals[0];
  expect(goal).toMatchObject({ frequency: 15, archived: false });
});

test("historial, CSV y calendario ofrecen descargas reales", async ({
  page,
}) => {
  await page.goto("/");
  await createGoal(page, { name: "Una escapadita", amount: 1000 });
  await saveIn(page, "Una escapadita", 250);
  await settings(page, "Historial");
  await expect(page.locator(".history")).toContainText("+$250");
  const csvPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: /Descargar en Excel/ }).click();
  expect((await csvPromise).suggestedFilename()).toMatch(/\.csv$/);
  await page.getByRole("button", { name: "Volver" }).click();
  await page.getByRole("button", { name: /^Recordatorio/ }).click();
  await page.getByLabel("Recordarme guardar").check();
  const calendarPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Agregar a mi calendario" }).click();
  expect((await calendarPromise).suggestedFilename()).toBe(
    "guardadito-recordatorio.ics",
  );
});

test("la oferta de instalación se conserva aunque llegue antes de abrir la pantalla", async ({
  page,
}) => {
  await page.goto("/");
  await page.evaluate(() => {
    const event = new Event("beforeinstallprompt", { cancelable: true });
    event.prompt = async () => {
      window.installPromptUsed = true;
    };
    event.userChoice = Promise.resolve({ outcome: "accepted" });
    window.dispatchEvent(event);
  });
  await settings(page, "Instalar");
  await page
    .getByRole("button", { name: "Instalar Guardadito", exact: true })
    .click();
  expect(await page.evaluate(() => window.installPromptUsed)).toBe(true);
});
