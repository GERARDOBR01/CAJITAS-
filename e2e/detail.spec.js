import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

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

test("el detalle muestra ahorro, plan, estimación y movimientos", async ({
  page,
}) => {
  await open(page);
  await page
    .getByRole("button", { name: "Ver detalle de Viaje a Oaxaca" })
    .click();
  const view = detail(page);
  await expect(view.getByRole("heading", { level: 1 })).toHaveText(
    "Viaje a Oaxaca",
  );
  await expect(view.locator(".detail-amount")).toContainText("$6,200.00");
  await expect(view).toContainText("62% logrado");
  await expect(view).toContainText("Faltan $3,800.00");
  await expect(view.locator(".detail-plan")).toContainText("Planeas apartar");
  await expect(view.locator(".detail-estimate")).toContainText(
    "Llegarías a tu meta alrededor del",
  );
  await expect(view.locator(".detail-estimate")).toContainText(
    "no una promesa",
  );
  await expect(view.locator(".commitment-note")).toContainText(
    "El candado es de compromiso, no bancario.",
  );
  await expect(view.locator(".detail-movements li")).toHaveCount(4);
  await expect(view.locator(".detail-movements li").first()).toContainText(
    "+$2,500.00",
  );
  await expect(
    page.getByRole("navigation", { name: "Navegación de la app" }),
  ).toBeHidden();
});

test("Depositar y Retirar desde el detalle cambian el ahorro y regresan", async ({
  page,
}) => {
  await open(page);
  await page
    .getByRole("button", { name: "Ver detalle de Viaje a Oaxaca" })
    .click();
  await detail(page).getByRole("button", { name: "Depositar" }).click();
  await page.getByLabel("Monto (MXN)").fill("800");
  await page.getByRole("button", { name: /^Guardar/ }).click();
  await expect(detail(page).locator(".detail-amount")).toContainText(
    "$7,000.00",
  );
  await detail(page).getByRole("button", { name: "Retirar" }).click();
  await page.getByLabel("Monto (MXN)").fill("100");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: /^Retirar/ })
    .click();
  await expect(detail(page).locator(".detail-amount")).toContainText(
    "$6,900.00",
  );
  await page.getByRole("button", { name: "Volver a mis cajitas" }).click();
  await expect(
    page.getByRole("region", { name: "Inicio", exact: true }),
  ).toBeVisible();
  await expect(
    page.locator(".goal-card").first().locator(".saved"),
  ).toContainText("$6,900.00");
});

test("sin movimientos no inventa una fecha", async ({ page }) => {
  await open(page);
  await page
    .getByRole("button", { name: "Ver detalle de Cajita vacía" })
    .click();
  const view = page.getByRole("region", { name: "Detalle de Cajita vacía" });
  await expect(view.locator(".detail-plan")).toContainText(
    "Sin fecha objetivo: aporta lo que te acomode.",
  );
  await expect(view.locator(".detail-estimate")).toContainText(
    "Aún no hay una estimación",
  );
  await expect(view).toContainText("Aún no hay movimientos");
  await expect(view.getByRole("button", { name: "Retirar" })).toBeDisabled();
});

test("el botón atrás nativo regresa a Mis cajitas", async ({ page }) => {
  await open(page);
  await page
    .getByRole("button", { name: "Ver detalle de Viaje a Oaxaca" })
    .click();
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
    await page
      .getByRole("button", { name: "Ver detalle de Viaje a Oaxaca" })
      .click();
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
  await page
    .locator(".goal-card")
    .first()
    .getByRole("button", { name: "+ Registrar ahorro" })
    .click();
  const sheet = page.getByRole("dialog");
  await expect(
    sheet.getByRole("heading", { name: "Registrar ahorro" }),
  ).toBeVisible();
  await expect(sheet.getByRole("button", { name: /^Guardar/ })).toHaveText(
    "Guardar",
  );
  for (const key of ["1", "2", "5", ".", "5", "0", "9"])
    await sheet.getByRole("button", { name: key, exact: true }).click();
  await expect(page.getByLabel("Monto (MXN)")).toHaveValue("125.50");
  await sheet.getByRole("button", { name: "Borrar un dígito" }).click();
  await expect(page.getByLabel("Monto (MXN)")).toHaveValue("125.5");
  await expect(sheet.getByRole("button", { name: /^Guardar/ })).toContainText(
    "$125.50",
  );
  await sheet
    .getByLabel("¿A qué cajita va?")
    .selectOption({ label: "Cajita vacía" });
  await sheet.getByRole("button", { name: /^Guardar/ }).click();
  const saved = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("guardadito:v1")),
  );
  expect(saved.goals[0].entries).toHaveLength(4);
  expect(saved.goals[1].entries).toHaveLength(1);
  expect(saved.goals[1].entries[0].cents).toBe(12550);
});

test("la hoja de retiro no pasa de lo registrado y avisa", async ({ page }) => {
  await open(page);
  await page
    .locator(".goal-card")
    .first()
    .getByRole("button", { name: "Registrar retiro" })
    .click();
  await page.getByLabel("Monto (MXN)").fill("99999");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: /^Retirar/ })
    .click();
  await expect(page.getByRole("alert")).toContainText(
    "El retiro supera lo registrado",
  );
});

for (const theme of ["light", "dark"])
  test(`hoja de ahorro ${theme}: contraste AA y botones de 48 px`, async ({
    page,
  }) => {
    await open(page, theme);
    await page
      .locator(".goal-card")
      .first()
      .getByRole("button", { name: "+ Registrar ahorro" })
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
