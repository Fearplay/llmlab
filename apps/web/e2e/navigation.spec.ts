import { expect, test, type Page } from "@playwright/test";
import { labEntries, labGroups } from "../lib/lab-catalog";

const primary = ["/", "/arena", "/datasets", "/prompts", "/providers", "/evaluators"];
const afterLabs = ["/reviews", "/history", "/operations"];
const footer = ["/settings", "/docs"];
const labPaths = labEntries.map((entry) => `/ai-lab/${entry.slug}`);

test.beforeEach(async ({ page }) => {
  await page.route("**/api/v1/**", (route) => route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ detail: "API intentionally unavailable in browser tests" }) }));
  await page.addInitScript(() => {
    localStorage.setItem("llmlab.locale", "en");
    localStorage.setItem("llmlab.mode", "fixture");
    localStorage.setItem("llmlab.theme", "light");
  });
  await page.goto("/");
  await expect(page.locator("html[data-hydrated='true']")).toBeAttached();
});

async function showNavigation(page: Page, mobile: boolean) {
  if (mobile) await page.getByRole("button", { name: "Open navigation" }).click();
  return page.getByRole("navigation", { name: "Primary navigation" });
}

test("keeps the sidebar compact and exposes every lab in four groups", async ({ page }, testInfo) => {
  const navigation = await showNavigation(page, testInfo.project.name === "mobile");
  await expect(navigation.getByRole("link", { name: "AI Lab" })).toHaveAttribute("href", "/ai-lab");
  await expect(navigation.locator(".nav-subgroup a")).toHaveCount(0);
  const toggle = navigation.getByRole("button", { name: "Expand AI Lab" });
  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-expanded", "true");
  for (const group of labGroups) {
    await navigation.getByRole("button", { name: group.en }).click();
    const expected = labEntries.filter((entry) => entry.group === group.id);
    const actual = await navigation.locator(".nav-subgroup a").evaluateAll((links) => links.map((link) => link.getAttribute("href")));
    expect(actual).toEqual(expected.map((entry) => `/ai-lab/${entry.slug}`));
  }
  const topLevel = await navigation.locator(":scope > a, .nav-lab-heading > a").evaluateAll((links) => links.map((link) => link.getAttribute("href")));
  expect(topLevel).toEqual([...primary, "/ai-lab", ...afterLabs]);
});

test("switching language keeps lab destinations", async ({ page }, testInfo) => {
  const mobile = testInfo.project.name === "mobile";
  const navigation = await showNavigation(page, mobile);
  await navigation.getByRole("button", { name: "Expand AI Lab" }).click();
  await navigation.getByRole("button", { name: "Foundations" }).click();
  const before = await navigation.locator(".nav-subgroup a").evaluateAll((links) => links.map((link) => link.getAttribute("href")));
  if (mobile) await page.getByRole("button", { name: "Close navigation" }).last().click();
  await page.getByRole("button", { name: "CZ" }).click();
  if (mobile) await page.getByRole("button", { name: "Open navigation" }).click();
  await expect(page.locator("html")).toHaveAttribute("lang", "cs");
  await expect(navigation.getByRole("button", { name: "Základy" })).toBeVisible();
  const after = await navigation.locator(".nav-subgroup a").evaluateAll((links) => links.map((link) => link.getAttribute("href")));
  expect(after).toEqual(before);
});

test("every section renders and marks its sidebar link", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "Route smoke test runs once.");
  for (const href of [...primary, "/ai-lab", ...labPaths, ...afterLabs, ...footer]) {
    const response = await page.goto(href);
    expect(response?.status(), href).toBe(200);
    await expect(page.locator("main h1").first(), href).toBeVisible();
    await expect(page.locator(`.sidebar a[href="${href}"]`).last(), href).toHaveClass(/\bactive\b/);
  }
});

test("mobile menu closes after selecting a grouped lab", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "mobile", "Mobile navigation behavior.");
  const navigation = await showNavigation(page, true);
  await navigation.getByRole("button", { name: "Expand AI Lab" }).click();
  await navigation.getByRole("button", { name: "Foundations" }).click();
  await navigation.locator('a[href="/ai-lab/embeddings"]').click();
  await expect(page).toHaveURL(/\/ai-lab\/embeddings$/);
  await expect(page.locator(".sidebar")).not.toHaveClass(/sidebar-open/);
});
