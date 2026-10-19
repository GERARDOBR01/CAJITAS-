import { test, expect } from "@playwright/test";

const search = (page) => new URL(page.url()).search;

test("?gmail=connected abre Conexiones, avisa una vez y limpia la dirección", async ({
  page,
}) => {
  await page.goto("/?gmail=connected");
  await expect(
    page.getByRole("status").filter({ hasText: "Gmail conectado" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Más", exact: true }).first(),
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

test("el tutorial vive en la dirección solo mientras está abierto", async ({
  page,
}) => {
  await page.goto("/?tutorial=1");
  expect(search(page)).toBe("?tutorial=1");
  await page.getByRole("button", { name: "Mis cajitas" }).first().click();
  await expect.poll(() => search(page)).toBe("");
});

const pressBack = (page) =>
  page.evaluate(() => {
    const event = new Event("guardadito:back", { cancelable: true });
    window.dispatchEvent(event);
    return event.defaultPrevented;
  });

test("atrás en otra pantalla la lleva a Mis cajitas; ahí ya no responde", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Actividad" }).first().click();
  expect(await pressBack(page)).toBe(true);
  await expect(
    page.getByRole("button", { name: "Actividad" }).first(),
  ).not.toHaveAttribute("aria-current", "page");
  expect(await pressBack(page)).toBe(false);
});
