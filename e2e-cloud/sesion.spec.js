import { test, expect } from "@playwright/test";
import { createGoal, home, more, password, signUp } from "./helpers.js";

const contexts = [];
test.afterEach(async () => {
  await Promise.all(contexts.splice(0).map((c) => c.close()));
});
async function phone(browser, info) {
  const page = await (await browser.newContext(info.project.use)).newPage();
  contexts.push(page.context());
  return page;
}

test("cerrar sesión en un teléfono prestado no deja nada de la cuenta", async ({
  browser,
}, info) => {
  const email = `prestado-${info.project.name}-${Date.now()}@guardadito.test`;
  const page = await phone(browser, info);
  await signUp(page, "Ana", email);
  // A new account is asked to confirm its address, without blocking anything.
  await expect(page.locator(".verify-notice")).toContainText(
    "Confirma tu correo.",
  );
  // The account is ready before the first cajita (otherwise the app asks
  // whether to upload it, which is right but another story).
  await expect(
    page.getByRole("status").filter({ hasText: "guardadas en tu cuenta" }),
  ).toBeVisible({ timeout: 15000 });
  await home(page);
  await createGoal(page, "Tenis", 1500);
  await expect(page.locator(".cajita")).toContainText("Tenis");

  await more(page, "Mi cuenta");
  await page
    .getByRole("button", { name: "Cerrar sesión", exact: true })
    .click();
  const dialog = page.getByRole("dialog", { name: "Cerrar sesión" });
  await dialog
    .getByLabel("Borrar también las cajitas de este teléfono", { exact: false })
    .check();
  const reloaded = page.waitForEvent("load");
  await dialog.getByRole("button", { name: "Cerrar sesión" }).click();
  // The app starts again so Firebase forgets the previous person.
  await reloaded;
  await expect(
    page.getByRole("heading", { name: "Entra a tu cuenta" }),
  ).toBeVisible();
  expect(
    await page.evaluate(() => localStorage.getItem("guardadito:cloud-uid")),
  ).toBeNull();
  await home(page);
  await expect(page.locator(".cajita")).toHaveCount(0);

  // The account still has them.
  await more(page, "Mi cuenta");
  await page.getByLabel("Correo").fill(email);
  await page.getByLabel("Contraseña").fill(password);
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(
    page.getByRole("status").filter({ hasText: "guardadas en tu cuenta" }),
  ).toBeVisible({ timeout: 15000 });
  await home(page);
  await expect(page.locator(".cajita")).toContainText("Tenis");
});

test("un código de pareja sirve una sola vez", async ({ browser }, info) => {
  const stamp = `${info.project.name}-${Date.now()}`;
  const [a, b] = await Promise.all([1, 2].map(() => phone(browser, info)));
  await signUp(a, "Gerardo", `g-${stamp}@guardadito.test`);
  await signUp(b, "Jade", `j-${stamp}@guardadito.test`);
  await more(a, "Ahorrar en pareja");
  await a.getByRole("button", { name: "Crear mi código" }).click();
  const code = (await a.locator(".partner-code").textContent()).trim();
  await more(b, "Ahorrar en pareja");
  await b.getByLabel("Código de tu pareja").fill(code);
  await b.getByRole("button", { name: "Vincular" }).click();
  await expect(b.getByRole("heading", { name: "Tú y Gerardo 💞" })).toBeVisible(
    {
      timeout: 20000,
    },
  );
  // Later, someone who saw the code in a forwarded chat cannot use it.
  await Promise.all([a.context().close(), b.context().close()]);
  const c = await phone(browser, info);
  await signUp(c, "Otra", `o-${stamp}@guardadito.test`);
  await more(c, "Ahorrar en pareja");
  await c.getByLabel("Código de tu pareja").fill(code);
  await c.getByRole("button", { name: "Vincular" }).click();
  await expect(c.locator(".toast")).toContainText(
    /no existe o ya venció|ya se usó/,
    {
      timeout: 20000,
    },
  );
  await expect(c.getByRole("heading", { name: /Tú y/ })).toHaveCount(0);
});
