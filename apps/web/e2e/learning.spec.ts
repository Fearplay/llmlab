import { expect, test } from "@playwright/test";
import { learningProgressKey, missions } from "../lib/learning-content";

test.beforeEach(async ({ page }) => {
  await page.route("**/api/v1/**", (route) => route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ detail: "Offline learning test" }) }));
  await page.addInitScript(() => {
    localStorage.setItem("llmlab.locale", "cs");
    localStorage.setItem("llmlab.mode", "fixture");
  });
});

test("every guided mission opens without an API key on desktop and mobile", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === "tablet", "Full mission coverage uses desktop and mobile widths.");
  for (const mission of missions) {
    const response = await page.goto(`/docs/learn/${mission.slug}`);
    expect(response?.status(), mission.slug).toBe(200);
    await expect(page.getByRole("heading", { name: mission.title.cs, exact: true }), mission.slug).toBeVisible();
    await expect(page.getByText(mission.action.cs, { exact: true }), mission.slug).toBeVisible();
    await expect(page.getByRole("link", { name: "Otevřít pokus →" }), mission.slug).toHaveAttribute("href", `${mission.href}?mission=${mission.slug}`);
  }
});

test("a mission gives retry feedback and saves only completed slugs", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === "tablet", "Interactive flow uses desktop and mobile widths.");
  const mission = missions[0];
  await page.goto(`/docs/learn/${mission.slug}`);
  await page.getByRole("button", { name: mission.choices.cs[1] }).first().click();
  await page.getByRole("link", { name: "Otevřít pokus →" }).click();
  await expect(page).toHaveURL(new RegExp(`${mission.href.replaceAll("/", "\\/")}\\?mission=${mission.slug}`));
  await page.getByRole("link", { name: "Zpět k otázce →" }).click();
  await page.getByRole("button", { name: mission.choices.cs[1] }).last().click();
  await page.getByRole("button", { name: "Zkontrolovat odpověď" }).click();
  await expect(page.getByText("Zkus to znovu", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: mission.choices.cs[0] }).last().click();
  await page.getByRole("button", { name: "Zkontrolovat odpověď" }).click();
  await expect(page.getByText("Správně, mise splněna", { exact: true })).toBeVisible();
  expect(await page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? "[]"), learningProgressKey)).toEqual([mission.slug]);
  await page.reload();
  await expect(page.getByText(`Dokončeno: 1 / ${missions.length}`)).toBeVisible();
});

test("field help supports focus, Enter, Space, Escape, and Tab", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === "mobile", "Keyboard navigation uses desktop and tablet.");
  await page.goto("/ai-lab/agents");
  const help = page.getByRole("button", { name: "Více informací: Úloha agenta" });
  const tooltip = page.getByRole("tooltip");
  await help.focus();
  await expect(tooltip).toBeVisible();
  await page.mouse.move(0, 0);
  await expect(tooltip).toBeVisible();
  for (const key of ["Enter", "Space"]) {
    await help.press("Escape");
    await expect(tooltip).toHaveCount(0);
    await expect(help).toHaveAttribute("aria-expanded", "false");
    await expect(help).not.toHaveAttribute("aria-describedby");
    await help.press(key);
    await expect(tooltip).toBeVisible();
    await expect(tooltip).toContainText("Příklad");
    await expect(help).toHaveAttribute("aria-describedby", (await tooltip.getAttribute("id"))!);
  }
  await help.press("Tab");
  await expect(page.getByRole("textbox", { name: /Co má agent zjistit/ })).toBeFocused();
  await expect(tooltip).toHaveCount(0);
});

test("field help opens on mouse hover and click, and closes outside", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === "mobile", "Mouse interactions use desktop and tablet.");
  await page.goto("/ai-lab/agents");
  const help = page.getByRole("button", { name: "Více informací: Úloha agenta" });
  const tooltip = page.getByRole("tooltip");
  await help.hover();
  await expect(tooltip).toBeVisible();
  await page.mouse.move(0, 0);
  await expect(tooltip).toHaveCount(0);
  await help.click();
  await expect(tooltip).toBeVisible();
  await expect(help).toBeFocused();
  await page.mouse.move(0, 0);
  await expect(tooltip).toBeVisible();
  await page.getByRole("textbox", { name: /Co má agent zjistit/ }).click();
  await expect(tooltip).toHaveCount(0);
});

test("field help stays open after touch and closes on an outside tap", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "mobile", "Real touch interactions use the touch-enabled mobile project.");
  await page.goto("/ai-lab/agents");
  const help = page.getByRole("button", { name: "Více informací: Úloha agenta" });
  const field = page.getByRole("textbox", { name: /Co má agent zjistit/ });
  const tooltip = page.getByRole("tooltip");
  for (let attempt = 0; attempt < 2; attempt++) {
    await help.tap();
    await expect(tooltip).toBeVisible();
    await expect(tooltip).toContainText("Příklad");
    await expect(help).toBeFocused();
    await expect(field).not.toBeFocused();
    await expect(help).toHaveAttribute("aria-expanded", "true");
    await expect(help).toHaveAttribute("aria-describedby", (await tooltip.getAttribute("id"))!);
    const bounds = await tooltip.boundingBox();
    expect(bounds).not.toBeNull();
    expect(bounds!.x).toBeGreaterThanOrEqual(0);
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(page.viewportSize()!.width);
    expect(bounds!.y).toBeGreaterThanOrEqual(0);
    await help.tap();
    await expect(tooltip).toBeVisible();
    await field.tap();
    await expect(tooltip).toHaveCount(0);
    await expect(help).toHaveAttribute("aria-expanded", "false");
    await expect(field).toBeFocused();
  }
  const reflection = page.getByRole("checkbox", { name: /Při neúspěchu požádat model/ });
  const checked = await reflection.isChecked();
  await page.getByRole("button", { name: /^Více informací: Při neúspěchu/ }).tap();
  await expect(tooltip).toBeVisible();
  expect(await reflection.isChecked()).toBe(checked);
});
