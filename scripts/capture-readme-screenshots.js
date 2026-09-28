// Run with an isolated Playwright CLI session opened at about:blank:
// playwright-cli -s=readme open about:blank
// playwright-cli -s=readme run-code --filename scripts/capture-readme-screenshots.js
// playwright-cli -s=readme close
async (page) => {
  const origin = "http://127.0.0.1:3000";
  const catalog = { models: [
    { key: "ollama:qwen3.5:2b", provider: "ollama", id: "qwen3.5:2b", mode: "local", capabilities: ["generation"], available: true },
    { key: "ollama:all-minilm", provider: "ollama", id: "all-minilm", mode: "local", capabilities: ["embeddings"], available: true },
  ] };
  const fixtures = {
    "/api/v1/models": catalog,
    "/api/v1/experiments": [],
    "/api/v1/user-documents": { documents: [] },
    "/api/v1/operations/summary": { runs: 0, game_episodes: 0, priced_calls: 0, unknown_calls: 0, estimated_usd: 0, input_tokens: 0, output_tokens: 0, by_model: [], by_day: [] },
  };
  const unexpected = [];
  await page.context().route("**/*", async (route) => {
    const url = route.request().url();
    if (!url.startsWith(`${origin}/`)) {
      unexpected.push("external request");
      return route.abort();
    }
    const pathname = url.slice(origin.length).split("?")[0];
    if (pathname.startsWith("/api/") || pathname.startsWith("/health")) {
      const body = fixtures[pathname];
      if (route.request().method() !== "GET" || body === undefined) {
        unexpected.push(`${route.request().method()} ${pathname}`);
        return route.abort();
      }
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) });
    }
    return route.continue();
  });
  await page.setViewportSize({ width: 1440, height: 1100 });
  await page.context().addInitScript(() => {
    const language = new URL(location.href).searchParams.get("readmeLocale") ?? "en";
    localStorage.clear();
    sessionStorage.clear();
    localStorage.setItem("llmlab.locale", language);
    localStorage.setItem("llmlab.mode", "local");
    localStorage.setItem("llmlab.theme", "light");
    localStorage.setItem("llmlab.reduceMotion", "true");
    localStorage.setItem("llmlab.selectedModel", "ollama:qwen3.5:2b");
  });
  for (const locale of ["en", "cs"]) {
    await page.context().clearCookies();
    for (const [name, path] of [["overview", "/"], ["rag", "/ai-lab/rag"]]) {
      await page.goto(`${origin}${path}?readmeLocale=${locale}`);
      await page.waitForFunction((language) => document.documentElement.lang === language && document.documentElement.dataset.hydrated === "true", locale);
      await page.getByRole("heading", { level: 1 }).waitFor();
      await page.waitForFunction(() => document.querySelector(".model-picker-current")?.textContent === "qwen3.5:2b");
      await page.getByRole("button", { name: locale === "cs" ? "Obnovit" : "Refresh", exact: true }).waitFor({ state: name === "overview" ? "visible" : "hidden" });
      await page.evaluate(() => document.fonts.ready);
      // Hide the development-only Next.js launcher, which overlaps the footer.
      await page.addStyleTag({ content: "nextjs-portal { display: none; }" });
      if (name === "overview") {
        await page.getByRole("heading", { name: locale === "cs" ? "Zatím tu není žádný běh" : "No runs yet" }).waitFor();
      } else {
        await page.waitForFunction(() => [...document.querySelectorAll("select")].some((select) => select.value === "ollama:all-minilm"));
      }
      if (unexpected.length) throw new Error(`Unmocked requests blocked: ${unexpected.join(", ")}`);
      await page.screenshot({ path: `docs/screenshots/${name}-${locale}.png`, animations: "disabled" });
      console.log(`Captured ${name}-${locale}.png with empty, synthetic lab data`);
    }
  }
}
