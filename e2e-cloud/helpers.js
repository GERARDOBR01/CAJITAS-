import { expect } from "@playwright/test";

export const password = "ahorro-seguro-1";

export async function more(page, name) {
  await page.getByRole("button", { name: "Más", exact: true }).click();
  await page.getByRole("button", { name, exact: true }).click();
}

export async function signUp(page, name, email) {
  await page.goto("/");
  await more(page, "Mi cuenta");
  await page.getByRole("button", { name: "¿No tienes cuenta? Créala" }).click();
  await page.getByLabel("¿Cómo te llamas?").fill(name);
  await page.getByLabel("Correo").fill(email);
  await page.getByLabel("Contraseña").fill(password);
  await page.getByRole("button", { name: "Crear mi cuenta" }).click();
  await expect(
    page.getByRole("heading", { name: `Hola, ${name} ♡` }),
  ).toBeVisible();
}

/** `a` invites, `b` accepts. */
export async function pair(a, b, aName, bName) {
  await more(a, "Mi pareja");
  await a.getByRole("button", { name: "Crear mi código" }).click();
  const code = (await a.locator(".partner-code").textContent()).trim();
  await more(b, "Mi pareja");
  await b.getByLabel("Código de tu pareja").fill(code);
  await b.getByRole("button", { name: "Vincular" }).click();
  await expect(
    b.getByRole("heading", { name: `Tú y ${aName} 💞` }),
  ).toBeVisible();
  await expect(
    a.getByRole("heading", { name: `Tú y ${bName} 💞` }),
  ).toBeVisible();
}

export const home = (page) =>
  page
    .getByRole("button", { name: "Mis cajitas", exact: true })
    .first()
    .click();
