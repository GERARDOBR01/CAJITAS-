import { test, expect } from "@playwright/test";
import { home, pair, signUp } from "./helpers.js";

const contexts = [];
test.afterEach(async () => {
  await Promise.all(contexts.splice(0).map((c) => c.close()));
});

test("una cajita en pareja: cada quien pone su parte desde su banco", async ({
  browser,
}, info) => {
  const stamp = `${info.project.name}-${Date.now()}`;
  const open = async () => {
    const context = await browser.newContext(info.project.use);
    contexts.push(context);
    return context.newPage();
  };
  const ana = await open(),
    beto = await open();
  await signUp(ana, "Ana", `ana-c-${stamp}@guardadito.test`);
  await signUp(beto, "Beto", `beto-c-${stamp}@guardadito.test`);
  await pair(beto, ana, "Beto", "Ana");

  // Ana crea la cajita y pone el 40 %.
  await home(ana);
  const anaShared = ana.getByRole("region", { name: "En pareja 💞" });
  await anaShared.getByRole("button", { name: "+ Cajita en pareja" }).click();
  await ana.getByLabel("¿Para qué ahorran juntos?").fill("Cancún");
  await ana.getByLabel("¿Cuánto quieren juntar? (MXN)").fill("2000");
  await ana.getByLabel(/Tu parte \(%\)/).fill("40");
  await ana.getByRole("button", { name: "Crear cajita en pareja" }).click();
  const anaCard = anaShared.locator(".shared-card");
  await expect(anaCard).toContainText("Tu parte (40 %)");
  await expect(anaCard).toContainText("Te faltan $800.00");

  // Beto la ve con su 60 % y aporta; a Ana le llega el aviso.
  await home(beto);
  const betoCard = beto
    .getByRole("region", { name: "En pareja 💞" })
    .locator(".shared-card");
  await expect(betoCard).toContainText("Tu parte (60 %)", { timeout: 30000 });
  await betoCard.getByRole("button", { name: "+ Registrar mi aporte" }).click();
  await beto.getByLabel("Monto (MXN)").fill("300");
  await beto
    .getByRole("dialog")
    .getByRole("button", { name: "Registrar mi aporte" })
    .click();
  await expect(ana.locator(".toast")).toContainText(
    "Beto apartó $300.00 para Cancún",
    { timeout: 30000 },
  );
  await expect(anaCard).toContainText("Beto: $300.00");

  // Ana aporta lo suyo.
  await anaCard.getByRole("button", { name: "+ Registrar mi aporte" }).click();
  await ana.getByLabel("Monto (MXN)").fill("200");
  await ana
    .getByRole("dialog")
    .getByRole("button", { name: "Registrar mi aporte" })
    .click();
  await expect(anaCard).toContainText("$500.00");
  await expect(anaCard).toContainText("Te faltan $600.00");
  await expect(betoCard).toContainText("Ana: $200.00", { timeout: 30000 });
  if (info.project.name === "android-chrome")
    await ana.screenshot({
      path: "docs/screenshots/v11/cajita-en-pareja.png",
      fullPage: true,
    });

  // Solo puede retirar lo que ella apartó.
  await anaCard.getByRole("button", { name: "Registrar retiro" }).click();
  await ana.getByLabel("Monto (MXN)").fill("300");
  await ana
    .getByRole("dialog")
    .getByRole("button", { name: "Registrar retiro" })
    .click();
  await expect(ana.locator(".toast")).toContainText("Solo puedes retirar");
  await ana.getByRole("button", { name: "Cerrar", exact: true }).click();

  // Corrige: borra su aporte; el de Beto no se puede tocar.
  await anaCard.getByText("Ver aportes (2)").click();
  await expect(
    anaCard.getByRole("button", { name: /Borrar aporte/ }),
  ).toHaveCount(1);
  await anaCard
    .getByRole("button", { name: "Borrar aporte de $200.00" })
    .click();
  await expect(anaCard).toContainText("Tú: $0.00");
  await expect(betoCard).toContainText("Ana: $0.00", { timeout: 30000 });

  // Archivar la cajita la quita de las dos pantallas.
  await betoCard.getByRole("button", { name: "Editar Cancún" }).click();
  await beto.getByRole("button", { name: "Archivar cajita" }).click();
  await expect(anaShared.locator(".shared-card")).toHaveCount(0, {
    timeout: 30000,
  });
});
