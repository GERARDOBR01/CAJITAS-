import { test, expect } from "@playwright/test";
import { settings } from "./helpers.js";

const search = (page) => new URL(page.url()).search;

test("?gmail=connected abre Conexiones, avisa una vez y limpia la dirección", async ({
  page,
}) => {
  await page.goto("/?gmail=connected");
  await expect(
    page.getByRole("status").filter({ hasText: "Gmail conectado" }),
  ).toBeVisible();
  expect(search(page)).toBe("");
  await page.reload();
  await expect(
    page.getByRole("status").filter({ hasText: "Gmail conectado" }),
  ).toHaveCount(0);
});

test("?pareja=CÓDIGO se consume y deja la dirección limpia", async ({
  page,
}) => {
  await page.goto("/?pareja=ABC123");
  await expect.poll(() => search(page)).toBe("");
});

test("un enlace viejo al tutorial abre el inicio y limpia la dirección", async ({
  page,
}) => {
  await page.goto("/?tutorial=1");
  await expect(page.getByRole("region", { name: "Inicio" })).toBeVisible();
  await expect.poll(() => search(page)).toBe("");
});

const pressBack = (page) =>
  page.evaluate(() => {
    const event = new Event("guardadito:back", { cancelable: true });
    window.dispatchEvent(event);
    return event.defaultPrevented;
  });

test("atrás sube un nivel: Historial → Ajustes → Inicio; ahí ya no responde", async ({
  page,
}) => {
  await page.goto("/");
  await settings(page, "Historial");
  await expect(page.getByRole("heading", { name: "Historial" })).toBeVisible();
  expect(await pressBack(page)).toBe(true);
  await expect(page.getByRole("heading", { name: "Ajustes" })).toBeVisible();
  expect(await pressBack(page)).toBe(true);
  await expect(page.getByRole("region", { name: "Inicio" })).toBeVisible();
  expect(await pressBack(page)).toBe(false);
});

test("la flecha de arriba regresa igual que el botón atrás", async ({
  page,
}) => {
  await page.goto("/");
  await settings(page, "Ayuda");
  await page.getByRole("button", { name: "Volver" }).click();
  await expect(page.getByRole("heading", { name: "Ajustes" })).toBeVisible();
  await page.getByRole("button", { name: "Volver al inicio" }).click();
  await expect(page.getByRole("region", { name: "Inicio" })).toBeVisible();
});
