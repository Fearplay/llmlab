import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  // Keep browser checks deterministic and independent of a local API or keys.
  await page.route("**/api/v1/**", (route) => route.fulfill({
    status: 503,
    contentType: "application/json",
    body: JSON.stringify({ detail: "API intentionally unavailable in browser tests" }),
  }));
  await page.addInitScript(() => {
    if (localStorage.getItem("llmlab.locale") === null) localStorage.setItem("llmlab.locale", "en");
    if (localStorage.getItem("llmlab.mode") === null) localStorage.setItem("llmlab.mode", "fixture");
    if (localStorage.getItem("llmlab.theme") === null) localStorage.setItem("llmlab.theme", "light");
  });
  await page.goto("/");
  await expect(page.locator("html[data-hydrated='true']")).toBeAttached();
});

test("overview sends a new user to the prompt lab", async ({ page }) => {
  await expect(page.getByRole("region", { name: "Get started" })).toBeVisible();
  await page.getByRole("link", { name: "Open Prompt & tokens" }).click();
  await expect(page).toHaveURL(/\/ai-lab\/prompt-tokens$/);
  await expect(page.locator("main h1")).toBeVisible();
});

test("prompt versions survive reload in this browser", async ({ page }) => {
  await page.goto("/prompts");
  const editor = page.locator("textarea.prompt-editor");
  await editor.fill("You are a concise analyst.\n\nQUESTION\n{{question}}");
  await expect(page.getByText("{{question}}", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Save as new version" }).click();
  await expect(page.getByText(/A new prompt version was created locally/)).toBeVisible();
  await expect(page.getByLabel("Version", { exact: true })).toHaveValue("v1");
  await page.reload();
  await page.getByLabel("Version", { exact: true }).selectOption("v1");
  await expect(editor).toHaveValue("You are a concise analyst.\n\nQUESTION\n{{question}}");
});

test("RAG source controls expose paste and upload without an API", async ({ page }) => {
  await page.goto("/ai-lab/rag");
  await expect(page.getByRole("heading", { name: "RAG with your documents" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Preview chunks" })).toBeDisabled();
  await page.getByLabel("Document text").fill("The return period is 21 days.");
  await expect(page.getByRole("button", { name: "Preview chunks" })).toBeEnabled();
  await page.getByRole("button", { name: "Upload file" }).click();
  await expect(page.locator('input[type="file"]')).toHaveAttribute("accept", /\.pdf.*\.docx.*\.txt/);
  await page.getByRole("button", { name: "Paste text" }).click();
  await expect(page.getByLabel("Document text")).toHaveValue("The return period is 21 days.");
});

test("learning paths open their linked RAG exercise", async ({ page }) => {
  await page.goto("/docs");
  await expect(page.locator(".docs-tracks details")).toHaveCount(4);
  await expect(page.locator(".docs-tracks summary").first()).toContainText("LLM foundations");
  await page.locator(".docs-tracks summary").nth(1).click();
  await page.locator(".lesson-step").filter({ has: page.getByRole("heading", { name: "RAG pipeline" }) }).getByRole("link", { name: "Try it" }).click();
  await expect(page).toHaveURL(/\/ai-lab\/rag$/);
  await expect(page.getByRole("heading", { name: "RAG with your documents" })).toBeVisible();
});

test("project name is saved and used on the overview", async ({ page }) => {
  await page.goto("/settings");
  await page.getByRole("textbox", { name: /Project name/ }).fill("Returns quality lab");
  await page.getByRole("button", { name: "Save name" }).click();
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Returns quality lab" })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("heading", { name: "Returns quality lab" })).toBeVisible();
});

test("language and dark mode persist after reload", async ({ page }) => {
  await page.getByRole("button", { name: "Switch to dark mode" }).click();
  await page.getByRole("button", { name: "CZ" }).click();
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await expect(page.locator("html")).toHaveAttribute("lang", "cs");
  await expect(page.getByRole("heading", { name: "LLMLab" })).toBeVisible();
});

test("legacy section URLs redirect to the current destinations", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "Redirects are viewport independent.");
  const aliases = [
    ["/experiments", "/history"],
    ["/knowledge-base", "/ai-lab/rag"],
    ["/ai-lab/training", "/ai-lab/flappy"],
  ] as const;
  for (const [oldPath, currentPath] of aliases) {
    await page.goto(oldPath);
    await expect(page, oldPath).toHaveURL(new RegExp(`${currentPath}$`));
    await expect(page.locator("main h1").first(), currentPath).toBeVisible();
  }
  await page.goto("/experiments/compare");
  await expect(page.locator("main h1").first()).toBeVisible();
});
