import { test, expect } from "@playwright/test";
import { mkdir } from "node:fs/promises";
async function more(page, name) {
  await page.getByRole("button", { name: "Más", exact: true }).click();
  await page.getByRole("button", { name, exact: true }).click();
}
async function dismiss(page) {
  const close = page.getByRole("button", { name: "Cerrar aviso", exact: true });
  if (await close.isVisible()) await close.click();
}
async function createGoal(page) {
  await page
    .getByRole("button", { name: "+ Nueva cajita", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Una escapadita", exact: false })
    .click();
  await page.getByLabel("¿Cuánto quieres ahorrar? (MXN)").fill("1000");
  await page.getByLabel("Mi ritmo de ahorro").selectOption("15");
  await page.getByRole("button", { name: "Crear cajita", exact: true }).click();
}
test("elegir mascotas, accesorios, visita sin dinero y persistencia", async ({
  page,
}) => {
  await mkdir("docs/screenshots", { recursive: true });
  await page.goto("/");
  await page.getByRole("button", { name: "Mi mascota", exact: true }).click();
  await page.getByRole("button", { name: "Elegir Cerdito" }).click();
  await page.getByLabel("Su nombre").fill("Pipo");
  await page.getByRole("button", { name: /Moñito/ }).click();
  await page.getByRole("button", { name: "Guardar mi compañero" }).click();
  await dismiss(page);
  await page.evaluate(() => scrollTo(0, 0));
  await page.screenshot({ path: "docs/screenshots/v2-01-cerdito-mobile.png" });
  await page.getByRole("button", { name: "Visitar a mi compañero" }).click();
  await expect(
    page.getByRole("button", { name: "♡ Ya nos acompañamos hoy" }),
  ).toBeDisabled();
  let state = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("guardadito:v1")),
  );
  expect(state.checkins).toHaveLength(1);
  expect(state.goals).toHaveLength(0);
  await page.getByRole("button", { name: "Elegir Vaquita" }).click();
  await page.getByLabel("Su nombre").fill("Mila");
  await page.getByRole("button", { name: /Bufanda/ }).click();
  await page.getByRole("button", { name: "Guardar mi compañero" }).click();
  await dismiss(page);
  await page.evaluate(() => scrollTo(0, 0));
  await page.screenshot({ path: "docs/screenshots/v2-02-vaquita-mobile.png" });
  await page.reload();
  await page.getByRole("button", { name: "Mi mascota", exact: true }).click();
  await expect(page.getByLabel("Su nombre")).toHaveValue("Mila");
  await expect(
    page.getByRole("button", { name: "Elegir Vaquita" }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "Elegir Conejito" }).click();
  await page.getByRole("button", { name: "Guardar mi compañero" }).click();
  await dismiss(page);
  await page.evaluate(() => scrollTo(0, 0));
  await page.screenshot({ path: "docs/screenshots/v2-03-conejito-mobile.png" });
  await page.getByLabel("Animaciones suaves y destellitos").uncheck();
  await page.getByRole("button", { name: "Guardar mi compañero" }).click();
  await expect(page.locator(".app")).toHaveClass(/reduced-motion/);
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
  await createGoal(page);
  const card = page.locator(".goal-card");
  await expect(card.getByLabel("Frecuencia de Una escapadita")).toHaveValue(
    "15",
  );
  await card.getByRole("button", { name: "+ Registrar ahorro" }).click();
  await page.getByLabel("Monto (MXN)").fill("100");
  await page
    .getByRole("button", { name: "Registrar ahorro", exact: true })
    .click();
  await card.getByRole("button", { name: "Editar Una escapadita" }).click();
  await page.getByLabel("Nombre de tu meta").fill("Mi viaje bonito");
  await page.getByRole("button", { name: "Guardar cambios" }).click();
  await expect(card).toContainText("Mi viaje bonito");
  await expect(card.locator(".saved")).toContainText("$100.00");
  await card.getByRole("button", { name: "Editar Mi viaje bonito" }).click();
  await page
    .getByRole("button", { name: "Archivar cajita", exact: true })
    .click();
  await expect(card).toHaveCount(0);
  await page.getByRole("button", { name: "Archivadas", exact: true }).click();
  await expect(card).toContainText("$100.00");
  await expect(
    card.getByRole("button", { name: "+ Registrar ahorro" }),
  ).toHaveCount(0);
  await card.getByRole("button", { name: "Recuperar cajita" }).click();
  await page.getByRole("button", { name: "Volver a mis cajitas" }).click();
  await expect(card).toContainText("Mi viaje bonito");
  await expect(card).toContainText("Ver movimientos (1)");
  await page.reload();
  await expect(card.getByLabel("Frecuencia de Mi viaje bonito")).toHaveValue(
    "15",
  );
  await dismiss(page);
  await card.scrollIntoViewIfNeeded();
  await page.screenshot({ path: "docs/screenshots/v2-04-meta-mobile.png" });
});
test("actividad, CSV y calendario ofrecen descargas reales sin transferencias", async ({
  page,
}) => {
  await page.goto("/");
  await createGoal(page);
  await page
    .locator(".goal-card")
    .getByRole("button", { name: "+ Registrar ahorro" })
    .click();
  await page.getByLabel("Monto (MXN)").fill("250");
  await page
    .getByRole("button", { name: "Registrar ahorro", exact: true })
    .click();
  await page.getByRole("button", { name: "Actividad", exact: true }).click();
  await expect(
    page.getByRole("img", { name: /Historial del ahorro registrado/ }),
  ).toBeVisible();
  await expect(page.locator(".activity-feed")).toContainText("+$250.00");
  await dismiss(page);
  await page.screenshot({
    path: "docs/screenshots/v2-05-actividad-mobile.png",
  });
  const csvPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "↓ Exportar CSV" }).click();
  const csv = await csvPromise;
  expect(csv.suggestedFilename()).toMatch(/\.csv$/);
  await page.getByRole("button", { name: "Mi mascota", exact: true }).click();
  const calendarPromise = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Agregar a mi calendario ↗" })
    .click();
  const calendar = await calendarPromise;
  expect(calendar.suggestedFilename()).toBe("cajitas-recordatorio.ics");
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
  await more(page, "Instalar app");
  await expect(
    page.getByRole("button", { name: "Instalar Guardadito", exact: true }),
  ).toBeVisible();
  await page.screenshot({ path: "docs/screenshots/v2-06-instalar-mobile.png" });
  await page
    .getByRole("button", { name: "Instalar Guardadito", exact: true })
    .click();
  expect(await page.evaluate(() => window.installPromptUsed)).toBe(true);
});
