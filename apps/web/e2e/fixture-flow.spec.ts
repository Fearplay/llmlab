import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => {
    localStorage.setItem("llmlab.locale", "en");
    localStorage.setItem("llmlab.mode", "fixture");
    localStorage.setItem("llmlab.theme", "light");
    localStorage.removeItem("llmlab.dashboard.runs");
    localStorage.removeItem("llmlab.dashboard.showFixtures");
  });
  await page.reload();
  await expect(page.locator("html[data-hydrated='true']")).toBeAttached();
});

test("runs a fixture experiment and opens comparison", async ({ page }) => {
  await page.getByRole("button", { name: "New experiment" }).click();
  await expect(page.getByRole("dialog").getByText("Deterministic demo data — not a live model result")).toBeVisible();
  await page.getByRole("button", { name: "Start fixture run" }).click();
  await expect(page.getByText("Fixture run completed. No cloud request was made.")).toBeVisible();
  await page.getByRole("button", { name: "View overview" }).click();
  await expect(page.getByText("Your run", { exact: true })).toBeVisible();
});

test("clears only demo data and keeps user runs", async ({ page }) => {
  await page.getByRole("button", { name: "New experiment" }).click();
  await page.getByLabel("Experiment name", { exact: true }).fill("My production check");
  await page.getByRole("button", { name: "Start fixture run" }).click();
  await expect(page.getByText("Fixture run completed. No cloud request was made.")).toBeVisible();
  await page.getByRole("button", { name: "View overview" }).click();
  await page.getByRole("button", { name: "Clear demo data" }).click();
  await expect(page.getByRole("cell", { name: "My production check", exact: true })).toBeVisible();
  await expect(page.getByText("Demo", { exact: true })).toHaveCount(0);
  await expect(page.locator(".data-scope-bar strong")).toHaveText("Your data only");
});

test("runs and inspects the RAG pipeline", async ({ page }) => {
  await page.goto("/ai-lab/rag");
  const run = page.getByRole("button", { name: "Run pipeline" });
  await run.click();
  await expect(run).toBeDisabled();
  await expect(run).toBeEnabled();
  await page.getByRole("tab", { name: "Claims" }).click();
  await expect(page.getByText("Generated answer")).toBeVisible();
});

test("filters run comparison regressions", async ({ page }) => {
  await page.goto("/experiments/compare");
  await expect(page.getByText("Quality gate failed")).toBeVisible();
  await page.getByLabel("Case filter").selectOption("all");
  await expect(page.getByText("CS-0447")).toBeVisible();
});

test("runs the bounded training fixture", async ({ page }) => {
  await page.goto("/ai-lab/training");
  await page.getByRole("button", { name: "Start fixture training" }).click();
  await expect(page.getByText("Completed")).toBeVisible();
  await expect(page.getByText("Overfitting signal", { exact: true })).toBeVisible();
});

test("switches the complete interface to Czech", async ({ page }) => {
  await page.getByRole("button", { name: "CZ" }).click();
  await expect(page.getByRole("heading", { name: "AI zákaznické podpory" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Experimenty" })).toBeVisible();
});

test("opens the local AI field guide and enters the RAG lab", async ({ page }) => {
  await page.goto("/docs");
  await expect(page.getByRole("heading", { name: "AI systems field guide" })).toBeVisible();
  await page.getByRole("link", { name: "Open interactive lab" }).nth(2).click();
  await expect(page).toHaveURL(/\/ai-lab\/rag$/);
  await expect(page.getByRole("button", { name: "Run pipeline" })).toBeVisible();
});

test("configures a real cloud provider and model in Prompt Lab", async ({ page }) => {
  await page.goto("/ai-lab/prompt-tokens");
  await page.getByRole("button", { name: "Cloud" }).click();
  await expect(page.getByLabel("Provider", { exact: true })).toHaveValue("openai");
  await expect(page.getByLabel("Model", { exact: true })).toHaveValue("gpt-4.1");
  await page.getByRole("button", { name: "Model: open options" }).click();
  await expect(page.getByRole("option", { name: "gpt-6-astra" })).toBeVisible();
  await expect(page.getByRole("option", { name: "gpt-4.1-mini" })).toBeVisible();
  await page.getByLabel("Model", { exact: true }).fill("my-fine-tuned-model");
  await expect(page.getByLabel("Model", { exact: true })).toHaveValue("my-fine-tuned-model");
  await page.getByLabel("Provider", { exact: true }).selectOption("anthropic");
  await expect(page.getByLabel("Model", { exact: true })).toHaveValue("claude-sonnet-5");
  await page.getByRole("button", { name: "Model: open options" }).click();
  await expect(page.getByRole("option", { name: "claude-opus-5" })).toBeVisible();
  await expect(page.getByRole("option", { name: "claude-haiku-4-5-20251001" })).toBeVisible();
  await expect(page.getByText("No result yet")).toBeVisible();
});

test("keeps table help inside the viewport", async ({ page }) => {
  await page.getByRole("button", { name: "More information: Model ID" }).first().click();
  const tooltip = page.getByRole("tooltip");
  await expect(tooltip).toBeVisible();
  const box = await tooltip.boundingBox();
  const viewport = page.viewportSize();
  expect(box).not.toBeNull();
  expect(viewport).not.toBeNull();
  expect(box!.x).toBeGreaterThanOrEqual(0);
  expect(box!.x + box!.width).toBeLessThanOrEqual(viewport!.width);
  expect(box!.y + box!.height).toBeLessThanOrEqual(viewport!.height);
});

test("explains controls in both languages and persists dark mode", async ({ page }) => {
  await page.goto("/ai-lab/prompt-tokens");
  await page.getByRole("button", { name: "More information: System instruction" }).click();
  const englishHelp = page.getByRole("tooltip");
  await expect(englishHelp).toContainText("Defines the generator's role");
  await expect(englishHelp).toContainText("Example");

  await page.getByRole("button", { name: "Switch to dark mode" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");

  await page.getByRole("button", { name: "CZ" }).click();
  await page.getByRole("button", { name: "Více informací: Systémová instrukce" }).click();
  const czechHelp = page.getByRole("tooltip");
  await expect(czechHelp).toContainText("Určuje roli, omezení a pravidla odpovědi");
  await expect(czechHelp).toContainText("Příklad");
});
