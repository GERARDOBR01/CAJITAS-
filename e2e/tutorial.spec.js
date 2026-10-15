import { test, expect } from "@playwright/test";
import { mkdir } from "node:fs/promises";

async function step(page, n, label) {
  await page
    .getByRole("button", { name: `Paso ${n}: ${label}`, exact: true })
    .click();
  await expect(
    page.getByRole("progressbar", {
      name: "Recorrido del tutorial",
      exact: true,
    }),
  ).toHaveAttribute("aria-valuenow", String(n));
}
async function rawData(page) {
  return page.evaluate(() => localStorage.getItem("cajitas:v1"));
}
const realData = {
  version: 1,
  goals: [
    {
      id: "real",
      name: "Mi fondo real",
      provider: "Nu",
      icon: "star",
      targetCents: 100000,
      unlockDate: "2027-12-01",
      entries: [
        {
          id: "real-deposit",
          cents: 25000,
          source: "manual",
          at: "2026-10-01T12:00:00Z",
        },
      ],
    },
  ],
  assignments: {},
  importedIds: [],
};

test("recorrido animado practica meta, depósito, retiro, mascota y repaso sin tocar datos reales", async ({
  page,
}) => {
  await mkdir("docs/screenshots", { recursive: true });
  await page.addInitScript(
    (seed) => localStorage.setItem("cajitas:v1", JSON.stringify(seed)),
    realData,
  );
  await page.goto("/?tutorial=1");
  const original = await rawData(page);
  await expect(
    page.getByRole("heading", { name: "Un paseíto por Cajitas" }),
  ).toBeVisible();
  await expect(
    page.getByText("✿ Modo práctica · datos de ejemplo", { exact: true }),
  ).toBeVisible();
  await page.screenshot({
    path: "docs/screenshots/tutorial-01-bienvenida-mobile.png",
    animations: "disabled",
  });
  await page
    .getByRole("button", { name: "Empezar a practicar", exact: true })
    .click();
  await expect(
    page.getByRole("heading", {
      name: "Dale una casita a tu sueño",
      exact: true,
    }),
  ).toBeFocused();
  await page
    .getByLabel("Nombre de la meta de práctica")
    .fill("Mi viaje de ejemplo");
  await page.getByLabel("Meta de práctica (MXN)").fill("1000");
  await page.getByLabel("App externa de práctica").selectOption("Mercado Pago");
  await page.getByLabel("Ritmo de práctica").selectOption("15");
  await expect(page.locator(".plan-preview")).toContainText(
    "$500.00 cada 15 días",
  );
  await page
    .getByRole("button", { name: "Crear cajita de práctica", exact: true })
    .click();
  await expect(
    page.getByLabel("Cajita de práctica", { exact: true }),
  ).toContainText("Mi viaje de ejemplo");
  await step(page, 3, "Ahorrar");
  await page.getByRole("button", { name: "$100.00", exact: true }).click();
  await expect(
    page.getByLabel("Cajita de práctica", { exact: true }),
  ).toContainText("$0.00");
  await page
    .getByRole("button", {
      name: "Registrar depósito de práctica",
      exact: true,
    })
    .click();
  await expect(
    page.getByLabel("Cajita de práctica", { exact: true }),
  ).toContainText("$100.00");
  await expect(
    page.getByLabel("Progreso de la cajita de práctica"),
  ).toHaveAttribute("aria-valuenow", "10");
  await step(page, 4, "El candado");
  await expect(page.locator(".tutorial-lock-scene")).toContainText("días ·");
  await page
    .getByRole("button", { name: "Probar retiro de $20.00", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toContainText("dinero de ejemplo");
  await page
    .getByRole("button", {
      name: "Seguir ahorrando en la práctica",
      exact: true,
    })
    .click();
  await expect(
    page.getByLabel("Cajita de práctica", { exact: true }),
  ).toContainText("$100.00");
  await page
    .getByRole("button", { name: "Probar retiro de $20.00", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Confirmar retiro de práctica", exact: true })
    .click();
  await expect(
    page.getByLabel("Cajita de práctica", { exact: true }),
  ).toContainText("$80.00");
  await page
    .getByRole("button", { name: "Completar meta de práctica", exact: true })
    .click();
  await expect(
    page.getByLabel("Progreso de la cajita de práctica"),
  ).toHaveAttribute("aria-valuenow", "100");
  await expect(page.locator(".tutorial-confetti")).toBeAttached();
  await step(page, 5, "Tu mascota");
  await page
    .getByRole("button", { name: /Mila.*Vaquita|Vaquita/, exact: false })
    .last()
    .click();
  await page.getByRole("button", { name: "Moñito", exact: true }).click();
  await page
    .getByRole("button", {
      name: "Visitar a mi mascota de práctica",
      exact: true,
    })
    .click();
  await expect(page.getByRole("status")).toContainText("sigue en $1,000.00");
  await page.locator(".tutorial-pet-stage").scrollIntoViewIfNeeded();
  await page.screenshot({
    path: "docs/screenshots/tutorial-02-mascota-mobile.png",
    animations: "disabled",
  });
  expect(await rawData(page)).toBe(original);
  await step(page, 8, "A tu ritmo");
  await page.getByLabel("En mi app externa", { exact: true }).check();
  await page.getByLabel("No, cuenta como compañía", { exact: true }).check();
  await page
    .getByLabel("Reviso y lo vinculo al registro existente", { exact: true })
    .check();
  await page
    .getByRole("button", { name: "Revisar mis respuestas", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText("¡Tres de tres!");
  expect(await rawData(page)).toBe(original);
  await page
    .getByRole("button", { name: "Crear una cajita real", exact: true })
    .click();
  await expect(
    page.getByRole("dialog", { name: "Un nuevo sueño" }),
  ).toBeVisible();
  await expect(page).not.toHaveURL(/tutorial=1/);
  expect(await rawData(page)).toBe(original);
});

test("herramientas, tasa capturada y plataformas se explican sin consultas API ni escrituras", async ({
  page,
}) => {
  const requests = [];
  page.on("request", (request) => {
    if (new URL(request.url()).pathname.startsWith("/api/"))
      requests.push(request.url());
  });
  await page.goto("/?tutorial=1");
  await step(page, 6, "Herramientas");
  await page.getByRole("button", { name: "Rendimiento", exact: true }).click();
  await expect(page.locator(".tutorial-rate-preview")).toContainText(
    "no consulta ni inventa",
  );
  await page.getByLabel("Tasa anual para la práctica (%)").fill("10");
  await expect(page.locator(".tutorial-rate-preview")).toContainText("$8.22");
  await page.getByRole("button", { name: "Conexiones", exact: true }).click();
  await page
    .getByRole("button", {
      name: "Simular vincular al registro existente",
      exact: true,
    })
    .click();
  await expect(
    page.getByRole("button", { name: "✓ Vinculado sin volver a sumar" }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "Respaldo", exact: true }).click();
  await page
    .getByRole("button", { name: "Ver qué contiene un respaldo", exact: true })
    .click();
  await expect(page.locator(".tutorial-backup-list")).toContainText(
    "Sin contraseñas, llaves ni conexiones",
  );
  await page.locator(".tutorial-tool-content").scrollIntoViewIfNeeded();
  await page.screenshot({
    path: "docs/screenshots/tutorial-03-respaldo-mobile.png",
    animations: "disabled",
  });
  await step(page, 7, "Tu app");
  await page.getByRole("button", { name: "iPhone", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "iPhone: desde Safari", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".tutorial-instructions")).toContainText(
    "Agregar a pantalla de inicio",
  );
  await expect(
    page.getByRole("link", {
      name: "Descargar APK Android de prueba ↗",
      exact: true,
    }),
  ).toHaveCount(0);
  expect(await rawData(page)).toBeNull();
  expect(requests).toEqual([]);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

test("acceso desde inicio y Más, pausa, reducción de movimiento, salida y reinicio", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Más", exact: true }).click();
  await page
    .getByRole("button", { name: "Tutorial interactivo", exact: true })
    .click();
  await expect(page).toHaveURL(/tutorial=1/);
  await page
    .getByRole("button", { name: "Pausar animaciones", exact: true })
    .click();
  await expect(page.locator(".tutorial")).toHaveClass(/tutorial-paused/);
  await expect(
    page.getByRole("button", { name: "Activar animaciones", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  expect(
    await page
      .locator(".tutorial-flow li > span")
      .first()
      .evaluate((el) => getComputedStyle(el).animationName),
  ).toBe("none");
  await page
    .getByRole("button", { name: "Activar animaciones", exact: true })
    .click();
  await page.emulateMedia({ reducedMotion: "reduce" });
  expect(
    await page
      .locator(".tutorial-flow li > span")
      .first()
      .evaluate((el) => getComputedStyle(el).animationName),
  ).toBe("none");
  await step(page, 3, "Ahorrar");
  await page
    .getByRole("button", {
      name: "Registrar depósito de práctica",
      exact: true,
    })
    .click();
  await step(page, 8, "A tu ritmo");
  await page
    .getByRole("button", { name: "Repetir tutorial", exact: true })
    .click();
  await step(page, 3, "Ahorrar");
  await expect(
    page.getByLabel("Cajita de práctica", { exact: true }),
  ).toContainText("$0.00");
  await page
    .getByRole("button", { name: "Salir de la práctica", exact: true })
    .click();
  await expect(page).not.toHaveURL(/tutorial=1/);
  await page.getByRole("button", { name: "Más", exact: true }).click();
  await page
    .getByRole("button", { name: "Tutorial interactivo", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Más", exact: true }),
  ).toHaveAttribute("aria-current", "page");
  await expect(
    page.getByRole("progressbar", {
      name: "Recorrido del tutorial",
      exact: true,
    }),
  ).toHaveAttribute("aria-valuenow", "1");
  await page.evaluate(() => window.dispatchEvent(new Event("cajitas:back")));
  await expect(page).not.toHaveURL(/tutorial=1/);
  await expect(
    page.getByRole("heading", { name: "Un paseíto por Cajitas" }),
  ).toHaveCount(0);
  expect(await rawData(page)).toBeNull();
});

test("repaso indica el error y se puede corregir; Escape cancela retiro y recargar reinicia la práctica", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/?tutorial=1");
  await step(page, 4, "El candado");
  await page
    .getByRole("button", { name: "Preparar $100 de ejemplo", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Probar retiro de $20.00", exact: true })
    .click();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await expect(
    page.getByLabel("Cajita de práctica", { exact: true }),
  ).toContainText("$100.00");
  await step(page, 8, "A tu ritmo");
  await page.getByLabel("Dentro de Cajitas", { exact: true }).check();
  await page.getByLabel("Sí, es un depósito", { exact: true }).check();
  await page.getByLabel("Lo vuelvo a sumar", { exact: true }).check();
  await page
    .getByRole("button", { name: "Revisar mis respuestas", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText("0 de 3");
  await expect(page.locator(".tutorial-wrong")).toHaveCount(3);
  await page.getByLabel("En mi app externa", { exact: true }).check();
  await page.getByLabel("No, cuenta como compañía", { exact: true }).check();
  await page
    .getByLabel("Reviso y lo vinculo al registro existente", { exact: true })
    .check();
  await page
    .getByRole("button", { name: "Revisar mis respuestas", exact: true })
    .click();
  await expect(page.locator(".tutorial-right")).toHaveCount(3);
  await page.reload();
  await expect(
    page.getByRole("progressbar", {
      name: "Recorrido del tutorial",
      exact: true,
    }),
  ).toHaveAttribute("aria-valuenow", "1");
  await step(page, 4, "El candado");
  await expect(
    page.getByLabel("Cajita de práctica", { exact: true }),
  ).toContainText("$0.00");
  expect(await rawData(page)).toBeNull();
  expect(errors).toEqual([]);
});
