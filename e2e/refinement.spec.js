import { test, expect } from "@playwright/test";

function fixture() {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const at = new Date(yesterday.setHours(10, 0, 0, 0)).toISOString();
  const date = new Date();
  date.setDate(date.getDate() + 30);
  const local = (d) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  return {
    version: 1,
    importedIds: [],
    assignments: { "nu-deposit-v1": "live" },
    goals: [
      {
        id: "live",
        name: "Mi guardadito",
        targetCents: 100000,
        unlockDate: local(date),
        provider: "Nu",
        icon: "star",
        entries: [{ id: "manual", cents: 25000, at, source: "manual" }],
      },
      {
        id: "archive",
        name: "Viaje archivado",
        targetCents: 100000,
        unlockDate: local(date),
        provider: "Nu",
        icon: "cloud",
        archived: true,
        entries: [
          { id: "archived-manual", cents: 25000, at, source: "manual" },
        ],
      },
    ],
  };
}
async function mockReceipt(page, data) {
  await page.addInitScript(
    (seed) => localStorage.setItem("guardadito:v1", JSON.stringify(seed)),
    data,
  );
  await page.route("**/api/status", (r) =>
    r.fulfill({
      json: {
        gmailConnected: true,
        gmailConfigured: true,
        bitsoConfigured: false,
      },
    }),
  );
  await page.route("**/api/gmail/sync", (r) =>
    r.fulfill({
      json: {
        receipts: [
          {
            id: "receipt",
            provider: "Nu",
            patternId: "nu-deposit-v1",
            validated: true,
            amountCents: 25000,
            at: data.goals[0].entries[0].at,
          },
        ],
        ignored: 0,
        nextPageToken: null,
      },
    }),
  );
  await page.goto("/");
  await page.getByRole("button", { name: "Más", exact: true }).click();
  await page.getByRole("button", { name: "Conexiones", exact: true }).click();
  await page.getByRole("button", { name: "Buscar depósitos" }).click();
}
async function saved(page) {
  return page.evaluate(() => JSON.parse(localStorage.getItem("guardadito:v1")));
}
async function dismiss(page) {
  const close = page.getByRole("button", { name: "Cerrar aviso", exact: true });
  if (await close.isVisible()) await close.click();
}
test("el plan se ve antes de crear y los montos rápidos requieren registrar el depósito", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByRole("button", { name: "+ Nueva cajita", exact: true })
    .click();
  await page.getByLabel("Nombre de tu meta").fill("Mi fondo bonito");
  await page.getByLabel("¿Cuánto quieres ahorrar? (MXN)").fill("1000");
  await page.getByLabel("Mi ritmo de ahorro").selectOption("15");
  // Same dates as the reminders: the 15th and the last day of the month.
  // How many fall in the default 30 days depends on today.
  await expect(page.locator(".plan-preview")).toContainText(
    /\$[\d,.]+ por quincena \(15 y fin de mes\)/,
  );
  const step = (await page.locator(".plan-preview strong").innerText())
    .match(/\$([\d,.]+)/)[1]
    .replace(",", "");
  await page.screenshot({ path: "docs/screenshots/v3-01-plan-mobile.png" });
  await page.getByRole("button", { name: "Crear cajita", exact: true }).click();
  const card = page.locator(".goal-card");
  await expect(card).toContainText("Te faltan $1,000.00");
  await card.getByRole("button", { name: "+ Registrar ahorro" }).click();
  await page
    .getByRole("button", { name: "Mi siguiente pasito", exact: true })
    .click();
  await expect(page.getByLabel("Monto (MXN)")).toHaveValue(step);
  expect((await saved(page)).goals[0].entries).toHaveLength(0);
  await page.getByRole("button", { name: "$100.00", exact: true }).click();
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const date = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, "0")}-${String(yesterday.getDate()).padStart(2, "0")}`;
  await page.getByLabel("Fecha del movimiento").fill(date);
  await page.getByRole("button", { name: /^Guardar/ }).click();
  await expect(card).toContainText("Te faltan $900.00");
  const entry = (await saved(page)).goals[0].entries[0];
  expect(entry.cents).toBe(10000);
  expect(entry.at.slice(0, 10)).toBe(date);
});
test("una meta sin fecha se crea, se guarda como null y se ahorra a tu ritmo", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByRole("button", { name: "+ Nueva cajita", exact: true })
    .click();
  await page.getByLabel("Nombre de tu meta").fill("Mi colchoncito");
  await page.getByLabel("¿Cuánto quieres ahorrar? (MXN)").fill("3000");
  await page.getByLabel("Sin fecha").check();
  await expect(page.getByLabel("Fecha objetivo")).toBeDisabled();
  await expect(page.locator(".plan-preview")).toContainText(
    "Sin fecha objetivo",
  );
  await page.getByRole("button", { name: "Crear cajita", exact: true }).click();
  const card = page.locator(".goal-card");
  await expect(card).toContainText("Sin fecha objetivo");
  await card
    .getByRole("button", { name: "Ver detalle de Mi colchoncito" })
    .click();
  await expect(page.locator(".detail-plan")).toContainText(
    "Sin fecha objetivo: aporta lo que te acomode.",
  );
  await page.getByRole("button", { name: "Volver a mis cajitas" }).click();
  expect((await saved(page)).goals[0].unlockDate).toBeNull();
  const next = page.getByRole("complementary", { name: "Tu siguiente pasito" });
  await next.getByRole("button", { name: "Registrar mi pasito" }).click();
  await expect(page.getByLabel("Monto (MXN)")).toHaveValue("");
  await expect(
    page.getByRole("button", { name: "Mi siguiente pasito", exact: true }),
  ).toHaveCount(0);
});
test("un correo validado con coincidencias requiere elección y puede vincular una cajita archivada sin sumar dinero", async ({
  page,
}) => {
  await mockReceipt(page, fixture());
  await expect(
    page.getByText("Puede que ya lo hayas registrado."),
  ).toBeVisible();
  await expect(page.getByLabel("¿Ya lo registraste?")).toHaveValue("");
  await page
    .getByRole("button", { name: "Vincular al registro existente" })
    .click();
  expect((await saved(page)).goals.flatMap((g) => g.entries)).toHaveLength(2);
  await page
    .getByLabel("¿Ya lo registraste?")
    .selectOption(JSON.stringify(["archive", "archived-manual"]));
  await dismiss(page);
  await page.locator(".receipt-match").scrollIntoViewIfNeeded();
  await page.screenshot({ path: "docs/screenshots/v3-02-correo-mobile.png" });
  await page
    .getByRole("button", { name: "Vincular al registro existente" })
    .click();
  const next = await saved(page);
  expect(next.goals[1].entries[0]).toMatchObject({
    id: "archived-manual",
    cents: 25000,
    source: "gmail",
  });
  expect(next.goals[0].entries[0].source).toBe("manual");
  expect(next.importedIds).toEqual(["receipt"]);
  expect(
    next.goals.flatMap((g) => g.entries).reduce((s, e) => s + e.cents, 0),
  ).toBe(50000);
  await page.getByRole("button", { name: "Buscar depósitos" }).click();
  await expect(page.locator(".receipt-match")).toHaveCount(0);
});
test("otro depósito del mismo monto necesita confirmación explícita y sigue deduplicado por correo", async ({
  page,
}) => {
  const data = fixture();
  data.goals.pop();
  await mockReceipt(page, data);
  await page.getByLabel("¿Ya lo registraste?").selectOption("new");
  await page
    .getByRole("button", { name: "Confirmar depósito", exact: true })
    .click();
  expect((await saved(page)).goals[0].entries).toHaveLength(1);
  await page
    .getByLabel(
      "Confirmo que es un depósito distinto a los registros sugeridos",
    )
    .check();
  await page
    .getByRole("button", { name: "Confirmar depósito", exact: true })
    .click();
  expect((await saved(page)).goals[0].entries).toHaveLength(2);
  await page.getByRole("button", { name: "Buscar depósitos" }).click();
  expect((await saved(page)).goals[0].entries).toHaveLength(2);
});
test("corregir y eliminar errores conserva saldo histórico válido; gráfico y exportación respetan la cajita", async ({
  page,
}) => {
  const data = fixture();
  const goal = data.goals[0];
  goal.entries[0].cents = 60000;
  goal.entries.push({
    id: "withdraw",
    cents: -10000,
    at: new Date(Date.parse(goal.entries[0].at) + 3600000).toISOString(),
    source: "manual",
  });
  await page.addInitScript(
    (seed) => localStorage.setItem("guardadito:v1", JSON.stringify(seed)),
    data,
  );
  await page.goto("/");
  await page.getByRole("button", { name: "Actividad", exact: true }).click();
  await page
    .getByRole("combobox", { name: "Cajita", exact: true })
    .selectOption("live");
  await expect(page.locator(".chart-heading")).toContainText("$500.00");
  await expect(page.locator(".activity-feed")).not.toContainText(
    "Viaje archivado",
  );
  await page
    .locator(".activity-feed li")
    .filter({ hasText: "+$600.00" })
    .getByRole("button", { name: /Corregir registro/ })
    .click();
  await page.getByLabel("Monto corregido (MXN)").fill("50");
  await page.getByRole("button", { name: "Guardar corrección" }).click();
  await expect(page.getByRole("alert")).toContainText("saldo");
  expect((await saved(page)).goals[0].entries[0].cents).toBe(60000);
  await page
    .getByRole("button", { name: "Eliminar registro equivocado" })
    .click();
  await page.getByRole("button", { name: "Sí, eliminar registro" }).click();
  await expect(page.getByRole("alert")).toContainText("saldo");
  await page.getByRole("button", { name: "Volver a corregir" }).click();
  await page.getByLabel("Monto corregido (MXN)").fill("700");
  await page.screenshot({
    path: "docs/screenshots/v3-03-correccion-mobile.png",
  });
  await page.getByRole("button", { name: "Guardar corrección" }).click();
  await expect(page.locator(".chart-heading")).toContainText("$600.00");
  await page
    .locator(".activity-feed li")
    .filter({ hasText: "-$100.00" })
    .getByRole("button", { name: /Corregir registro/ })
    .click();
  await page
    .getByRole("button", { name: "Eliminar registro equivocado" })
    .click();
  await page.getByRole("button", { name: "Sí, eliminar registro" }).click();
  await expect(page.locator(".chart-heading")).toContainText("$700.00");
  await dismiss(page);
  await page.screenshot({
    path: "docs/screenshots/v3-04-actividad-mobile.png",
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "↓ Exportar CSV" }).click();
  const download = await downloadPromise;
  const path = await download.path();
  const { readFile } = await import("node:fs/promises");
  const csv = await readFile(path, "utf8");
  expect(csv).toContain("700.00");
  expect(csv).not.toContain("Viaje archivado");
  // Lo borrado espera en la papelera y vuelve igual.
  await page.getByText("🗑 Papelera (1)").click();
  const trash = page.getByRole("list", { name: "Papelera" });
  await expect(trash).toContainText("-$100.00");
  await trash.getByRole("button", { name: "Restaurar" }).click();
  await expect(page.locator(".chart-heading")).toContainText("$600.00");
  await expect(page.getByText("🗑 Papelera")).toHaveCount(0);
  expect((await saved(page)).trash).toBeUndefined();
});
test("una segunda pestaña actualiza la vista y cierra una captura que quedó desactualizada", async ({
  page,
  context,
}) => {
  const data = fixture();
  data.goals.pop();
  await page.addInitScript(
    (seed) => localStorage.setItem("guardadito:v1", JSON.stringify(seed)),
    data,
  );
  await page.goto("/");
  await page
    .locator(".goal-card")
    .getByRole("button", { name: "+ Registrar ahorro" })
    .click();
  await page.getByLabel("Monto (MXN)").fill("100");
  const second = await context.newPage();
  await second.goto("/");
  await second.getByRole("button", { name: "Editar Mi guardadito" }).click();
  await second.getByLabel("Nombre de tu meta").fill("Nuestro guardadito");
  await second.getByRole("button", { name: "Guardar cambios" }).click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await expect(page.locator(".goal-card")).toContainText("Nuestro guardadito");
  expect((await saved(page)).goals[0].entries).toHaveLength(1);
  await second.close();
});
test("ningún retiro entristece ni pide confirmar, antes o después de la fecha", async ({
  page,
}) => {
  const data = fixture();
  data.goals.pop();
  const daysAgo = (days) => {
    const d = new Date();
    d.setDate(d.getDate() - days);
    return d;
  };
  const local = (d) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  data.goals[0].unlockDate = local(daysAgo(1));
  const deposit = daysAgo(3);
  deposit.setHours(10, 0, 0, 0);
  data.goals[0].entries[0].at = deposit.toISOString();
  await page.addInitScript(
    (seed) => localStorage.setItem("guardadito:v1", JSON.stringify(seed)),
    data,
  );
  await page.goto("/");
  const card = page.locator(".goal-card");
  await card
    .getByRole("button", { name: "Registrar retiro", exact: true })
    .click();
  await page.getByLabel("Monto (MXN)").fill("50");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: /^Retirar/ })
    .click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await expect(page.locator('[data-mood="sad"]')).toHaveCount(0);
  await card
    .getByRole("button", { name: "Registrar retiro", exact: true })
    .click();
  await page.getByLabel("Monto (MXN)").fill("25");
  await page.getByLabel("Fecha del movimiento").fill(local(daysAgo(2)));
  await page
    .getByRole("dialog")
    .getByRole("button", { name: /^Retirar/ })
    .click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await expect(card.locator(".saved")).toContainText("$175.00");
  await expect(page.locator('[data-mood="sad"]')).toHaveCount(0);
  await expect(page.locator(".toast")).toContainText("cumplir su propósito");
});
test("Gmail lento no sobrescribe cambios más recientes de otra pestaña", async ({
  page,
  context,
}) => {
  const data = fixture();
  data.goals.pop();
  data.goals[0].entries = [];
  let release;
  const pending = new Promise((resolve) => {
    release = resolve;
  });
  let requested = false;
  await page.addInitScript(
    (seed) => localStorage.setItem("guardadito:v1", JSON.stringify(seed)),
    data,
  );
  await page.route("**/api/status", (r) =>
    r.fulfill({ json: { gmailConnected: true, gmailConfigured: true } }),
  );
  await page.route("**/api/gmail/sync", async (r) => {
    requested = true;
    await pending;
    await r.fulfill({
      json: {
        receipts: [
          {
            id: "slow",
            provider: "Nu",
            patternId: "nu-deposit-v1",
            validated: true,
            amountCents: 25000,
            at: new Date().toISOString(),
          },
        ],
        ignored: 0,
        nextPageToken: null,
      },
    });
  });
  await page.goto("/");
  await page.getByRole("button", { name: "Más", exact: true }).click();
  await page.getByRole("button", { name: "Conexiones", exact: true }).click();
  await page.getByRole("button", { name: "Buscar depósitos" }).click();
  await expect.poll(() => requested).toBe(true);
  const second = await context.newPage();
  await second.goto("/");
  await second.getByRole("button", { name: "Editar Mi guardadito" }).click();
  await second.getByLabel("Nombre de tu meta").fill("Nombre más reciente");
  await second.getByRole("button", { name: "Guardar cambios" }).click();
  release();
  await expect(
    page.getByRole("button", { name: "Buscar depósitos" }),
  ).toBeEnabled();
  const next = await saved(page);
  expect(next.goals[0].name).toBe("Nombre más reciente");
  expect(next.goals[0].entries).toHaveLength(0);
  expect(next.importedIds).toHaveLength(0);
  await expect(
    page.getByRole("button", { name: "Confirmar depósito", exact: true }),
  ).toBeVisible();
  await second.close();
});
