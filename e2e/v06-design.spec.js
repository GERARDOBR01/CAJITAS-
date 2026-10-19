import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { writeFile } from "node:fs/promises";

let engine;
const reports = [],
  palette = {};
async function audit(page, theme, screen) {
  if (!palette[theme]) {
    palette[theme] = await page.evaluate(() => {
      const style = getComputedStyle(document.documentElement);
      const luminance = (hex) => {
        const channels = [1, 3, 5].map(
          (index) => parseInt(hex.slice(index, index + 2), 16) / 255,
        );
        return channels.reduce(
          (sum, value, index) =>
            sum +
            (value <= 0.04045
              ? value / 12.92
              : ((value + 0.055) / 1.055) ** 2.4) *
              [0.2126, 0.7152, 0.0722][index],
          0,
        );
      };
      return [
        ["--text", "--surface"],
        ["--muted", "--surface"],
        ["--muted", "--canvas"],
        ["--primary", "--surface"],
        ["--on-primary", "--primary"],
        ["--on-mint", "--mint"],
        ["--on-pink", "--pink"],
        ["--on-yellow", "--yellow"],
        ["--on-sky", "--sky"],
        ["--text", "--surface-soft"],
        ["--muted", "--surface-soft"],
        ["--muted", "--yellow"],
        ["--muted", "--pink"],
        ["--muted", "--mint"],
      ].map(([foreground, background]) => {
        const fg = style.getPropertyValue(foreground).trim(),
          bg = style.getPropertyValue(background).trim();
        const values = [luminance(fg), luminance(bg)].sort((a, b) => b - a);
        return {
          foreground,
          background,
          fg,
          bg,
          ratio: (values[0] + 0.05) / (values[1] + 0.05),
        };
      });
    });
    for (const pair of palette[theme])
      expect(
        pair.ratio,
        `${theme}: ${pair.foreground} on ${pair.background}`,
      ).toBeGreaterThanOrEqual(4.5);
  }
  const result = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  engine = result.testEngine;
  reports.push({
    theme,
    screen,
    violations: result.violations.map((v) => ({
      id: v.id,
      impact: v.impact,
      nodes: v.nodes.map((n) => ({
        target: n.target,
        summary: n.failureSummary,
      })),
    })),
    incomplete: result.incomplete.map((v) => ({
      id: v.id,
      targets: v.nodes.map((n) => n.target),
    })),
  });
  expect(result.violations, `${theme}: ${screen}`).toEqual([]);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
    `${theme}: overflow in ${screen}`,
  ).toBe(true);
  const sizing = await page.evaluate(() => {
    const smallText = [],
      shortButtons = [];
    for (const el of document.querySelectorAll(
      "main :is(p, small, label, legend, button, a, h1, h2, h3, span, strong, summary, th, td, li)",
    )) {
      if (
        !el.checkVisibility() ||
        el.closest('svg, [aria-hidden="true"], .visually-hidden')
      )
        continue;
      const directText = [...el.childNodes].some(
        (node) => node.nodeType === Node.TEXT_NODE && node.textContent.trim(),
      );
      if (directText && parseFloat(getComputedStyle(el).fontSize) < 14)
        smallText.push(el.textContent.trim().slice(0, 80));
    }
    for (const el of document.querySelectorAll("button")) {
      if (el.checkVisibility() && el.getBoundingClientRect().height < 48)
        shortButtons.push(
          el.getAttribute("aria-label") || el.textContent.trim(),
        );
    }
    return { smallText, shortButtons };
  });
  expect(
    sizing,
    `${theme}: legible text and 48 px buttons in ${screen}`,
  ).toEqual({ smallText: [], shortButtons: [] });
}
async function more(page, name) {
  await page.getByRole("button", { name: "Más", exact: true }).click();
  if (name) await page.getByRole("button", { name, exact: true }).click();
}
async function dismiss(page) {
  const close = page.getByRole("button", { name: "Cerrar aviso", exact: true });
  if (await close.isVisible()) await close.click();
}
const snapshot = (page, name) =>
  page.screenshot({
    path: `docs/screenshots/v06/${name}.png`,
    animations: "disabled",
  });
test.afterAll(async () =>
  writeFile(
    "docs/design/v06-accessibility.json",
    JSON.stringify(
      {
        tool: "@axe-core/playwright",
        engine,
        tags: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"],
        viewport: { width: 390, height: 844 },
        palette,
        reports,
      },
      null,
      2,
    ) + "\n",
  ),
);
for (const theme of ["light", "dark"]) {
  test(`diseño ${theme}: crear, ahorrar, retirar antes y cumplir con aviso visible y contraste AA`, async ({
    page,
  }) => {
    test.setTimeout(90000);
    await page.emulateMedia({ colorScheme: theme, reducedMotion: "reduce" });
    await page.goto("/");
    await page.evaluate(() => document.fonts.ready);
    const home = page.getByRole("region", { name: "Inicio", exact: true });
    // A single action on the empty home: create the first cajita.
    await expect(home.getByRole("button")).toHaveCount(1);
    await expect(home.locator("svg")).toHaveCount(1);
    expect(
      await home
        .locator(".mascot")
        .evaluate((el) => el.getBoundingClientRect().width),
    ).toBeGreaterThanOrEqual(156);
    await expect(
      page.getByRole("button", { name: "Personalizar mi mascota" }),
    ).toBeInViewport();
    await expect(home).not.toContainText(/0 (días|cajitas|metas)/);
    await expect(
      home.locator(".download-banner, .daily-ritual, .tutorial-launch, .stats"),
    ).toHaveCount(0);
    await audit(page, theme, "empty");
    await home
      .getByRole("button", { name: "+ Nueva cajita", exact: true })
      .click();
    await page.getByLabel("Nombre de tu meta").fill("Mi sueño bonito");
    await page.getByLabel("¿Cuánto quieres ahorrar? (MXN)").fill("1000");
    const future = new Date();
    future.setDate(future.getDate() + 30);
    await page
      .getByLabel("Fecha objetivo")
      .fill(
        `${future.getFullYear()}-${String(future.getMonth() + 1).padStart(2, "0")}-${String(future.getDate()).padStart(2, "0")}`,
      );
    await audit(page, theme, "create-dialog");
    await page
      .getByRole("button", { name: "Crear cajita", exact: true })
      .click();
    const card = page.locator(".goal-card");
    await expect(card).toContainText("días ·");
    await expect(card.locator(".commitment-note")).toContainText(
      "El candado es de compromiso, no bancario.",
    );
    await expect(card.locator(".commitment-note")).toContainText(
      "Tu dinero sigue disponible",
    );
    const order = await home.evaluate((el) =>
      [...el.querySelectorAll(".home-greeting, .goals-grid, .new-goal")].map(
        (node) => node.classList[0],
      ),
    );
    expect(order).toEqual(["home-greeting", "goals-grid", "primary"]);
    await audit(page, theme, "goal-created");
    await card.evaluate((el) =>
      el.scrollIntoView({ block: "start", behavior: "instant" }),
    );
    await snapshot(page, `flow-card-${theme}`);
    await card.getByRole("button", { name: "+ Registrar ahorro" }).click();
    await page.getByLabel("Monto (MXN)").fill("300");
    await audit(page, theme, "deposit-dialog");
    await page
      .getByRole("button", { name: "Registrar ahorro", exact: true })
      .click();
    await expect(home.locator(".home-greeting")).toHaveClass(/is-cheering/);
    await expect(home.locator(".mascot")).toHaveClass(/mood-excited/);
    await expect(home.locator(".mascot")).toBeInViewport();
    await page.evaluate(() => scrollTo(0, 0));
    await snapshot(page, `flow-saving-${theme}`);
    await audit(page, theme, "deposit-recorded");
    await card
      .getByRole("button", { name: "Registrar retiro", exact: true })
      .click();
    await expect(
      page.getByRole("dialog").locator(".commitment-note"),
    ).toBeVisible();
    await page.getByLabel("Monto (MXN)").fill("100");
    await expect(
      page.getByRole("dialog").locator(".commitment-note"),
    ).toContainText("El candado es de compromiso, no bancario.");
    await snapshot(page, `flow-withdrawal-${theme}`);
    await audit(page, theme, "withdraw-dialog");
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Registrar retiro", exact: true })
      .click();
    await expect(card.locator(".saved")).toContainText("$200.00");
    // A withdrawal is not a reaction: the pet stays calm and the page stays put.
    await expect(home.locator('[data-mood="sad"]')).toHaveCount(0);
    await audit(page, theme, "withdrawal-recorded");
    await card.getByRole("button", { name: "+ Registrar ahorro" }).click();
    await page.getByLabel("Monto (MXN)").fill("800");
    await page
      .getByRole("button", { name: "Registrar ahorro", exact: true })
      .click();
    await expect(card.getByRole("progressbar")).toHaveAttribute(
      "aria-valuenow",
      "100",
    );
    await expect(card).toContainText("¡Lo lograste!");
    await expect(home.locator(".home-greeting")).toHaveClass(/is-cheering/);
    await page.evaluate(() => scrollTo(0, 0));
    await snapshot(page, `flow-complete-${theme}`);
    await audit(page, theme, "goal-completed");
  });
  test(`diseño ${theme}: Más, pantallas y tutorial usan los tokens accesibles`, async ({
    page,
  }) => {
    test.setTimeout(120000);
    await page.emulateMedia({ colorScheme: theme, reducedMotion: "reduce" });
    await page.route("**/api/status", (r) =>
      r.fulfill({
        json: {
          gmailConfigured: false,
          gmailConnected: false,
          bitsoConfigured: false,
        },
      }),
    );
    await page.route("**/api/rates", (r) =>
      r.fulfill({
        status: 503,
        json: {
          error:
            "Configura el token de Banxico en el servidor para consultar tasas reales.",
        },
      }),
    );
    await page.goto("/");
    await more(page);
    await expect(
      page.getByRole("complementary", { name: "Descargar Guardadito" }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Un ratito para ti y tus sueños" }),
    ).toBeVisible();
    await audit(page, theme, "more");
    await snapshot(page, `more-${theme}`);
    for (const name of ["Mi mascota", "Actividad"]) {
      await page.getByRole("button", { name, exact: true }).click();
      await audit(page, theme, name);
    }
    for (const name of [
      "Rendimiento",
      "Conexiones",
      "Respaldo",
      "Instalar app",
    ]) {
      await more(page, name);
      await audit(page, theme, name);
    }
    await more(page, "Tutorial interactivo");
    for (const [i, label] of [
      "Tu espacio",
      "Tu meta",
      "Ahorrar",
      "El candado",
      "Tu mascota",
      "Herramientas",
      "Tu app",
      "Repaso",
    ].entries()) {
      // Read the existing step label so this visual check follows the tutorial's own navigation.
      const button = page.locator(".tutorial-steps button").nth(i);
      await button.click();
      await audit(page, theme, `tutorial-${i + 1}-${label}`);
    }
  });
}

test("las microanimaciones respetan el dispositivo y el ajuste existente de la mascota", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  const motion = () =>
    page
      .locator(".home .mascot")
      .evaluate((el) => getComputedStyle(el).animationName);
  expect(await motion()).toBe("none");
  await page.emulateMedia({ reducedMotion: "no-preference" });
  expect(await motion()).not.toBe("none");
  await page.getByRole("button", { name: "Mi mascota", exact: true }).click();
  await page.getByLabel("Animaciones suaves y destellitos").uncheck();
  await page.getByRole("button", { name: "Guardar mi compañero" }).click();
  await dismiss(page);
  await page.getByRole("button", { name: "Mis cajitas", exact: true }).click();
  expect(await motion()).toBe("none");
  const button = page.getByRole("button", {
    name: "+ Nueva cajita",
    exact: true,
  });
  await button.focus();
  await page.keyboard.down("Space");
  expect(await button.evaluate((el) => getComputedStyle(el).transform)).toBe(
    "none",
  );
  await page.keyboard.up("Space");
});
