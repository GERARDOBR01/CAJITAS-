import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const day = (n) => new Date(Date.now() - n * 86400000).toISOString();
const shots = "docs/screenshots/v07";

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
const mascot = (home) => home.locator(".home-mascot .mascot");

for (const theme of ["light", "dark"])
  test(`${theme}: la mascota espera la quincena y “Ahora no” no castiga`, async ({
    page,
  }) => {
    const home = await open(page, seed(), theme);
    await expect(mascot(home)).toHaveAttribute("data-mood", "waiting");
    await expect(home.getByText("¡Llegó tu ratito de ahorro!")).toBeVisible();
    const axe = await new AxeBuilder({ page })
      .include(".home-greeting")
      .analyze();
    expect(
      axe.violations.map((v) => [v.id, v.nodes.map((n) => n.target)]),
    ).toEqual([]);
    await page.screenshot({ path: `${shots}/waiting-${theme}.png` });
    const before = await page.evaluate(() =>
      JSON.parse(localStorage.getItem("guardadito:v1")),
    );
    await home.getByRole("button", { name: "Ahora no" }).click();
    await expect(page.getByRole("status")).toContainText("Aquí sigo");
    await expect(mascot(home)).toHaveAttribute("data-mood", "idle");
    const after = await page.evaluate(() =>
      JSON.parse(localStorage.getItem("guardadito:v1")),
    );
    expect(after.checkins).toEqual(before.checkins);
    expect(after.goals.map((g) => g.entries)).toEqual(
      before.goals.map((g) => g.entries),
    );
    expect(after.preferences.reminder.frequency).toBe("biweekly");
  });

test("registrar desde el aviso: la mascota salta y deja de esperar", async ({
  page,
}) => {
  const home = await open(page, seed());
  await home.getByRole("button", { name: "Registrar lo que aparté" }).click();
  await page.getByLabel("Monto (MXN)").fill("500");
  await page
    .getByRole("button", { name: "Registrar ahorro", exact: true })
    .click();
  await expect(mascot(home)).toHaveAttribute("data-mood", "excited");
  await page.screenshot({ path: `${shots}/excited.png` });
  await expect(mascot(home)).not.toHaveAttribute("data-mood", "excited", {
    timeout: 6000,
  });
  await expect(mascot(home)).not.toHaveAttribute("data-mood", "waiting");
  await expect(home.getByText("¡Llegó tu ratito de ahorro!")).toHaveCount(0);
});

test("tocar, acariciar y el truco de cinco toques", async ({ page }) => {
  const home = await open(page, seed({ reminder: { enabled: false } }));
  const pet = home.getByRole("button", { name: "Acariciar a Pipo" });
  await pet.click();
  await expect(mascot(home)).toHaveAttribute("data-mood", "happy");
  await expect(home.locator(".home-speech")).toContainText(
    "me haces cosquillas",
  );
  await page.screenshot({ path: `${shots}/happy.png` });
  await pet.evaluate((button) => {
    for (let i = 0; i < 5; i++) button.click();
  });
  await expect(home.locator(".pet-motion.trick")).toHaveCount(1);
  await expect(home.locator(".home-speech")).toContainText("truco secreto");
});

test("retiro antes de la fecha: la mascota sigue tranquila", async ({
  page,
}) => {
  const home = await open(page, seed({ reminder: { enabled: false } }));
  await home.getByRole("button", { name: "Registrar retiro" }).click();
  await page.getByLabel("Monto (MXN)").fill("100");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Registrar retiro", exact: true })
    .click();
  await expect(page.locator(".toast")).toContainText("cumplir su propósito");
  await expect(mascot(home)).not.toHaveAttribute("data-mood", "sad");
  await expect(home.locator(".pet-tear")).toHaveCount(0);
});

test("una semana sin visitas: siesta; el brote crece hasta florecer", async ({
  page,
}) => {
  const data = seed({
    reminder: { enabled: false },
    checkins: [day(9).slice(0, 10)],
    entries: [{ id: "e1", cents: 300000, at: day(9), source: "manual" }],
  });
  const home = await open(page, data);
  await expect(mascot(home)).toHaveAttribute("data-mood", "sleepy");
  await expect(mascot(home)).toHaveAttribute("data-stage", "4");
  await expect(home.locator(".pet-zzz")).toHaveCount(1);
  await page.screenshot({ path: `${shots}/sleepy-flower.png` });
  await home.getByRole("button", { name: "Acariciar a Pipo" }).click();
  await expect(mascot(home)).toHaveAttribute("data-mood", "happy");
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

test("Mi mascota: recordatorio quincenal con vista previa y sin horario nocturno", async ({
  page,
}) => {
  await open(page, seed({ reminder: { enabled: false } }));
  await page.getByRole("button", { name: "Mi mascota", exact: true }).click();
  await page.getByLabel("Recordarme registrar mi ahorro").check();
  await page.getByRole("button", { name: /Quincenal/ }).click();
  await expect(page.getByText("Próximos avisos:")).toBeVisible();
  await expect(page.getByLabel("Ejemplo de aviso")).toContainText("Pipo");
  await page.getByLabel("Hora").fill("23:00");
  await page.getByRole("button", { name: "Guardar recordatorio" }).click();
  await expect(page.getByRole("status")).toContainText(
    "De noche no molestamos",
  );
  await page.getByLabel("Hora").fill("09:30");
  await page.getByRole("button", { name: "Guardar recordatorio" }).click();
  await expect(page.getByRole("status")).toContainText("compañía está lista");
  const saved = await page.evaluate(
    () =>
      JSON.parse(localStorage.getItem("guardadito:v1")).preferences.reminder,
  );
  expect(saved).toMatchObject({
    enabled: true,
    frequency: "biweekly",
    time: "09:30",
  });
  expect(saved.since).toBeTruthy();
  await page.screenshot({
    path: `${shots}/reminder-settings.png`,
    fullPage: true,
  });
});
