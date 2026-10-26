// The first time someone opens Guardadito: choose a companion, then the
// first cajita.
import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test("la bienvenida elige compañero y lleva a la primera cajita", async ({
  page,
}) => {
  await page.goto("/?bienvenida=1");
  await expect(
    page.getByRole("heading", { name: "Tu guardadito, pasito a pasito" }),
  ).toBeVisible();
  await expect(page.getByText("Paso 1 de 2")).toBeVisible();
  // Cookie is a gift from a partner; it is not offered here.
  await expect(page.getByRole("button", { name: /Gatito/ })).toHaveCount(0);
  await page.getByRole("button", { name: /Nutria/ }).click();
  await expect(page.getByLabel("¿Cómo se va a llamar?")).toHaveValue("Nuri");
  await page.getByLabel("¿Cómo se va a llamar?").fill("Bolita");
  const scan = await new AxeBuilder({ page }).analyze();
  expect(scan.violations.map((v) => v.id)).toEqual([]);
  await page.getByRole("button", { name: "Empezar con Bolita" }).click();
  await expect(page.getByText("Paso 2 de 2")).toBeVisible();
  await page.getByRole("button", { name: /Un viaje/ }).click();
  const form = page.getByRole("dialog", { name: "Nueva cajita" });
  await expect(form.getByLabel("¿Para qué es?")).toHaveValue("Un viaje");
  // The idea also picked the icon.
  await expect(
    form.getByRole("button", { name: "Viaje", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await form.getByLabel("¿Cuánto quieres juntar?").fill("8000");
  await form.getByRole("button", { name: "Sin prisa" }).click();
  await form.getByRole("button", { name: "Crear cajita" }).click();
  await expect(page.locator(".cajita")).toContainText("Un viaje");
  await expect(page.locator(".shell-pet")).toHaveAccessibleName(
    "Mi mascota, Bolita",
  );
  // Once is enough. (A test browser only sees it when the address asks.)
  const welcomed = await page.evaluate(() =>
    localStorage.getItem("guardadito:welcomed"),
  );
  expect(welcomed).toBe("1");
  await expect(
    page.getByRole("button", { name: /Primero quiero/ }),
  ).toHaveCount(0);
});

test("«Lo hago después» deja el inicio vacío y «Ya tengo cuenta» abre Mi cuenta", async ({
  page,
}) => {
  await page.goto("/?bienvenida=1");
  await page.getByRole("button", { name: /Empezar con/ }).click();
  await page.getByRole("button", { name: "Lo hago después" }).click();
  await expect(
    page.getByRole("button", { name: "Crear mi primera cajita" }),
  ).toBeVisible();
  await page.goto("/?bienvenida=1");
  await page.evaluate(() => localStorage.removeItem("guardadito:welcomed"));
  await page.goto("/?bienvenida=1");
  await page.getByRole("button", { name: "Ya tengo cuenta" }).click();
  await expect(
    page.getByRole("heading", { name: "Entra a tu cuenta" }),
  ).toBeVisible();
  // Without signing in, the welcome is still pending.
  expect(
    await page.evaluate(() => localStorage.getItem("guardadito:welcomed")),
  ).toBeNull();
});
