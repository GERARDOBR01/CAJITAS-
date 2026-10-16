import { test, expect } from "@playwright/test";

const file = "tests/fixtures/local-receipt-plain.eml";
function fixture() {
  const date = new Date();
  date.setDate(date.getDate() + 30);
  return {
    version: 1,
    importedIds: [],
    assignments: {},
    goals: [
      {
        id: "live",
        name: "Mi viaje bonito",
        targetCents: 500000,
        unlockDate: date.toISOString().slice(0, 10),
        provider: "Nu",
        icon: "star",
        entries: [],
      },
    ],
  };
}
async function open(page, seed = fixture()) {
  await page.addInitScript(
    (data) => localStorage.setItem("guardadito:v1", JSON.stringify(data)),
    seed,
  );
  await page.route("**/api/status", (r) =>
    r.fulfill({
      json: {
        apiConfigured: true,
        gmailConfigured: false,
        gmailConnected: false,
        bitsoConfigured: false,
      },
    }),
  );
  await page.goto("/");
}
async function more(page, name) {
  await page.getByRole("button", { name: "Más", exact: true }).click();
  await page.getByRole("button", { name, exact: true }).click();
}
const saved = (page) =>
  page.evaluate(() => JSON.parse(localStorage.getItem("guardadito:v1")));
const review = (page) =>
  page.getByRole("region", { name: "Importar comprobante local" });
const confirm = (page) =>
  review(page)
    .getByLabel(
      "Revisé monto y fecha; este depósito ya ocurrió en mi app externa",
    )
    .check();

test("un archivo requiere revisión, se registra una vez y no guarda el contenido del correo", async ({
  page,
}) => {
  await open(page);
  await page
    .locator(".goal-card")
    .getByRole("button", { name: "+ Registrar ahorro" })
    .click();
  await page
    .getByRole("button", { name: "Usar un correo de depósito" })
    .click();
  await review(page).getByLabel("Archivo del correo").setInputFiles(file);
  await expect(
    review(page).getByLabel("Cajita para este comprobante"),
  ).toHaveValue("live");
  await expect(review(page).getByLabel("Monto revisado (MXN)")).toHaveValue(
    "1200.50",
  );
  expect((await saved(page)).goals[0].entries).toHaveLength(0);
  await review(page)
    .getByRole("button", { name: "Confirmar e importar depósito" })
    .click();
  expect((await saved(page)).goals[0].entries).toHaveLength(0);
  await confirm(page);
  await review(page)
    .getByRole("button", { name: "Confirmar e importar depósito" })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  const data = await saved(page);
  expect(data.goals[0].entries).toEqual([
    expect.objectContaining({ cents: 120050, source: "manual" }),
  ]);
  expect(data.importedIds[0]).toMatch(/^local-email:[a-f0-9]{64}$/);
  expect(JSON.stringify(data)).not.toMatch(
    /example.invalid|correo ficticio|Deposito recibido/,
  );
  await more(page, "Conexiones");
  await review(page).getByLabel("Archivo del correo").setInputFiles(file);
  await expect(review(page).getByRole("alert")).toContainText(
    "ya fue revisado",
  );
  expect((await saved(page)).goals[0].entries).toHaveLength(1);
});

test("en celular el texto pide fecha y permite vincular un registro archivado sin sumarlo", async ({
  page,
}) => {
  const seed = fixture();
  seed.goals.push({
    ...seed.goals[0],
    id: "archive",
    name: "Mi cajita anterior",
    archived: true,
    entries: [
      {
        id: "known",
        cents: 120050,
        at: "2026-10-01T18:00:00.000Z",
        source: "gmail",
      },
    ],
  });
  await open(page, seed);
  await more(page, "Conexiones");
  await review(page)
    .getByRole("button", { name: "Pegar texto del correo" })
    .click();
  await review(page)
    .getByLabel("Texto del comprobante")
    .fill("Depósito recibido: $1,200.50 MXN. Referencia privada ABCDEF.");
  await review(page).getByRole("button", { name: "Revisar texto" }).click();
  await review(page)
    .getByLabel("Cajita para este comprobante")
    .selectOption("live");
  await expect(review(page).getByLabel("Fecha real del depósito")).toHaveValue(
    "",
  );
  await review(page).getByLabel("Fecha real del depósito").fill("2026-10-01");
  await expect(
    review(page).getByText("Puede que ya lo hayas registrado."),
  ).toBeVisible();
  await review(page)
    .getByLabel("Este correo corresponde a")
    .selectOption(JSON.stringify(["archive", "known"]));
  await review(page)
    .getByLabel(
      "Revisé los datos y es el mismo depósito del movimiento seleccionado",
    )
    .check();
  await review(page)
    .getByRole("button", { name: "Vincular comprobante sin sumar" })
    .click();
  const data = await saved(page);
  expect(data.goals[0].entries).toHaveLength(0);
  expect(data.goals[1].entries).toEqual(seed.goals[1].entries);
  expect(data.importedIds).toHaveLength(1);
  expect(JSON.stringify(data)).not.toContain("ABCDEF");
});

test("otro depósito con coincidencias necesita confirmación adicional", async ({
  page,
}) => {
  const seed = fixture();
  seed.goals[0].entries = [
    {
      id: "known",
      cents: 120050,
      at: "2026-10-01T18:00:00.000Z",
      source: "manual",
    },
  ];
  await open(page, seed);
  await more(page, "Conexiones");
  await review(page).getByLabel("Archivo del correo").setInputFiles(file);
  await review(page)
    .getByLabel("Cajita para este comprobante")
    .selectOption("live");
  await review(page)
    .getByLabel("Este correo corresponde a")
    .selectOption("new");
  await confirm(page);
  await review(page)
    .getByRole("button", { name: "Confirmar e importar depósito" })
    .click();
  expect((await saved(page)).goals[0].entries).toHaveLength(1);
  await review(page)
    .getByLabel("Confirmo que es distinto a los movimientos sugeridos")
    .check();
  await review(page)
    .getByRole("button", { name: "Confirmar e importar depósito" })
    .click();
  expect((await saved(page)).goals[0].entries).toHaveLength(2);
});

test("el HTML del correo queda inerte y Gmail sin configurar permite la importación local", async ({
  page,
}) => {
  let remote = 0;
  await page.route("https://example.invalid/**", (r) => {
    remote++;
    return r.abort();
  });
  await open(page);
  await more(page, "Conexiones");
  await page.getByText("Gmail directo", { exact: false }).first().click();
  await expect(
    page.getByRole("button", { name: "Conectar Gmail ↗", exact: true }),
  ).toBeDisabled();
  await page.getByText("Gmail directo", { exact: false }).first().click();
  await page.evaluate(() => scrollTo(0, 0));
  await page.screenshot({
    path: "docs/screenshots/finish-01-correo-mobile.png",
    animations: "disabled",
  });
  await review(page)
    .getByLabel("Archivo del correo")
    .setInputFiles("tests/fixtures/local-receipt-html.eml");
  await review(page)
    .getByLabel("Cajita para este comprobante")
    .selectOption("live");
  await review(page).getByText("Ver texto leído", { exact: true }).click();
  await expect(review(page).locator(".mail-preview pre")).toContainText(
    "Monto recibido: $1,200.50",
  );
  expect(await page.evaluate(() => globalThis.mailExecuted)).toBeUndefined();
  expect(remote).toBe(0);
  expect(
    await review(page)
      .locator(".mail-preview img, .mail-preview script")
      .count(),
  ).toBe(0);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await review(page)
    .getByRole("heading", { name: "Revisar comprobante" })
    .scrollIntoViewIfNeeded();
  await page.screenshot({
    path: "docs/screenshots/finish-02-revision-mobile.png",
    animations: "disabled",
  });
});

test("el siguiente pasito prellena sin registrar y una fecha vencida propone editar", async ({
  page,
}) => {
  await open(page);
  await page.getByRole("button", { name: "Más", exact: true }).click();
  const next = page.getByRole("complementary", { name: "Tu siguiente pasito" });
  await expect(next).toContainText("Mi viaje bonito");
  await page.screenshot({
    path: "docs/screenshots/finish-03-pasito-mobile.png",
    animations: "disabled",
  });
  await next.getByRole("button", { name: "Registrar mi pasito" }).click();
  expect(
    Number(await page.getByLabel("Monto (MXN)").inputValue()),
  ).toBeGreaterThan(0);
  expect((await saved(page)).goals[0].entries).toHaveLength(0);
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Cerrar", exact: true })
    .click();
  // A separate navigation starts with the updated fixture, as a later app visit would.
  const expired = fixture();
  expired.goals[0].unlockDate = "2026-10-01";
  await page.addInitScript(
    (data) => localStorage.setItem("guardadito:v1", JSON.stringify(data)),
    expired,
  );
  await page.reload();
  await page.getByRole("button", { name: "Más", exact: true }).click();
  await next.getByRole("button", { name: "Revisar mi plan" }).click();
  await expect(
    page.getByRole("button", { name: "Guardar cambios" }),
  ).toBeVisible();
  expect((await saved(page)).goals[0].entries).toHaveLength(0);
});

test("si falla guardar un respaldo conserva los datos y la revisión abierta", async ({
  page,
}) => {
  await open(page);
  const before = await saved(page);
  await more(page, "Respaldo");
  const replacement = fixture();
  replacement.goals[0].name = "Otra instalación";
  await page.locator('input[type="file"]').setInputFiles({
    name: "respaldo.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(replacement)),
  });
  await expect(
    page.getByRole("dialog", { name: "Revisar respaldo" }),
  ).toBeVisible();
  await page.evaluate(() => {
    Storage.prototype.setItem = () => {
      throw new DOMException("Full", "QuotaExceededError");
    };
  });
  await page
    .getByRole("button", { name: "Reemplazar con este respaldo" })
    .click();
  await expect(
    page.getByRole("dialog", { name: "Revisar respaldo" }),
  ).toBeVisible();
  expect(await saved(page)).toEqual(before);
  await expect(
    page.getByRole("button", { name: "Reemplazar con este respaldo" }),
  ).toBeEnabled();
});
