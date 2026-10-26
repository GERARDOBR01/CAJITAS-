// Every screen of the one-screen design, in both themes: WCAG AA, readable
// text (14 px or more), 48 px buttons and no sideways scroll.
import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { settings } from "./helpers.js";

const checked = {};
async function audit(page, theme, screen) {
  if (!checked[theme]) {
    checked[theme] = true;
    const palette = await page.evaluate(() => {
      const style = getComputedStyle(document.documentElement);
      const luminance = (hex) =>
        [1, 3, 5]
          .map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
          .reduce(
            (sum, v, i) =>
              sum +
              (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4) *
                [0.2126, 0.7152, 0.0722][i],
            0,
          );
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
      ].map(([fg, bg]) => {
        const l = [
          luminance(style.getPropertyValue(fg).trim()),
          luminance(style.getPropertyValue(bg).trim()),
        ].sort((a, b) => b - a);
        return [`${fg} on ${bg}`, (l[0] + 0.05) / (l[1] + 0.05)];
      });
    });
    for (const [pair, ratio] of palette)
      expect(ratio, `${theme}: ${pair}`).toBeGreaterThanOrEqual(4.5);
  }
  const result = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  expect(
    result.violations.map((v) => [v.id, v.nodes.map((n) => n.target)]),
    `${theme}: ${screen}`,
  ).toEqual([]);
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
      ":is(main, dialog) :is(p, small, label, legend, button, a, h1, h2, h3, span, strong, summary, li)",
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

for (const theme of ["light", "dark"]) {
  test(`diseño ${theme}: crear, guardar, usar parte y cumplir`, async ({
    page,
  }) => {
    test.setTimeout(90000);
    await page.emulateMedia({ colorScheme: theme, reducedMotion: "reduce" });
    await page.goto("/");
    await page.evaluate(() => document.fonts.ready);
    const home = page.getByRole("region", { name: "Inicio", exact: true });
    // A single action on the empty home: create the first cajita.
    await expect(home.getByRole("button")).toHaveCount(1);
    await expect(home).not.toContainText(/0 (días|cajitas|metas)/);
    await audit(page, theme, "empty");

    await home.getByRole("button", { name: "Crear mi primera cajita" }).click();
    const form = page.getByRole("dialog", { name: "Nueva cajita" });
    await form.getByLabel("¿Para qué es?").fill("Mi sueño bonito");
    await form.getByRole("button", { name: "Viaje", exact: true }).click();
    await form.getByLabel("¿Cuánto quieres juntar?").fill("1000");
    await form.getByRole("button", { name: "3 meses" }).click();
    await expect(form.locator(".plan-line")).toContainText("Serían");
    await audit(page, theme, "create-dialog");
    await form.getByRole("button", { name: "Crear cajita" }).click();

    const card = page.locator(".cajita");
    await expect(card).toContainText("Faltan");
    await expect(home).not.toContainText(/candado|\d\d:\d\d:\d\d/);
    await audit(page, theme, "goal-created");

    await home.getByRole("button", { name: "Guardar dinero" }).click();
    const sheet = page.getByRole("dialog", { name: "Guardar dinero" });
    await sheet.getByLabel("Monto", { exact: true }).fill("300");
    await audit(page, theme, "save-sheet");
    await sheet.getByRole("button", { name: /^Guardar \$/ }).click();
    await expect(home.locator(".hero")).toHaveClass(/is-cheering/);
    await expect(home.locator(".hero .mascot")).toHaveClass(/mood-excited/);
    await audit(page, theme, "saved");

    await page
      .getByRole("button", { name: "Ver detalle de Mi sueño bonito" })
      .click();
    await audit(page, theme, "detail");
    await page
      .getByRole("button", { name: "Usé parte de este ahorro" })
      .click();
    const use = page.getByRole("dialog", { name: "Usé parte de mi ahorro" });
    await use.getByLabel("Monto", { exact: true }).fill("100");
    await audit(page, theme, "use-sheet");
    await use.getByRole("button", { name: /^Registrar/ }).click();
    await expect(page.locator(".detail-amount")).toContainText("$200");
    // Using savings is not a reaction: the pet stays calm.
    await expect(page.locator('[data-mood="sad"]')).toHaveCount(0);

    await page.getByRole("button", { name: "Guardar dinero" }).click();
    await sheet.getByLabel("Monto", { exact: true }).fill("800");
    await sheet.getByRole("button", { name: /^Guardar \$/ }).click();
    await expect(page.locator(".complete-scene")).toBeVisible();
    await page.getByRole("button", { name: "Volver al inicio" }).click();
    await expect(home.locator(".hero")).toContainText("¡Lo lograste!");
    await expect(
      home.getByRole("button", { name: "Cumplidas (1)" }),
    ).toBeVisible();
    await audit(page, theme, "goal-completed");
  });

  test(`diseño ${theme}: Ajustes y cada pantalla`, async ({ page }) => {
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
        json: { error: "Configura el token de Banxico en el servidor." },
      }),
    );
    await page.goto("/");
    await settings(page);
    await audit(page, theme, "settings");
    const items = await page.locator(".settings-list strong").allTextContents();
    expect(items.slice(0, 3)).toEqual([
      "Mi mascota",
      "Recordatorio",
      "Historial",
    ]);
    for (const item of items) {
      await page
        .getByRole("button", { name: new RegExp(`^${item}`) })
        .first()
        .click();
      await audit(page, theme, item);
      await page.getByRole("button", { name: "Volver" }).click();
    }
  });
}

test("las microanimaciones respetan el dispositivo y el ajuste de la mascota", async ({
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
  await settings(page, "Mi mascota");
  await page.getByLabel("Animaciones y destellitos").uncheck();
  await page.getByRole("button", { name: "Volver" }).click();
  await page.getByRole("button", { name: "Volver al inicio" }).click();
  expect(await motion()).toBe("none");
  const button = page.getByRole("button", { name: "Crear mi primera cajita" });
  await button.focus();
  await page.keyboard.down("Space");
  expect(await button.evaluate((el) => getComputedStyle(el).transform)).toBe(
    "none",
  );
  await page.keyboard.up("Space");
});
