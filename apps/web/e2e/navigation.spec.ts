import { expect, test, type Page } from "@playwright/test";

// This is the public navigation contract. An intentional move or removal should
// update this list together with the documentation.
const primary = [
  ["/", "Overview"],
  ["/arena", "Model arena"],
  ["/datasets", "Datasets"],
  ["/prompts", "Prompts"],
  ["/providers", "Providers"],
  ["/evaluators", "Evaluators"],
] as const;

const labs = [
  ["/ai-lab/prompt-tokens", "Prompt & Tokens"],
  ["/ai-lab/embeddings", "Embeddings"],
  ["/ai-lab/rag", "RAG Pipeline"],
  ["/ai-lab/safety", "Safety & Injection"],
  ["/ai-lab/agents", "Agents"],
  ["/ai-lab/flappy", "Flappy AI"],
] as const;

const afterLabs = [
  ["/reviews", "Reviews"],
  ["/history", "Run history"],
  ["/operations", "Cost & operations"],
] as const;

const footer = [
  ["/settings", "Settings"],
  ["/docs", "Documentation"],
] as const;

const allSections = [...primary, ...labs, ...afterLabs, ...footer];
const czechLabels = [
  "Přehled", "Aréna modelů", "Datasety", "Prompty", "Poskytovatelé", "Evaluátory",
  "Prompt a tokeny", "Embeddingy", "RAG pipeline", "Bezpečnost a injection", "Agenti",
  "Flappy AI", "Kontroly", "Historie běhů", "Cena a provoz",
];

test.beforeEach(async ({ page }) => {
  await page.route("**/api/v1/**", (route) => route.fulfill({
    status: 503,
    contentType: "application/json",
    body: JSON.stringify({ detail: "API intentionally unavailable in browser tests" }),
  }));
  await page.addInitScript(() => {
    localStorage.setItem("llmlab.locale", "en");
    localStorage.setItem("llmlab.mode", "fixture");
    localStorage.setItem("llmlab.theme", "light");
  });
  await page.goto("/");
  await expect(page.locator("html[data-hydrated='true']")).toBeAttached();
});

async function showNavigation(page: Page, isMobile: boolean) {
  if (isMobile) await page.getByRole("button", { name: "Open navigation" }).click();
  const navigation = page.getByRole("navigation", { name: "Primary navigation" });
  await navigation.getByRole("button", { name: "AI Lab" }).click();
  await expect(navigation.getByRole("button", { name: "AI Lab" })).toHaveAttribute("aria-expanded", "true");
  return navigation;
}

test("keeps every section in its sidebar group and order", async ({ page }, testInfo) => {
  const isMobile = testInfo.project.name === "mobile";
  const navigation = await showNavigation(page, isMobile);
  const mainLinks = navigation.getByRole("link");
  const actual = await mainLinks.evaluateAll((links) => links.map((link) => [
    link.getAttribute("href"),
    link.textContent?.trim(),
  ]));
  expect(actual).toEqual([...primary, ...labs, ...afterLabs]);
  await expect(page.locator(".nav-footer a")).toHaveCount(footer.length);
  for (const [href, label] of footer) {
    await expect(page.locator(`.nav-footer a[href="${href}"]`)).toHaveText(label);
  }

  const group = navigation.getByRole("button", { name: "AI Lab" });
  const preceding = navigation.locator('a[href="/evaluators"]');
  const following = navigation.locator('a[href="/reviews"]');
  const [before, middle, after] = await Promise.all([
    preceding.boundingBox(), group.boundingBox(), following.boundingBox(),
  ]);
  expect(before?.y).toBeLessThan(middle?.y ?? 0);
  expect(middle?.y).toBeLessThan(after?.y ?? 0);
});

test("keeps the same section locations after switching language", async ({ page }, testInfo) => {
  const isMobile = testInfo.project.name === "mobile";
  const navigation = await showNavigation(page, isMobile);
  const pathsBefore = await navigation.getByRole("link").evaluateAll((links) => links.map((link) => link.getAttribute("href")));
  if (isMobile) await page.getByRole("button", { name: "Close navigation" }).last().click();
  await page.getByRole("button", { name: "CZ" }).click();
  await expect(page.locator("html")).toHaveAttribute("lang", "cs");
  if (isMobile) await page.getByRole("button", { name: "Open navigation" }).click();
  const pathsAfter = await navigation.getByRole("link").evaluateAll((links) => links.map((link) => link.getAttribute("href")));
  expect(pathsAfter).toEqual(pathsBefore);
  await expect(navigation.getByRole("link")).toHaveText(czechLabels);
  await expect(page.locator('.nav-footer a[href="/settings"]')).toHaveText("Nastavení");
  await expect(page.locator('.nav-footer a[href="/docs"]')).toHaveText("Dokumentace");
});

test("every linked section opens a page and marks the current section", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "Route smoke test runs once; layout runs at every viewport.");

  for (const [href] of allSections) {
    const response = await page.goto(href);
    expect(response?.status(), href).toBe(200);
    await expect(page.locator("main h1").first(), href).toBeVisible();
    await expect(page.locator(`.sidebar a[href="${href}"]`).last(), href).toHaveClass(/\bactive\b/);
  }
});

test("mobile menu closes after selecting a lab section", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "mobile", "Mobile navigation behavior.");

  const navigation = await showNavigation(page, true);
  await navigation.locator('a[href="/ai-lab/embeddings"]').click();
  await expect(page).toHaveURL(/\/ai-lab\/embeddings$/);
  await expect(page.locator(".sidebar")).not.toHaveClass(/sidebar-open/);
  await expect(page.locator('a[href="/ai-lab/embeddings"]')).toHaveClass(/\bactive\b/);
});
