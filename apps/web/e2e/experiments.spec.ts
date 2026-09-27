import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("llmlab.locale", "cs");
    localStorage.setItem("llmlab.mode", "fixture");
  });
});

test("prompt comparison waits for a click and sends two requests to the same model", async ({ page }) => {
  const bodies: Record<string, unknown>[] = [];
  await page.route("**/api/v1/**", async (route) => {
    if (route.request().url().endsWith("/generation")) {
      bodies.push(route.request().postDataJSON() as Record<string, unknown>);
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ text: `Answer ${bodies.length}`, provider: "fixture", model: "fixture-gen-v2", mode: "fixture", fixture: true, usage: { input_tokens: 12, output_tokens: 5, cost_usd: 0 }, latency_ms: 1, applied_settings: {} }) });
    } else await route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ detail: "Offline" }) });
  });
  await page.goto("/ai-lab/prompt-tokens");
  expect(bodies).toHaveLength(0);
  await page.getByRole("button", { name: "Spustit porovnání (2 volání)" }).click();
  await expect(page.getByText("Answer 1")).toBeVisible();
  await expect(page.getByText("Answer 2")).toBeVisible();
  expect(bodies).toHaveLength(2);
  expect(bodies[0]).toMatchObject({ mode: "fixture", provider: "fixture", model: "fixture-gen-v2", temperature: 0.3, max_tokens: 256 });
  expect(bodies[1]).toMatchObject({ mode: "fixture", provider: "fixture", model: "fixture-gen-v2", temperature: 0.3, max_tokens: 256 });
  expect(bodies[0].messages).not.toEqual(bodies[1].messages);
  await expect(page.getByText("Ukázka · simulovaná odpověď")).toHaveCount(2);
  await expect(page.getByText(/12\/5 tokenů/)).toHaveCount(2);
});

test("grounding comparison sends the same question with evidence only in the second request", async ({ page }) => {
  const bodies: Record<string, unknown>[] = [];
  await page.route("**/api/v1/**", async (route) => {
    if (route.request().url().endsWith("/generation")) {
      bodies.push(route.request().postDataJSON() as Record<string, unknown>);
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ text: `Answer ${bodies.length}`, provider: "fixture", model: "fixture-gen-v2", mode: "fixture", fixture: true, usage: { input_tokens: 15, output_tokens: 5, cost_usd: 0 }, latency_ms: 1 }) });
    } else await route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ detail: "Offline" }) });
  });
  await page.goto("/ai-lab/grounding");
  expect(bodies).toHaveLength(0);
  await page.getByRole("button", { name: "Spustit dvě odpovědi" }).click();
  await expect(page.getByText("Answer 1")).toBeVisible();
  await expect(page.getByText("Answer 2")).toBeVisible();
  expect(bodies).toHaveLength(2);
  const first = bodies[0].messages as Array<{ content: string }>;
  const second = bodies[1].messages as Array<{ content: string }>;
  expect(first).toHaveLength(1);
  expect(second).toHaveLength(2);
  expect(second[1].content).toContain(first[0].content);
  expect(second[1].content).toContain("30 dnů");
});

test("evaluation examples reveal a wrong fact that partial word matching still rewards", async ({ page }) => {
  await page.route("**/api/v1/**", (route) => route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ detail: "Offline" }) }));
  await page.goto("/evaluators");
  const panel = page.getByRole("heading", { name: "Stejná odpověď, různá pravidla hodnocení" }).locator("..");
  await panel.getByRole("button", { name: "Chybné číslo" }).click();
  await expect(panel.getByRole("textbox", { name: "Odpověď modelu" })).toHaveValue("Vrácení je možné do 14 dnů.");
  await expect(panel.getByText(/Přesná shoda: 0 %/)).toBeVisible();
  await expect(panel.getByText(/Částečná shoda slov: [1-9]\d* %/)).toBeVisible();
});
