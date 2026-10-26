import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { journal, settings } from "./helpers.js";

const day = (n) => new Date(Date.now() - n * 86400000).toISOString();
const seed = () => ({
  version: 2,
  savedAt: 1,
  importedIds: [],
  assignments: {},
  checkins: [day(1).slice(0, 10)],
  preferences: {
    pet: "pig",
    petName: "Pipo",
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
      name: "Viaje",
      targetCents: 100000,
      unlockDate: "2099-12-15",
      provider: "Nu",
      icon: "star",
      frequency: 15,
      entries: [{ id: "e1", cents: 25000, at: day(5), source: "manual" }],
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
  await page.getByRole("button", { name: /^Mi mascota/ }).click();
}

test("elegir a Nuri y a Taro cambia el nombre y se guarda al momento", async ({
  page,
}) => {
  await open(page);
  const options = page.locator(".pet-options button");
  await expect(options).toContainText([
    "Cerdito",
    "Vaquita",
    "Shiba",
    "Nutria",
  ]);
  await page.getByRole("button", { name: "Elegir Nutria" }).click();
  await expect(page.getByLabel("Su nombre")).toHaveValue("Nuri");
  await expect(page.locator(".pet-stage h1")).toHaveText("Nuri");
  await page.getByRole("button", { name: "Bufanda" }).click();
  expect((await journal(page)).preferences).toMatchObject({
    pet: "otter",
    petName: "Nuri",
    accessory: "scarf",
  });
  await page.getByRole("button", { name: "Elegir Shiba" }).click();
  await expect(page.getByLabel("Su nombre")).toHaveValue("Taro");
  // A name the person chose stays when changing the pet.
  await page.getByLabel("Su nombre").fill("Bolita");
  await page.getByLabel("Su nombre").press("Enter");
  await page.getByRole("button", { name: "Elegir Conejito" }).click();
  await expect(page.getByLabel("Su nombre")).toHaveValue("Bolita");
  expect((await journal(page)).preferences).toMatchObject({
    pet: "bunny",
    petName: "Bolita",
  });
});

test("los logros cuentan semanas con ahorro, nunca rachas que se rompen", async ({
  page,
}) => {
  await open(page);
  await expect(page.locator(".pet-weeks")).toContainText(
    "1 semana en que guardaste",
  );
  await expect(page.getByText("Tu primer pasito")).toBeVisible();
  await expect(page.getByText(/racha/i)).toHaveCount(0);
});

test("el recordatorio se enciende con el interruptor y se guarda", async ({
  page,
}) => {
  await page.goto("/");
  await settings(page, "Recordatorio");
  const toggle = page.getByLabel("Recordarme guardar");
  await expect(toggle).not.toBeChecked();
  await toggle.check();
  await expect(page.getByLabel("Hora")).toBeEnabled();
  await page.getByRole("button", { name: "Guardar", exact: true }).click();
  expect((await journal(page)).preferences.reminder.enabled).toBe(true);
});

for (const theme of ["light", "dark"])
  test(`Mi mascota ${theme}: contraste AA y botones de 48 px`, async ({
    page,
  }) => {
    await open(page, theme);
    await page.getByRole("button", { name: "Elegir Nutria" }).click();
    const axe = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa"])
      .analyze();
    expect(axe.violations.map((v) => v.id)).toEqual([]);
    const short = await page.evaluate(() =>
      [...document.querySelectorAll(".pet-room button")]
        .filter(
          (el) =>
            el.checkVisibility() && el.getBoundingClientRect().height < 48,
        )
        .map((el) => el.getAttribute("aria-label") || el.textContent.trim()),
    );
    expect(short).toEqual([]);
  });
