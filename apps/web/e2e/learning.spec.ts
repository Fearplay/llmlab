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

test("field help opens with mouse, keyboard, and touch", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === "tablet", "Pointer and keyboard checks use desktop and mobile.");
  await page.goto("/ai-lab/agents");
  const help = page.getByRole("button", { name: "Více informací: Úloha agenta" });
  if (testInfo.project.name === "mobile") await help.tap();
  else { await help.focus(); await help.press("Enter"); }
  await expect(page.getByRole("tooltip")).toBeVisible();
  await expect(page.getByRole("tooltip")).toContainText("Příklad");
  if (testInfo.project.name === "desktop") {
    await help.press("Escape");
    await expect(page.getByRole("tooltip")).toHaveCount(0);
    await help.click();
    await expect(page.getByRole("tooltip")).toBeVisible();
  }
});
