import { test, expect } from "@playwright/test";

const password = "ahorro-seguro-1";
const shot = (page, info, name) =>
  info.project.name === "android-chrome"
    ? page.screenshot({ path: `docs/screenshots/v09/${name}.png` })
    : null;

async function openAccount(page) {
  await page.getByRole("button", { name: "Más", exact: true }).click();
  await page.getByRole("button", { name: "Mi cuenta", exact: true }).click();
}

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
  await phoneA
    .getByRole("button", { name: "+ Nueva cajita", exact: true })
    .click();
  await phoneA.getByLabel("Nombre de tu meta").fill("Viaje a Cancún");
  await phoneA.getByLabel("¿Cuánto quieres ahorrar? (MXN)").fill("2000");
  await phoneA
    .getByRole("button", { name: "Crear cajita", exact: true })
    .click();
  await expect(phoneA.locator(".goal-card")).toContainText("Viaje a Cancún");

  await openAccount(phoneA);
  await phoneA
    .getByRole("button", { name: "¿No tienes cuenta? Créala" })
    .click();
  await phoneA.getByLabel("¿Cómo te llamas?").fill("Jade");
  await phoneA.getByLabel("Correo").fill(email);
  await phoneA.getByLabel("Contraseña").fill(password);
  await shot(phoneA, info, "crear-cuenta");
  await phoneA.getByRole("button", { name: "Crear mi cuenta" }).click();
  // Nunca sube sin preguntar.
  const ask = phoneA.getByRole("dialog", { name: "¿Subimos tus cajitas?" });
  await expect(ask).toContainText("1 cajita");
  await shot(phoneA, info, "subir-cajitas");
  await ask.getByRole("button", { name: "Subir mis cajitas" }).click();
  await expect(
    phoneA.getByRole("status").filter({ hasText: "guardadas en tu cuenta" }),
  ).toBeVisible();
  await expect(
    phoneA.getByRole("heading", { name: "Hola, Jade ♡" }),
  ).toBeVisible();
  await shot(phoneA, info, "cuenta-guardada");

  // Teléfono B: vacío, entra con la misma cuenta y le llegan las cajitas.
  await phoneB.goto("/");
  await openAccount(phoneB);
  await phoneB.getByLabel("Correo").fill(email);
  await phoneB.getByLabel("Contraseña").fill(password);
  await phoneB.getByRole("button", { name: "Entrar", exact: true }).click();
  await expect(phoneB.locator(".toast")).toContainText("llegaron de tu cuenta");
  await phoneB
    .getByRole("button", { name: "Mis cajitas", exact: true })
    .first()
    .click();
  const cardB = phoneB.locator(".goal-card");
  await expect(cardB).toContainText("Viaje a Cancún");

  // Un ahorro en B aparece solo en A.
  await cardB.getByRole("button", { name: "+ Registrar ahorro" }).click();
  await phoneB.getByLabel("Monto (MXN)").fill("150");
  await phoneB.getByRole("button", { name: /^Guardar/ }).click();
  await phoneA
    .getByRole("button", { name: "Mis cajitas", exact: true })
    .first()
    .click();
  await expect(phoneA.locator(".goal-card .saved")).toContainText("$150.00", {
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
