import { test, expect } from "@playwright/test";
import { createGoal, home, journal as saved, settings } from "./helpers.js";

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
  await settings(page, "Conexiones");
  await page.getByRole("button", { name: "Buscar depósitos" }).click();
}
async function dismiss(page) {
  const close = page.getByRole("button", { name: "Cerrar aviso", exact: true });
  if (await close.isVisible()) await close.click();
}
const local = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

test("el pasito se ve antes de crear y los montos rápidos requieren guardar", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Crear mi primera cajita" }).click();
  const form = page.getByRole("dialog", { name: "Nueva cajita" });
  await form.getByLabel("¿Para qué es?").fill("Mi fondo bonito");
  await form.getByLabel("¿Cuánto quieres juntar?").fill("1000");
  await form.getByRole("button", { name: "3 meses" }).click();
  await form.getByRole("button", { name: "Cada quincena" }).click();
  // Same dates as the reminders: the 15th and the last day of the month.
  await expect(form.locator(".plan-line")).toContainText(
    /Serían \$[\d,]+ por quincena/,
  );
  const step = (await form.locator(".plan-line strong").innerText())
    .match(/\$([\d,.]+)/)[1]
    .replace(",", "");
  // Rounded up to $10: easier to set aside.
  expect(Number(step) % 10).toBe(0);
  await form.getByRole("button", { name: "Crear cajita" }).click();
  await page
    .getByRole("button", { name: "Guardar en Mi fondo bonito" })
    .click();
  const sheet = page.getByRole("dialog", { name: "Guardar dinero" });
  await sheet.getByRole("button", { name: /^Mi pasito/ }).click();
  await expect(sheet.getByLabel("Monto", { exact: true })).toHaveValue(
    `${step}.00`,
  );
  expect((await saved(page)).goals[0].entries).toHaveLength(0);
  await sheet.getByRole("button", { name: "$100", exact: true }).click();
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  await sheet.getByRole("button", { name: "¿Fue otro día?" }).click();
  await sheet.getByLabel("¿Qué día fue?").fill(local(yesterday));
  await sheet.getByRole("button", { name: /^Guardar \$/ }).click();
  await expect(page.locator(".cajita")).toContainText("$100");
  const entry = (await saved(page)).goals[0].entries[0];
  expect(entry.cents).toBe(10000);
  expect(entry.at.slice(0, 10)).toBe(local(yesterday));
});

test("una cajita sin prisa se crea, se guarda como null y se ahorra a tu ritmo", async ({
  page,
}) => {
  await page.goto("/");
  await createGoal(page, {
    name: "Mi colchoncito",
    amount: 3000,
    when: "Sin prisa",
  });
  const card = page.locator(".cajita");
  await expect(card).toContainText("Sin prisa");
  await page
    .getByRole("button", { name: "Ver detalle de Mi colchoncito" })
    .click();
  await expect(page.locator(".detail-plan")).toContainText(
    "guarda lo que puedas",
  );
  await page.getByRole("button", { name: "Volver al inicio" }).click();
  expect((await saved(page)).goals[0].unlockDate).toBeNull();
  await page.getByRole("button", { name: "Guardar dinero" }).click();
  const sheet = page.getByRole("dialog", { name: "Guardar dinero" });
  await expect(sheet.getByLabel("Monto", { exact: true })).toHaveValue("");
  await expect(sheet.getByRole("button", { name: /^Mi pasito/ })).toHaveCount(
    0,
  );
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

test("corregir y eliminar errores conserva saldo válido; la papelera lo devuelve igual", async ({
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
  const card = page.locator(".cajita").filter({ hasText: "Mi guardadito" });
  await expect(card).toContainText("$500");
  await settings(page, "Historial");
  const history = page.locator(".history");
  await history
    .locator("li")
    .filter({ hasText: "+$600" })
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
  await page.getByRole("button", { name: "Guardar corrección" }).click();
  await expect(history).toContainText("+$700");
  await history
    .locator("li")
    .filter({ hasText: "-$100" })
    .getByRole("button", { name: /Corregir registro/ })
    .click();
  await page
    .getByRole("button", { name: "Eliminar registro equivocado" })
    .click();
  await page.getByRole("button", { name: "Sí, eliminar registro" }).click();
  await dismiss(page);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: /Descargar en Excel/ }).click();
  const download = await downloadPromise;
  const { readFile } = await import("node:fs/promises");
  const csv = await readFile(await download.path(), "utf8");
  expect(csv).toContain("700.00");
  // What was deleted waits in the trash and comes back as it was.
  await page.getByText("Papelera (1)").click();
  const trash = page.locator(".history-trash");
  await expect(trash).toContainText("-$100");
  await trash.getByRole("button", { name: "Restaurar" }).click();
  await expect(page.getByText("Papelera")).toHaveCount(0);
  expect((await saved(page)).trash).toBeUndefined();
  await home(page);
  await expect(card).toContainText("$600");
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
  await page.getByRole("button", { name: "Guardar en Mi guardadito" }).click();
  await page.getByLabel("Monto", { exact: true }).fill("100");
  const second = await context.newPage();
  await second.goto("/");
  await second
    .getByRole("button", { name: "Ver detalle de Mi guardadito" })
    .click();
  await second.getByRole("button", { name: "Editar Mi guardadito" }).click();
  await second.getByLabel("¿Para qué es?").fill("Nuestro guardadito");
  await second.getByRole("button", { name: "Guardar cambios" }).click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await expect(page.locator(".cajita")).toContainText("Nuestro guardadito");
  expect((await saved(page)).goals[0].entries).toHaveLength(1);
  await second.close();
});

test("usar parte del ahorro nunca entristece ni pide confirmar, antes o después de la fecha", async ({
  page,
}) => {
  const data = fixture();
  data.goals.pop();
  const daysAgo = (days) => {
    const d = new Date();
    d.setDate(d.getDate() - days);
    return d;
  };
  data.goals[0].unlockDate = local(daysAgo(1));
  const deposit = daysAgo(3);
  deposit.setHours(10, 0, 0, 0);
  data.goals[0].entries[0].at = deposit.toISOString();
  await page.addInitScript(
    (seed) => localStorage.setItem("guardadito:v1", JSON.stringify(seed)),
    data,
  );
  await page.goto("/");
  await page
    .getByRole("button", { name: "Ver detalle de Mi guardadito" })
    .click();
  await expect(page.locator(".past-due")).toContainText("más tiempo");
  const use = page.getByRole("dialog", { name: "Usé parte de mi ahorro" });
  await page.getByRole("button", { name: "Usé parte de este ahorro" }).click();
  await use.getByLabel("Monto", { exact: true }).fill("50");
  await use.getByRole("button", { name: /^Registrar/ }).click();
  await expect(use).not.toBeVisible();
  await expect(page.locator('[data-mood="sad"]')).toHaveCount(0);
  await page.getByRole("button", { name: "Usé parte de este ahorro" }).click();
  await use.getByLabel("Monto", { exact: true }).fill("25");
  await use.getByRole("button", { name: "¿Fue otro día?" }).click();
  await use.getByLabel("¿Qué día fue?").fill(local(daysAgo(2)));
  await use.getByRole("button", { name: /^Registrar/ }).click();
  await expect(use).not.toBeVisible();
  await expect(page.locator(".detail-amount")).toContainText("$175");
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
  await settings(page, "Conexiones");
  await page.getByRole("button", { name: "Buscar depósitos" }).click();
  await expect.poll(() => requested).toBe(true);
  const second = await context.newPage();
  await second.goto("/");
  await second
    .getByRole("button", { name: "Ver detalle de Mi guardadito" })
    .click();
  await second.getByRole("button", { name: "Editar Mi guardadito" }).click();
  await second.getByLabel("¿Para qué es?").fill("Nombre más reciente");
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
