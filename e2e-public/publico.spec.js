// The app as a stranger sees it: the owner's tools are off (VITE_OWNER_TOOLS=0),
// as in the published web and the store app.
import { test, expect } from "@playwright/test";

async function settings(page, name) {
  await page.getByRole("button", { name: "Ajustes", exact: true }).click();
  if (name)
    await page
      .getByRole("button", { name: new RegExp(`^${name}`) })
      .first()
      .click();
}

test("Ajustes no muestra las herramientas del dueño y sí la ayuda", async ({
  page,
}) => {
  await page.goto("/");
  await settings(page);
  await expect(page.getByRole("button", { name: /^Respaldo/ })).toBeVisible();
  for (const hidden of ["Conexiones", "Rendimiento", "Tutorial"])
    await expect(
      page.getByRole("button", { name: new RegExp(hidden) }),
    ).toHaveCount(0);
  await expect(page.getByText(/APK|Descargar para Android/)).toHaveCount(0);
  await page.getByRole("button", { name: /^Ayuda/ }).click();
  await expect(
    page.getByRole("heading", { name: "Ayuda y comentarios" }),
  ).toBeVisible();
  await page.getByText("¿Guardadito guarda mi dinero?").click();
  await expect(
    page.getByText("Tu dinero se queda donde ya lo tienes"),
  ).toBeVisible();
  await expect(page.locator(".help-footer")).toContainText(
    /Guardadito \d+\.\d+\.\d+/,
  );
});

test("un enlace viejo al tutorial abre el inicio, sin pantalla en blanco", async ({
  page,
}) => {
  await page.goto("/?tutorial=1");
  await expect(
    page.getByRole("region", { name: "Inicio", exact: true }),
  ).toBeVisible();
  await page.goto("/?gmail=connected");
  await expect(
    page.getByRole("region", { name: "Inicio", exact: true }),
  ).toBeVisible();
  await expect(page.getByText("Gmail")).toHaveCount(0);
});

test("una cajita con «5,000» sin preguntar el banco, guardar en 3 toques e invitación a cuenta", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Crear mi primera cajita" }).click();
  const form = page.getByRole("dialog", { name: "Nueva cajita" });
  await form.getByLabel("¿Para qué es?").fill("Mi colchoncito");
  await form.getByLabel("¿Cuánto quieres juntar?").fill("5,000");
  await expect(form.getByLabel("¿Cuánto quieres juntar?")).toHaveValue("5000");
  await expect(form.getByText(/dónde lo guardas|candado/i)).toHaveCount(0);
  await form.getByRole("button", { name: "Sin prisa" }).click();
  await form.getByRole("button", { name: "Crear cajita" }).click();
  // 1: Guardar dinero · 2: $50 · 3: Guardar.
  await page.getByRole("button", { name: "Guardar dinero" }).click();
  const sheet = page.getByRole("dialog", { name: "Guardar dinero" });
  await expect(
    sheet.getByRole("button", { name: "Usar un correo de depósito" }),
  ).toHaveCount(0);
  await sheet.getByRole("button", { name: "$50", exact: true }).click();
  await sheet.getByRole("button", { name: "Guardar $50" }).click();
  await expect(page.locator(".cajita")).toContainText("$50");
  const nudge = page.getByRole("complementary", {
    name: "Respalda tus cajitas",
  });
  await expect(nudge).toBeVisible();
  await nudge.getByRole("button", { name: "Ahora no" }).click();
  await expect(nudge).toHaveCount(0);
  await page.reload();
  await expect(page.locator(".cajita")).toBeVisible();
  await expect(nudge).toHaveCount(0);
});

test("el primer ahorro se celebra y luego ofrece, una vez, un recordatorio", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Crear mi primera cajita" }).click();
  const form = page.getByRole("dialog", { name: "Nueva cajita" });
  await form.getByLabel("¿Para qué es?").fill("Tenis");
  await form.getByLabel("¿Cuánto quieres juntar?").fill("1500");
  await form.getByRole("button", { name: "Sin prisa" }).click();
  await form.getByRole("button", { name: "Crear cajita" }).click();
  await page
    .getByRole("complementary", { name: "Respalda tus cajitas" })
    .getByRole("button", { name: "Ahora no" })
    .click();
  await page.getByRole("button", { name: "Guardar dinero" }).click();
  const sheet = page.getByRole("dialog", { name: "Guardar dinero" });
  await sheet.getByRole("button", { name: "$20", exact: true }).click();
  await sheet.getByRole("button", { name: "Guardar $20" }).click();
  await expect(page.locator(".toast")).toContainText("¡Tu primer pasito!");
  const offer = page.getByRole("complementary", {
    name: "Recordatorio semanal",
  });
  await offer.getByRole("button", { name: "Sí, recuérdame" }).click();
  await expect(offer).toHaveCount(0);
  const reminder = await page.evaluate(
    () =>
      JSON.parse(localStorage.getItem("guardadito:v1")).preferences.reminder,
  );
  expect(reminder).toMatchObject({
    enabled: true,
    frequency: "weekly",
    day: 5,
  });
  await page.reload();
  await expect(offer).toHaveCount(0);
});

test("nada de cuentas regresivas con segundos ni candados", async ({
  page,
}) => {
  await page.addInitScript(() =>
    localStorage.setItem(
      "guardadito:v1",
      JSON.stringify({
        version: 2,
        importedIds: [],
        assignments: {},
        checkins: [],
        goals: [
          {
            id: "g",
            name: "Viaje",
            targetCents: 100000,
            unlockDate: "2099-01-01",
            provider: "Nu",
            icon: "cloud",
            entries: [],
          },
        ],
      }),
    ),
  );
  await page.goto("/");
  await expect(page.locator("body")).not.toContainText(/\d\d:\d\d:\d\d/);
  await page.getByRole("button", { name: "Ver detalle de Viaje" }).click();
  await expect(page.locator("body")).not.toContainText(/\d\d:\d\d:\d\d/);
  await expect(page.locator("body")).not.toContainText(/candado/i);
});

test("si una pantalla falla, se ve una salida amable en vez de una página en blanco", async ({
  page,
}) => {
  await page.goto("/?probar-error");
  await expect(
    page.getByRole("heading", { name: "Algo se atoró" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Recargar Guardadito" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "↓ Descargar respaldo" }),
  ).toBeVisible();
  const logged = await page.evaluate(() =>
    localStorage.getItem("guardadito:errors"),
  );
  expect(logged).toContain("Prueba de la pantalla de error");
});

test("Instalar en iPhone pide crear la cuenta antes y no ofrece el APK", async ({
  browser,
}) => {
  const context = await browser.newContext({
    userAgent:
      "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1",
    viewport: { width: 390, height: 844 },
  });
  const page = await context.newPage();
  await page.goto("/");
  await settings(page, "Instalar");
  await expect(page.locator(".install-warning")).toContainText(
    "Antes de instalar, crea tu cuenta.",
  );
  await expect(page.getByText("APK")).toHaveCount(0);
  await context.close();
});
