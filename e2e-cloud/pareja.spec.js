import { test, expect } from "@playwright/test";
import { createGoal, home, more, password, saveIn } from "./helpers.js";

async function signUp(page, name, email) {
  await more(page, "Mi cuenta");
  await page.getByRole("button", { name: "¿No tienes cuenta? Créala" }).click();
  await page.getByLabel("¿Cómo te llamas?").fill(name);
  await page.getByLabel("Correo").fill(email);
  await page.getByLabel("Contraseña").fill(password);
  await page.getByRole("button", { name: "Crear mi cuenta" }).click();
}

const contexts = [];
test.afterEach(async () => {
  await Promise.all(contexts.splice(0).map((c) => c.close()));
});

test("una pareja se vincula y se manda a Cookie, notitas y premios", async ({
  browser,
}, info) => {
  const stamp = `${info.project.name}-${Date.now()}`;
  const beto = await (await browser.newContext(info.project.use)).newPage();
  contexts.push(beto.context());
  const ana = await (await browser.newContext(info.project.use)).newPage();
  contexts.push(ana.context());

  // Ana ya tiene una cajita; Beto empieza sin nada.
  await ana.goto("/");
  await createGoal(ana, "Viaje", 1000);
  await signUp(ana, "Ana", `ana-${stamp}@guardadito.test`);
  await ana
    .getByRole("dialog", { name: "¿Subimos tus cajitas?" })
    .getByRole("button", { name: "Subir mis cajitas" })
    .click();
  await beto.goto("/");
  await signUp(beto, "Beto", `beto-${stamp}@guardadito.test`);
  await expect(
    beto.getByRole("heading", { name: "Hola, Beto ♡" }),
  ).toBeVisible();

  // Beto invita con un código; Ana lo escribe.
  await more(beto, "Ahorrar en pareja");
  await beto.getByRole("button", { name: "Crear mi código" }).click();
  const code = (await beto.locator(".partner-code").textContent()).trim();
  expect(code).toMatch(/^[A-Z2-9]{6}$/);
  await more(ana, "Ahorrar en pareja");
  await ana.getByLabel("Código de tu pareja").fill(code.toLowerCase());
  await ana.getByRole("button", { name: "Vincular" }).click();
  await expect(
    ana.getByRole("heading", { name: "Tú y Beto 💞" }),
  ).toBeVisible();
  await expect(
    beto.getByRole("heading", { name: "Tú y Ana 💞" }),
  ).toBeVisible();
  await expect(beto.getByLabel("Cajitas de Ana")).toContainText("Viaje");

  // Cookie con las palabras de Beto, solo para Ana.
  await beto
    .getByLabel("Lo que dice cada ratito (una frase por línea)")
    .fill("¡Muack!\nMuack muack");
  await beto.getByLabel("Lo que dice al tocarla").fill("¡Te quiero, Ana!");
  await beto.getByRole("button", { name: "Mandarle a Cookie" }).click();
  const cookie = ana.getByRole("dialog", { name: "¡Beto te mandó a Cookie!" });
  await expect(cookie).toBeVisible({ timeout: 30000 });
  await cookie.getByRole("button", { name: "Conocer a Cookie 🐱" }).click();
  await home(ana);
  const anaHome = ana.getByRole("region", { name: "Inicio", exact: true });
  await expect(anaHome.locator(".mascot.pet-cat")).toHaveCount(1);
  await anaHome.getByRole("button", { name: "Acariciar a Cookie" }).click();
  await expect(ana.locator(".love-banner")).toContainText("¡Te quiero, Ana!");
  // Beto no tiene a Cookie.
  await more(beto, "Mi mascota");
  await expect(beto.locator(".pet-options")).not.toContainText("Gatito");

  // Una notita al abrir y un premio al 50 %.
  await more(beto, "Ahorrar en pareja");
  await beto.getByLabel("Tu notita para Ana").fill("Estoy orgulloso de ti");
  await beto.getByRole("button", { name: "Mandar notita" }).click();
  const note = ana.getByRole("dialog", { name: "Beto te dejó una notita 💌" });
  await expect(note).toContainText("Estoy orgulloso de ti", { timeout: 30000 });
  await note.getByRole("button", { name: "♡ Gracias" }).click();
  await expect(beto.getByLabel("Notitas enviadas")).toContainText("✓ La leyó", {
    timeout: 30000,
  });

  await beto.getByLabel("Título").fill("Cupón para una cita");
  await beto.getByLabel("Mensaje").fill("Tú eliges el lugar");
  await beto.getByRole("button", { name: "Guardar premio" }).click();
  await more(ana, "Ahorrar en pareja");
  await expect(ana.getByText("Al 50 % de «Viaje»")).toBeVisible({
    timeout: 30000,
  });
  await home(ana);
  await saveIn(ana, "Viaje", 600);
  const reward = ana.getByRole("dialog", { name: "🎁 Cupón para una cita" });
  await expect(reward).toContainText("Tú eliges el lugar");
  await reward.getByRole("button", { name: "Guardar en mi corazón ♡" }).click();

  // Deshacer el vínculo.
  await more(ana, "Ahorrar en pareja");
  await ana.getByRole("button", { name: "Deshacer el vínculo" }).click();
  await ana.getByRole("button", { name: "Sí, deshacer" }).click();
  await expect(
    ana.getByRole("heading", { name: "Ahorren juntos 💞" }),
  ).toBeVisible();
  await expect(
    beto.getByRole("heading", { name: "Ahorren juntos 💞" }),
  ).toBeVisible();
});
