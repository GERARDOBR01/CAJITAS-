import { test, expect } from "@playwright/test";
import { createGoal, home, more, pair, signUp } from "./helpers.js";

const contexts = [];
test.afterEach(async () => {
  await Promise.all(contexts.splice(0).map((c) => c.close()));
});

test("depositar a través del guardián: cuenta cuando él confirma", async ({
  browser,
}, info) => {
  const stamp = `${info.project.name}-${Date.now()}`;
  const open = async () => {
    const context = await browser.newContext({
      ...info.project.use,
      permissions:
        info.project.name === "android-chrome"
          ? ["clipboard-read", "clipboard-write"]
          : [],
    });
    contexts.push(context);
    return context.newPage();
  };
  const ana = await open(),
    beto = await open();

  // Ana tiene una cajita; Beto guardará su dinero.
  await ana.goto("/");
  await createGoal(ana, "Viaje", 1000);
  await signUp(ana, "Ana", `ana-d-${stamp}@guardadito.test`);
  await ana
    .getByRole("dialog", { name: "¿Subimos tus cajitas?" })
    .getByRole("button", { name: "Subir mis cajitas" })
    .click();
  await signUp(beto, "Beto", `beto-d-${stamp}@guardadito.test`);
  await pair(beto, ana, "Beto", "Ana");

  // Beto escribe su CLABE; la app revisa el dígito verificador.
  const form = beto.getByRole("form", {
    name: "Guardar el ahorro de tu pareja",
  });
  await form.getByLabel("Tu CLABE (18 números)").fill("002010077777777772");
  await form.getByRole("button", { name: "Guardar mi CLABE" }).click();
  await expect(form.getByRole("alert")).toContainText("Revisa la CLABE");
  await form.getByLabel("Tu CLABE (18 números)").fill("002 010 07777777777 1");
  await form.getByRole("button", { name: "Guardar mi CLABE" }).click();
  await expect(
    beto.getByRole("heading", { name: "Guardas el ahorro de Ana" }),
  ).toBeVisible();

  // Ana deposita por transferencia desde su cajita y ve los datos para copiar.
  await home(ana);
  await ana.getByRole("button", { name: "Ver detalle de Viaje" }).click();
  const card = ana.getByRole("region", { name: "Detalle de Viaje" });
  await card
    .getByRole("button", { name: "Depositar con Beto" })
    .click({ timeout: 30000 });
  await ana.getByLabel("Monto (MXN)").fill("200");
  await ana.getByRole("button", { name: "Ver a dónde mandarlo" }).click();
  const transfer = ana.getByRole("dialog", { name: "Manda $200.00 a Beto" });
  await expect(transfer).toContainText("002 010 07777777777 1");
  await expect(transfer).toContainText("Guardadito Viaje");
  if (info.project.name === "android-chrome") {
    await transfer.getByRole("button", { name: "Copiar" }).first().click();
    expect(await ana.evaluate(() => navigator.clipboard.readText())).toBe(
      "002010077777777771",
    );
  }
  await transfer.getByRole("button", { name: "Ya lo mandé" }).click();
  await expect(card).toContainText("En camino: $200.00");
  await expect(card.locator(".detail-amount")).toContainText("$0");

  // A Beto le llega el aviso en su inicio; primero dice «Aún no».
  await home(beto);
  const inbox = beto.getByRole("list", { name: "Por confirmar" });
  await expect(inbox).toContainText("Ana te mandó $200.00", {
    timeout: 30000,
  });
  await inbox.getByRole("button", { name: "Aún no" }).click();
  await expect(ana.locator(".toast")).toContainText("todavía no ve", {
    timeout: 30000,
  });
  await expect(card).not.toContainText("En camino");

  // Ana avisa otra vez, ahora en efectivo, y Beto confirma.
  await card.getByRole("button", { name: "Depositar con Beto" }).click();
  await ana.getByLabel("Monto (MXN)").fill("150");
  await ana.getByLabel("En efectivo, en persona").check();
  await ana.getByRole("button", { name: "Ya se lo di en persona" }).click();
  await expect(card).toContainText("En camino: $150.00");
  await inbox
    .getByRole("button", { name: "Sí me llegó" })
    .click({ timeout: 30000 });
  await expect(ana.locator(".toast")).toContainText(
    "Beto confirmó tu depósito: +$150.00",
    { timeout: 30000 },
  );
  await expect(card.locator(".detail-amount")).toContainText("$150");
  await expect(card).not.toContainText("En camino");
  // Beto ve el avance de Ana.
  await more(beto, "Ahorrar en pareja");
  await expect(
    beto.getByRole("list", { name: "Cajitas de Ana" }),
  ).toContainText("15 %", { timeout: 30000 });

  // Ana pide un retiro; no puede pedir más de lo que tiene.
  await card.getByRole("button", { name: "Pedir retiro a Beto" }).click();
  await ana.getByLabel("Monto (MXN)").fill("500");
  await ana
    .getByRole("dialog")
    .getByRole("button", { name: "Pedir retiro", exact: true })
    .click();
  await expect(ana.getByRole("dialog").getByRole("alert")).toContainText(
    "más de lo que tienes",
  );
  await ana.getByLabel("Monto (MXN)").fill("50");
  await ana
    .getByRole("dialog")
    .getByRole("button", { name: "Pedir retiro", exact: true })
    .click();
  await expect(card).toContainText("Pediste $50.00 a Beto");
  const betoInbox = beto.getByRole("list", { name: "Por confirmar" });
  await home(beto);
  await expect(betoInbox).toContainText("Ana te pide $50.00", {
    timeout: 30000,
  });
  await betoInbox.getByRole("button", { name: "Ya se lo mandé" }).click();
  await expect(card.locator(".detail-amount")).toContainText("$100", {
    timeout: 30000,
  });
  await expect(card).not.toContainText("Pediste");

  // En su historial queda como confirmado por su guardián.
  await more(ana, "Historial");
  await expect(ana.getByText("con tu guardián").first()).toBeVisible();
});
