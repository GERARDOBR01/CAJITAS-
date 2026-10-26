import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { journal, settings } from "./helpers.js";

const day = (n) => new Date(Date.now() - n * 86400000).toISOString();

function seed({ reminder = {}, entries, checkins } = {}) {
  return {
    version: 2,
    savedAt: 1,
    importedIds: [],
    assignments: {},
    checkins: checkins ?? [day(1).slice(0, 10)],
    preferences: {
      pet: "pig",
      petName: "Pipo",
      accessory: "leaf",
      animations: true,
      reminder: {
        enabled: true,
        frequency: "biweekly",
        day: 5,
        time: "09:00",
        since: day(40),
        ignored: 0,
        recent: [],
        ...reminder,
      },
    },
    goals: [
      {
        id: "g1",
        name: "Mi escapadita",
        targetCents: 300000,
        unlockDate: "2027-03-01",
        provider: "Nu",
        icon: "star",
        frequency: 15,
        entries: entries ?? [
          { id: "e1", cents: 50000, at: day(35), source: "manual" },
          { id: "e2", cents: 50000, at: day(25), source: "manual" },
        ],
      },
    ],
  };
}
async function open(page, data, colorScheme = "light") {
  await page.emulateMedia({ colorScheme });
  await page.addInitScript((raw) => {
    if (!sessionStorage.getItem("seeded")) {
      localStorage.setItem("guardadito:v1", raw);
      sessionStorage.setItem("seeded", "1");
    }
  }, JSON.stringify(data));
  await page.goto("/");
  return page.getByRole("region", { name: "Inicio", exact: true });
}
const mascot = (home) => home.locator(".hero-pet .mascot");

for (const theme of ["light", "dark"])
  test(`${theme}: la mascota espera la quincena y “Ahora no” no castiga`, async ({
    page,
  }) => {
    const home = await open(page, seed(), theme);
    await expect(mascot(home)).toHaveAttribute("data-mood", "waiting");
    await expect(home.getByText("¡Llegó tu ratito!")).toBeVisible();
    const axe = await new AxeBuilder({ page }).include(".hero").analyze();
    expect(
      axe.violations.map((v) => [v.id, v.nodes.map((n) => n.target)]),
    ).toEqual([]);
    const before = await journal(page);
    await home
      .locator(".hero-actions")
      .getByRole("button", { name: "Ahora no" })
      .click();
    await expect(page.getByRole("status")).toContainText("Aquí sigo");
    await expect(mascot(home)).toHaveAttribute("data-mood", "idle");
    const after = await journal(page);
    expect(after.checkins).toEqual(before.checkins);
    expect(after.goals.map((g) => g.entries)).toEqual(
      before.goals.map((g) => g.entries),
    );
    expect(after.preferences.reminder.frequency).toBe("biweekly");
  });

test("guardar desde el aviso: la mascota salta y deja de esperar", async ({
  page,
}) => {
  const home = await open(page, seed());
  await home.getByRole("button", { name: "Guardar dinero" }).click();
  const sheet = page.getByRole("dialog", { name: "Guardar dinero" });
  await sheet.getByLabel("Monto", { exact: true }).fill("500");
  await sheet.getByRole("button", { name: /^Guardar/ }).click();
  await expect(mascot(home)).toHaveAttribute("data-mood", "excited");
  await expect(mascot(home)).not.toHaveAttribute("data-mood", "excited", {
    timeout: 6000,
  });
  await expect(mascot(home)).not.toHaveAttribute("data-mood", "waiting");
  await expect(home.getByText("¡Llegó tu ratito!")).toHaveCount(0);
});

test("tocar, acariciar y el truco de cinco toques", async ({ page }) => {
  const home = await open(page, seed({ reminder: { enabled: false } }));
  const pet = home.getByRole("button", { name: "Acariciar a Pipo" });
  await pet.click();
  await expect(mascot(home)).toHaveAttribute("data-mood", "happy");
  await expect(home.locator(".hero-speech")).toContainText(
    "me haces cosquillas",
  );
  await pet.evaluate((button) => {
    for (let i = 0; i < 5; i++) button.click();
  });
  await expect(home.locator(".pet-motion.trick")).toHaveCount(1);
  await expect(home.locator(".hero-speech")).toContainText("truco secreto");
});

test("usar parte del ahorro antes de la fecha: la mascota sigue tranquila", async ({
  page,
}) => {
  const home = await open(page, seed({ reminder: { enabled: false } }));
  await page
    .getByRole("button", { name: "Ver detalle de Mi escapadita" })
    .click();
  await page.getByRole("button", { name: "Usé parte de este ahorro" }).click();
  const use = page.getByRole("dialog", { name: "Usé parte de mi ahorro" });
  await use.getByLabel("Monto", { exact: true }).fill("100");
  await use.getByRole("button", { name: /^Registrar/ }).click();
  await expect(page.locator(".toast")).toContainText("cumplir su propósito");
  await page.getByRole("button", { name: "Volver al inicio" }).click();
  await expect(mascot(home)).not.toHaveAttribute("data-mood", "sad");
  await expect(home.locator(".pet-tear")).toHaveCount(0);
});

test("de vuelta tras una semana: la mascota se alegra, sin culpa; el brote florece", async ({
  page,
}) => {
  const data = seed({
    reminder: { enabled: false },
    checkins: [day(9).slice(0, 10)],
    entries: [{ id: "e1", cents: 300000, at: day(9), source: "manual" }],
  });
  const home = await open(page, data);
  await expect(home.getByText("¡Qué gusto verte!")).toBeVisible();
  await expect(mascot(home)).toHaveAttribute("data-mood", "happy");
  await expect(mascot(home)).toHaveAttribute("data-stage", "4");
  await expect(home).not.toContainText(/extrañ|siesta/i);
  // Opening the app counted as company today.
  const today = new Date();
  const local = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  await expect
    .poll(async () => (await journal(page)).checkins)
    .toContain(local);
});

test("movimiento reducido: cambian las caras pero no hay animaciones", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  const home = await open(page, seed());
  await expect(mascot(home)).toHaveAttribute("data-mood", "waiting");
  const moving = await mascot(home).evaluate((svg) =>
    [svg, ...svg.querySelectorAll("*")].some(
      (node) => getComputedStyle(node).animationName !== "none",
    ),
  );
  expect(moving).toBe(false);
});

test("Recordatorio: quincenal con vista previa y sin horario nocturno", async ({
  page,
}) => {
  await open(page, seed({ reminder: { enabled: false } }));
  await settings(page, "Recordatorio");
  await page.getByLabel("Recordarme guardar").check();
  await page.getByRole("button", { name: "Cada quincena" }).click();
  await expect(page.getByText("Próximos:")).toBeVisible();
  await expect(page.getByLabel("Ejemplo de aviso")).toContainText("Pipo");
  await page.getByLabel("Hora").fill("23:00");
  await page.getByRole("button", { name: "Guardar", exact: true }).click();
  await expect(page.getByRole("status")).toContainText(
    "De noche no molestamos",
  );
  await page.getByLabel("Hora").fill("09:30");
  await page.getByRole("button", { name: "Guardar", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("te va a recordar");
  const saved = (await journal(page)).preferences.reminder;
  expect(saved).toMatchObject({
    enabled: true,
    frequency: "biweekly",
    time: "09:30",
  });
  expect(saved.since).toBeTruthy();
});
