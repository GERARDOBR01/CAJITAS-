import { expect } from "@playwright/test";

export const password = "ahorro-seguro-1";

/** Opens Ajustes (from any screen) and one of its items (by its title). */
export async function more(page, name) {
  await home(page);
  await page.getByRole("button", { name: "Ajustes", exact: true }).click();
  await page
    .getByRole("button", { name: new RegExp(`^${name}`) })
    .first()
    .click();
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
  await more(a, "Ahorrar en pareja");
  await a.getByRole("button", { name: "Crear mi código" }).click();
  const code = (await a.locator(".partner-code").textContent()).trim();
  await more(b, "Ahorrar en pareja");
  await b.getByLabel("Código de tu pareja").fill(code);
  await b.getByRole("button", { name: "Vincular" }).click();
  await expect(
    b.getByRole("heading", { name: `Tú y ${aName} 💞` }),
  ).toBeVisible();
  await expect(
    a.getByRole("heading", { name: `Tú y ${bName} 💞` }),
  ).toBeVisible();
}

/** Back to home from anywhere. */
export async function home(page) {
  for (let i = 0; i < 3; i++) {
    const back = page.locator(".shell-back");
    if (!(await back.isVisible())) return;
    await back.click();
  }
}

/** Creates a personal cajita from home, without a date. */
export async function createGoal(page, name, amount) {
  await page
    .getByRole("button", {
      name: /Nueva cajita|Crear mi primera cajita|Crear una cajita nueva/,
    })
    .first()
    .click();
  const form = page.getByRole("dialog", { name: "Nueva cajita" });
  await form.getByLabel("¿Para qué es?").fill(name);
  await form.getByLabel("¿Cuánto quieres juntar?").fill(String(amount));
  await form.getByRole("button", { name: "Sin prisa" }).click();
  await form.getByRole("button", { name: "Crear cajita" }).click();
  await expect(form).toHaveCount(0);
}

/** Saves money in a personal cajita from home. */
export async function saveIn(page, name, amount) {
  await page.getByRole("button", { name: `Guardar en ${name}` }).click();
  const sheet = page.getByRole("dialog", { name: "Guardar dinero" });
  await sheet.getByLabel("Monto", { exact: true }).fill(String(amount));
  await sheet
    .getByRole("button", { name: /^Guardar/ })
    .last()
    .click();
  await expect(sheet).toHaveCount(0);
}
