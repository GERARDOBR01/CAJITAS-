import { test, expect } from "@playwright/test";

const shots = "docs/screenshots/v08";
const day = (n) => new Date(Date.now() - n * 86400000).toISOString();
function seed() {
  return {
    version: 2,
    savedAt: 1,
    importedIds: [],
    assignments: {},
    checkins: [day(0).slice(0, 10)],
    preferences: {
      pet: "cat",
      petName: "Cookie",
      accessory: "leaf",
      animations: true,
      reminder: {
        enabled: false,
        frequency: "biweekly",
        day: 5,
        time: "09:00",
        since: null,
        ignored: 0,
        recent: [],
      },
    },
    goals: [
      {
        id: "g1",
        name: "Viaje juntos",
        targetCents: 300000,
        unlockDate: "2027-03-01",
        provider: "Nu",
        icon: "star",
        frequency: 15,
        entries: [{ id: "e1", cents: 120000, at: day(3), source: "manual" }],
      },
    ],
  };
}
async function open(page, data) {
  if (data)
    await page.addInitScript((raw) => {
      if (!sessionStorage.getItem("seeded")) {
        localStorage.setItem("guardadito:v1", raw);
        sessionStorage.setItem("seeded", "1");
      }
    }, JSON.stringify(data));
  await page.goto("/");
  return page.getByRole("region", { name: "Inicio", exact: true });
}

test("Cookie, el gatito café, es la mascota de inicio", async ({ page }) => {
  const home = await open(page);
  await expect(home.locator(".mascot.pet-cat")).toHaveCount(1);
  await expect(home.getByText("¡Hola, soy Cookie!")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Personalizar mi mascota" }),
  ).toContainText("🐱");
});

test("dice ¡BECHO! cada poco tiempo, alternando con BECHO BECHO", async ({
  page,
}) => {
  await page.clock.install();
  const home = await open(page, seed());
  const bubble = home.locator(".cookie-bubble");
  await page.clock.runFor(3600);
  await expect(bubble).toHaveText("¡BECHO!");
  await expect(home.locator(".mascot")).toHaveAttribute("data-face", "kiss");
  await page.screenshot({ path: `${shots}/becho.png` });
  await page.clock.runFor(2500);
  await expect(bubble).toHaveCount(0);
  // The next one arrives 9–16 s later; step the clock until it shows up.
  let next = "";
  for (let t = 0; t < 17000 && next !== "BECHO BECHO"; t += 500) {
    await page.clock.runFor(500);
    next = (await bubble.count()) ? await bubble.textContent() : "";
  }
  expect(next).toBe("BECHO BECHO");
});

test("al tocarlo dice “¡Te amo Jade!” con lluvia de corazones", async ({
  page,
}) => {
  const home = await open(page, seed());
  await home.getByRole("button", { name: "Acariciar a Cookie" }).click();
  await expect(page.locator(".love-banner")).toContainText("¡Te amo Jade!");
  await expect(page.locator(".love-rain span")).toHaveCount(26);
  await expect(home.locator(".mascot")).toHaveAttribute("data-face", "love");
  await expect(home.locator(".home-speech")).toContainText("¡Te amo Jade!");
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${shots}/te-amo-jade.png` });
  await expect(page.locator(".love-banner")).toHaveCount(0, { timeout: 5000 });
  await expect(home.locator(".mascot")).not.toHaveAttribute(
    "data-face",
    "love",
  );
});

test("con movimiento reducido el mensaje sigue, sin animaciones", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  const home = await open(page, seed());
  await home.getByRole("button", { name: "Acariciar a Cookie" }).click();
  await expect(home.locator(".cookie-love strong")).toHaveText("¡Te amo Jade!");
  await expect(page.locator(".love-rain")).toHaveCount(0);
  const moving = await home
    .locator(".mascot")
    .evaluate((svg) =>
      [svg, ...svg.querySelectorAll("*")].some(
        (node) => getComputedStyle(node).animationName !== "none",
      ),
    );
  expect(moving).toBe(false);
});

test("Mi mascota: Cookie va primero entre las mascotas", async ({ page }) => {
  await open(page, seed());
  await page.getByRole("button", { name: "Mi mascota", exact: true }).click();
  const options = page.locator(".pet-options button");
  await expect(options.first()).toContainText("Gatito");
  await expect(options.first()).toHaveAttribute("aria-pressed", "true");
  await page.screenshot({ path: `${shots}/mi-mascota.png`, fullPage: true });
});
