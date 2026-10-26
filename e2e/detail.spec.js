import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { journal, typeAmount } from "./helpers.js";

const day = (n) => new Date(Date.now() - n * 86400000).toISOString();
const entry = (id, cents, ago, source = "manual") => ({
  id,
  cents,
  at: day(ago),
  source,
});
const seed = () => ({
  version: 2,
  savedAt: 1,
  importedIds: [],
  assignments: {},
  checkins: [day(1).slice(0, 10)],
  preferences: {
    pet: "otter",
    petName: "Nuri",
    accessory: "leaf",
    animations: true,
    reminder: {
      enabled: false,
      frequency: "biweekly",
      day: 5,
      time: "09:00",
      since: day(40),
      ignored: 0,
      recent: [],
    },
  },
  goals: [
    {
      id: "g1",
      name: "Viaje a Oaxaca",
      targetCents: 1000000,
      unlockDate: "2099-12-15",
      provider: "Nu",
      icon: "star",
      frequency: 7,
      entries: [
        entry("e1", 200000, 40),
        entry("e2", 200000, 26, "gmail"),
        entry("e3", -30000, 12),
        entry("e4", 250000, 2),
      ],
    },
    {
      id: "g2",
      name: "Cajita vacía",
      targetCents: 500000,
      unlockDate: null,
      provider: "Bitso",
      icon: "cloud",
      frequency: 15,
      entries: [],
    },
  ],
});
async function open(page, colorScheme = "light") {
  await page.emulateMedia({ colorScheme });
  await page.addInitScript((raw) => {
    if (!sessionStorage.getItem("seeded")) {
      localStorage.setItem("guardadito:v1", raw);
      sessionStorage.setItem("seeded", "1");
    }
  }, JSON.stringify(seed()));
  await page.goto("/");
}
const detail = (page) =>
  page.getByRole("region", { name: "Detalle de Viaje a Oaxaca" });
const openDetail = (page, name = "Viaje a Oaxaca") =>
  page.getByRole("button", { name: `Ver detalle de ${name}` }).click();

test("el detalle muestra ahorro, plan y movimientos, sin candado ni banco", async ({
  page,
}) => {
  await open(page);
  await openDetail(page);
  const view = detail(page);
  await expect(view.getByRole("heading", { level: 1 })).toHaveText(
    "Viaje a Oaxaca",
  );
  await expect(view.locator(".detail-amount")).toContainText("$6,200");
  await expect(view).toContainText("62 %");
  await expect(view).toContainText("Faltan $3,800");
  await expect(view.locator(".detail-plan")).toContainText("Tu pasito:");
  await expect(view.locator(".detail-plan")).toContainText("por semana");
  await expect(view.locator(".movement-list li")).toHaveCount(4);
  await expect(view.locator(".movement-list li").first()).toContainText(
    "+$2,500",
  );
  await expect(view).not.toContainText("candado");
  await expect(view.locator(".provider")).toHaveCount(0);
  await expect(view).not.toContainText(/\d\d:\d\d:\d\d/);
});

test("Guardar dinero y «Usé parte» desde el detalle cambian el ahorro", async ({
  page,
}) => {
  await open(page);
  await openDetail(page);
  await detail(page).getByRole("button", { name: "Guardar dinero" }).click();
  const sheet = page.getByRole("dialog", { name: "Guardar dinero" });
  await sheet.getByLabel("Monto", { exact: true }).fill("800");
  await sheet.getByRole("button", { name: /^Guardar \$/ }).click();
  await expect(detail(page).locator(".detail-amount")).toContainText("$7,000");
  await detail(page)
    .getByRole("button", { name: "Usé parte de este ahorro" })
    .click();
  const use = page.getByRole("dialog", { name: "Usé parte de mi ahorro" });
  await use.getByLabel("Monto", { exact: true }).fill("100");
  await use.getByRole("button", { name: /^Registrar/ }).click();
  await expect(detail(page).locator(".detail-amount")).toContainText("$6,900");
  await page.getByRole("button", { name: "Volver al inicio" }).click();
  await expect(
    page.getByRole("region", { name: "Inicio", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".cajita").first()).toContainText("$6,900");
});

test("una cajita sin fecha va sin prisa y sin movimientos no ofrece «Usé parte»", async ({
  page,
}) => {
  await open(page);
  await openDetail(page, "Cajita vacía");
  const view = page.getByRole("region", { name: "Detalle de Cajita vacía" });
  await expect(view.locator(".detail-plan")).toContainText("Sin prisa");
  await expect(view).toContainText("Aquí aparecerá cada pasito");
  await expect(
    view.getByRole("button", { name: "Usé parte de este ahorro" }),
  ).toHaveCount(0);
});

test("el ritmo se cambia ahí mismo y el pasito se recalcula", async ({
  page,
}) => {
  await open(page);
  await openDetail(page);
  const plan = detail(page).locator(".detail-plan");
  await plan.getByRole("button", { name: "Mes", exact: true }).click();
  await expect(plan).toContainText("por mes");
  expect((await journal(page)).goals[0].frequency).toBe(30);
});

test("el botón atrás nativo regresa a Mis cajitas", async ({ page }) => {
  await open(page);
  await openDetail(page);
  await page.evaluate(() => window.dispatchEvent(new Event("guardadito:back")));
  await expect(
    page.getByRole("region", { name: "Inicio", exact: true }),
  ).toBeVisible();
});

for (const theme of ["light", "dark"])
  test(`detalle ${theme}: contraste AA y botones de 48 px`, async ({
    page,
  }) => {
    await open(page, theme);
    await openDetail(page);
    await expect(detail(page)).toBeVisible();
    const axe = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa"])
      .analyze();
    expect(axe.violations.map((v) => v.id)).toEqual([]);
    const short = await page.evaluate(() =>
      [...document.querySelectorAll("button")]
        .filter(
          (el) =>
            el.checkVisibility() && el.getBoundingClientRect().height < 48,
        )
        .map((el) => el.getAttribute("aria-label") || el.textContent.trim()),
    );
    expect(short).toEqual([]);
  });

test("la hoja de ahorro: teclado, cambio de cajita y guardar", async ({
  page,
}) => {
  await open(page);
  await page.getByRole("button", { name: "Guardar en Viaje a Oaxaca" }).click();
  const sheet = page.getByRole("dialog", { name: "Guardar dinero" });
  await expect(sheet.getByRole("button", { name: /^Guardar/ })).toHaveText(
    "Guardar",
  );
  await typeAmount(sheet, "125.509");
  await expect(sheet.getByLabel("Monto", { exact: true })).toHaveValue(
    "125.50",
  );
  await sheet.getByRole("button", { name: "Borrar un dígito" }).click();
  await expect(sheet.getByLabel("Monto", { exact: true })).toHaveValue("125.5");
  await expect(sheet.getByRole("button", { name: /^Guardar/ })).toContainText(
    "$125.50",
  );
  await sheet.getByRole("radio", { name: /Cajita vacía/ }).click();
  await sheet.getByRole("button", { name: /^Guardar/ }).click();
  const saved = await journal(page);
  expect(saved.goals[0].entries).toHaveLength(4);
  expect(saved.goals[1].entries).toHaveLength(1);
  expect(saved.goals[1].entries[0].cents).toBe(12550);
});

test("los montos rápidos y «¿Fue otro día?»", async ({ page }) => {
  await open(page);
  await page.getByRole("button", { name: "Guardar en Viaje a Oaxaca" }).click();
  const sheet = page.getByRole("dialog", { name: "Guardar dinero" });
  await sheet.getByRole("button", { name: "$20", exact: true }).click();
  await expect(sheet.getByLabel("Monto", { exact: true })).toHaveValue("20");
  await sheet.getByRole("button", { name: "¿Fue otro día?" }).click();
  const yesterday = new Date(Date.now() - 86400000);
  const local = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, "0")}-${String(yesterday.getDate()).padStart(2, "0")}`;
  await sheet.getByLabel("¿Qué día fue?").fill(local);
  await sheet.getByRole("button", { name: /^Guardar \$/ }).click();
  const added = (await journal(page)).goals[0].entries.at(-1);
  expect(added.cents).toBe(2000);
  expect(new Date(added.at).getDate()).toBe(yesterday.getDate());
});

test("«Usé parte» no pasa de lo registrado y avisa", async ({ page }) => {
  await open(page);
  await openDetail(page);
  await detail(page)
    .getByRole("button", { name: "Usé parte de este ahorro" })
    .click();
  const use = page.getByRole("dialog", { name: "Usé parte de mi ahorro" });
  await use.getByLabel("Monto", { exact: true }).fill("99999");
  await use.getByRole("button", { name: /^Registrar/ }).click();
  await expect(use.getByRole("alert")).toContainText("Es más de lo que llevas");
});

for (const theme of ["light", "dark"])
  test(`hoja de ahorro ${theme}: contraste AA y botones de 48 px`, async ({
    page,
  }) => {
    await open(page, theme);
    await page
      .getByRole("button", { name: "Guardar dinero", exact: false })
      .first()
      .click();
    // The sheet fades in; measure contrast once it is fully opaque.
    await page
      .locator("dialog.sheet")
      .evaluate((el) => Promise.all(el.getAnimations().map((a) => a.finished)));
    const axe = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa"])
      .analyze();
    expect(axe.violations.map((v) => v.id)).toEqual([]);
    const short = await page.evaluate(() =>
      [...document.querySelectorAll("dialog button")]
        .filter(
          (el) =>
            el.checkVisibility() && el.getBoundingClientRect().height < 48,
        )
        .map((el) => el.getAttribute("aria-label") || el.textContent.trim()),
    );
    expect(short).toEqual([]);
  });
