import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AppProvider } from "@/components/app-provider";
import { PromptTokensPage } from "./prompt-tokens-page";

const catalog = { models: [{ key: "ollama:qwen-test", provider: "ollama", id: "qwen-test", mode: "local", capabilities: { generation: true, structured_output: true }, available: true, context_window: 8192 }], providers: [] };
const answer = { text: "A context window limits the text a model can use.", provider: "ollama", model: "qwen-test", mode: "local", usage: { input_tokens: 18, output_tokens: 11, cached_tokens: 0, cost_usd: null }, latency_ms: 47, fixture: false, run_id: "run_test" };

describe("PromptTokensPage", () => {
  beforeEach(() => { localStorage.clear(); localStorage.setItem("llmlab.locale", "cs"); localStorage.setItem("llmlab.mode", "local"); });
  afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

  it("uses an installed model and sends all visible generation controls", async () => {
    const calls: Array<{ url: string; body: Record<string, unknown> }> = [];
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (init?.body) calls.push({ url, body: JSON.parse(String(init.body)) as Record<string, unknown> });
      return new Response(JSON.stringify(url.includes("/models") ? catalog : answer), { status: 200, headers: { "Content-Type": "application/json" } });
    }));
    render(<AppProvider><PromptTokensPage /></AppProvider>);
    expect(await screen.findByText("ollama / qwen-test")).toBeInTheDocument();
    fireEvent.change(screen.getByPlaceholderText("Zeptej se modelu na cokoliv…"), { target: { value: "Co je kontextové okno?" } });
    fireEvent.change(screen.getByRole("slider", { name: "Teplota" }), { target: { value: "0.7" } });
    fireEvent.change(screen.getByRole("spinbutton", { name: "Maximum výstupních tokenů" }), { target: { value: "256" } });
    fireEvent.change(screen.getByPlaceholderText("Volitelné, například <END>"), { target: { value: "<END>" } });
    fireEvent.click(screen.getByRole("button", { name: "Spustit" }));
    expect(await screen.findByText(/A context window limits/)).toBeInTheDocument();
    const request = calls.find((item) => item.url.endsWith("/generation"))?.body;
    expect(request).toMatchObject({ mode: "local", provider: "ollama", model: "qwen-test", temperature: 0.7, top_p: 1, max_tokens: 256, stop: ["<END>"] });
    expect(screen.getByText("18 tokenů")).toBeInTheDocument();
  });

  it("asks the schema evaluator rather than treating any JSON object as valid", async () => {
    const calls: string[] = [];
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (init?.body) calls.push(url);
      const body = url.includes("/models") ? catalog : url.endsWith("/evaluations") ? { passed: false } : { ...answer, text: '{"wrong":"shape"}' };
      return new Response(JSON.stringify(body), { status: 200, headers: { "Content-Type": "application/json" } });
    }));
    render(<AppProvider><PromptTokensPage /></AppProvider>);
    await screen.findByText("ollama / qwen-test");
    fireEvent.change(screen.getByPlaceholderText("Zeptej se modelu na cokoliv…"), { target: { value: "Odpověz jako JSON." } });
    fireEvent.click(screen.getByRole("checkbox", { name: /Vyžadovat strukturovaný výstup/ }));
    fireEvent.click(screen.getByRole("button", { name: "Spustit" }));
    await waitFor(() => expect(calls).toContain("/api/v1/evaluations"));
    expect(await screen.findByText("Neplatné")).toBeInTheDocument();
  });
});
