// The app as a stranger sees it: the owner's tools are off (VITE_OWNER_TOOLS=0),
// as in the published web and the store app.
import { test, expect } from "@playwright/test";

async function more(page, name) {
  await page.getByRole("button", { name: "Más", exact: true }).click();
  if (name) await page.getByRole("button", { name, exact: true }).click();
}

test("Más no muestra las herramientas del dueño y sí la ayuda", async ({
  page,
}) => {
  await page.goto("/");
  await more(page);
  await expect(page.getByRole("button", { name: "Respaldo", exact: true })).toBeVisible();
  for (const hidden of ["Conexiones", "Rendimiento"])
    await expect(page.getByRole("button", { name: hidden, exact: true })).toHaveCount(0);
  await expect(page.getByText("Descargar para Android")).toHaveCount(0);
  await page.getByRole("button", { name: "Ayuda y comentarios", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Ayuda y comentarios" })).toBeVisible();
  await page.getByText("¿Guardadito guarda mi dinero?").click();
  await expect(page.getByText("Tu dinero se queda donde ya lo tienes")).toBeVisible();
  await expect(page.locator(".help-footer")).toContainText(/Guardadito \d+\.\d+\.\d+/);
});

test("el tutorial no habla de Gmail, Bitso, Banxico ni del APK", async ({
  page,
}) => {
  await page.goto("/?tutorial=1");
  await page.getByRole("button", { name: "Paso 6: Herramientas" }).click();
  const tools = page.getByRole("group", { name: "Explorar herramientas" });
  await expect(tools.getByRole("button", { name: "Actividad", exact: true })).toBeVisible();
  for (const hidden of ["Rendimiento", "Conexiones"])
    await expect(tools.getByRole("button", { name: hidden, exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Paso 7: Tu app" }).click();
  await expect(page.locator(".tutorial")).not.toContainText("APK");
  await expect(page.locator(".tutorial")).not.toContainText("IPA");
});

test("una cajita con «5,000» en BBVA, sin botón de correo y con invitación a cuenta", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "+ Nueva cajita", exact: true }).click();
  await page.getByLabel("Nombre de tu meta").fill("Mi colchoncito");
  await page.getByLabel("¿Cuánto quieres ahorrar? (MXN)").fill("5,000");
  await expect(page.getByLabel("¿Cuánto quieres ahorrar? (MXN)")).toHaveValue("5000");
  await page.getByLabel("Sin fecha").check();
  await page.getByLabel("¿Dónde lo guardas?").selectOption("BBVA");
  await page.getByRole("button", { name: "Crear cajita", exact: true }).click();
  const card = page.locator(".goal-card");
  await expect(card).toContainText("BBVA");
  await card.getByRole("button", { name: "+ Registrar ahorro" }).click();
  const sheet = page.getByRole("dialog");
  await expect(sheet).toContainText("Tu dinero sigue disponible en BBVA");
  await expect(sheet.getByRole("button", { name: "Usar un correo de depósito" })).toHaveCount(0);
  await page.keyboard.press("Escape");
  const nudge = page.getByRole("complementary", { name: "Respalda tus cajitas" });
  await expect(nudge).toBeVisible();
  await nudge.getByRole("button", { name: "Ahora no" }).click();
  await expect(nudge).toHaveCount(0);
  await page.reload();
  await expect(page.locator(".goal-card")).toBeVisible();
  await expect(nudge).toHaveCount(0);
});

test("el inicio vacío invita al paseíto de práctica", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: "¿Primera vez? Da un paseíto de práctica" }).click();
  await expect(page).toHaveURL(/tutorial=1/);
});

test("si una pantalla falla, se ve una salida amable en vez de una página en blanco", async ({
  page,
}) => {
  await page.goto("/?probar-error");
  await expect(page.getByRole("heading", { name: "Algo se atoró" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Recargar Guardadito" })).toBeVisible();
  await expect(page.getByRole("button", { name: "↓ Descargar respaldo" })).toBeVisible();
  const logged = await page.evaluate(() => localStorage.getItem("guardadito:errors"));
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
  await more(page, "Instalar app");
  await expect(page.locator(".install-warning")).toContainText("Antes de instalar, crea tu cuenta.");
  await expect(page.getByText("APK")).toHaveCount(0);
  await context.close();
});
