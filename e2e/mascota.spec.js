import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

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
  await page.getByRole("button", { name: "Mi mascota", exact: true }).click();
}

test("elegir a Nuri y a Taro cambia el nombre y se guarda", async ({
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
  await expect(page.locator(".pet-garden h2")).toHaveText("Nuri");
  await page.getByRole("button", { name: "Bufanda" }).click();
  await page.getByRole("button", { name: "Guardar mi compañero" }).click();
  const saved = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("guardadito:v1")),
  );
  expect(saved.preferences).toMatchObject({
    pet: "otter",
    petName: "Nuri",
    accessory: "scarf",
  });
  await page.getByRole("button", { name: "Elegir Shiba" }).click();
  await expect(page.getByLabel("Su nombre")).toHaveValue("Taro");
});

test("el recordatorio se enciende con el interruptor", async ({ page }) => {
  await open(page);
  const toggle = page.getByLabel("Recordarme registrar mi ahorro");
  await expect(toggle).not.toBeChecked();
  await toggle.check();
  await expect(toggle).toBeChecked();
  await expect(page.getByLabel("Hora")).toBeEnabled();
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
