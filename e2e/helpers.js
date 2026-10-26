// Ways around the one-screen app shared by the specs.
import { expect } from "@playwright/test";

/** Opens Ajustes (from any screen) and, if given, one of its items. */
export async function settings(page, item) {
  await home(page);
  await page.getByRole("button", { name: "Ajustes", exact: true }).click();
  if (item)
    await page
      .getByRole("button", { name: new RegExp(`^${item}`) })
      .first()
      .click();
}

/** Back to home from anywhere. */
export async function home(page) {
  for (let i = 0; i < 3; i++) {
    const back = page.locator(".shell-back");
    if (!(await back.isVisible())) return;
    await back.click();
  }
}

/** Creates a cajita from home. `when` is a chip ("Sin prisa", "3 meses"…)
 * or a date (yyyy-mm-dd); `rhythm` is "Cada semana", "Cada quincena"… */
export async function createGoal(
  page,
  { name, amount, when = "6 meses", rhythm, icon } = {},
) {
  const button = page.getByRole("button", {
    name: /Nueva cajita|Crear mi primera cajita|Crear una cajita nueva/,
  });
  await button.first().click();
  const form = page.getByRole("dialog", { name: "Nueva cajita" });
  if (name) await form.getByLabel("¿Para qué es?").fill(name);
  if (icon) await form.getByRole("button", { name: icon, exact: true }).click();
  if (amount !== undefined)
    await form.getByLabel("¿Cuánto quieres juntar?").fill(String(amount));
  if (/^\d{4}-\d\d-\d\d$/.test(when)) {
    await form.getByRole("button", { name: "Otra fecha" }).click();
    await form.getByLabel("Fecha", { exact: true }).fill(when);
  } else await form.getByRole("button", { name: when, exact: true }).click();
  if (rhythm)
    await form.getByRole("button", { name: rhythm, exact: true }).click();
  await form.getByRole("button", { name: "Crear cajita" }).click();
  await expect(form).toHaveCount(0);
}

/** Types an amount on the sheet's keypad. */
export async function typeAmount(sheet, amount) {
  for (const key of String(amount)) {
    await sheet
      .getByRole("group", { name: "Teclado numérico" })
      .getByRole("button", { name: key, exact: true })
      .click();
  }
}

/** Saves money from the + of a cajita on home. */
export async function saveIn(page, goalName, amount) {
  await page.getByRole("button", { name: `Guardar en ${goalName}` }).click();
  const sheet = page.getByRole("dialog", { name: "Guardar dinero" });
  await sheet.getByLabel("Monto", { exact: true }).fill(String(amount));
  await sheet
    .getByRole("button", { name: /^Guardar/ })
    .last()
    .click();
  await expect(sheet).toHaveCount(0);
}

/** The journal as saved in the browser. */
export const journal = (page) =>
  page.evaluate(() => JSON.parse(localStorage.getItem("guardadito:v1")));
