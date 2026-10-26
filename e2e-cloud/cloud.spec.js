import { test, expect } from "@playwright/test";
import { createGoal, home, more, saveIn } from "./helpers.js";

const password = "ahorro-seguro-1";
const openAccount = (page) => more(page, "Mi cuenta");

const contexts = [];
test.afterEach(async () => {
  await Promise.all(contexts.splice(0).map((c) => c.close()));
});

test("una cuenta lleva las cajitas de un teléfono a otro", async ({
  browser,
}, info) => {
  const email = `jade-${info.project.name}-${Date.now()}@guardadito.test`;
  const phoneA = await (await browser.newContext(info.project.use)).newPage();
  contexts.push(phoneA.context());
  const phoneB = await (await browser.newContext(info.project.use)).newPage();
  contexts.push(phoneB.context());

  // Teléfono A: ya tenía una cajita antes de crear la cuenta.
  await phoneA.goto("/");
  await createGoal(phoneA, "Viaje a Cancún", 2000);
  await expect(phoneA.locator(".cajita")).toContainText("Viaje a Cancún");

  await openAccount(phoneA);
  await phoneA
    .getByRole("button", { name: "¿No tienes cuenta? Créala" })
    .click();
  await phoneA.getByLabel("¿Cómo te llamas?").fill("Jade");
  await phoneA.getByLabel("Correo").fill(email);
  await phoneA.getByLabel("Contraseña").fill(password);
  await phoneA.getByRole("button", { name: "Crear mi cuenta" }).click();
  // Nunca sube sin preguntar.
  const ask = phoneA.getByRole("dialog", { name: "¿Subimos tus cajitas?" });
  await expect(ask).toContainText("1 cajita");
  await ask.getByRole("button", { name: "Subir mis cajitas" }).click();
  await expect(
    phoneA.getByRole("status").filter({ hasText: "guardadas en tu cuenta" }),
  ).toBeVisible();
  await expect(
    phoneA.getByRole("heading", { name: "Hola, Jade ♡" }),
  ).toBeVisible();

  // Teléfono B: vacío, entra con la misma cuenta y le llegan las cajitas.
  await phoneB.goto("/");
  await openAccount(phoneB);
  await phoneB.getByLabel("Correo").fill(email);
  await phoneB.getByLabel("Contraseña").fill(password);
  await phoneB.getByRole("button", { name: "Entrar", exact: true }).click();
  await expect(phoneB.locator(".toast")).toContainText("llegaron de tu cuenta");
  await home(phoneB);
  await expect(phoneB.locator(".cajita")).toContainText("Viaje a Cancún");

  // Un ahorro en B aparece solo en A.
  await saveIn(phoneB, "Viaje a Cancún", 150);
  await home(phoneA);
  await expect(phoneA.locator(".cajita")).toContainText("$150", {
    timeout: 30000,
  });

  // Borrar la cuenta deja las cajitas solo en el teléfono.
  await openAccount(phoneB);
  await phoneB.getByRole("button", { name: "Borrar mi cuenta" }).click();
  const confirm = phoneB.getByRole("dialog", { name: "Borrar tu cuenta" });
  await confirm
    .getByLabel("Escribe tu contraseña para confirmar")
    .fill(password);
  await confirm.getByRole("button", { name: "Sí, borrar mi cuenta" }).click();
  await expect(phoneB.locator(".toast")).toContainText("Cuenta borrada");
  await expect(
    phoneB.getByRole("heading", { name: "Entra a tu cuenta" }),
  ).toBeVisible();
});
