import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AppProvider } from "@/components/app-provider";
import { ArenaPage } from "./arena-page";
import { HistoryPage } from "./history-page";
import { OperationsPage } from "./operations-page";

const models = { models: [
  { key: "ollama:local-a", provider: "ollama", id: "local-a", mode: "local", capabilities: { generation: true }, available: true },
  { key: "openai:cloud-b", provider: "openai", id: "cloud-b", mode: "cloud", capabilities: { generation: true }, available: true },
], providers: [] };

describe("live pages", () => {
  beforeEach(() => { localStorage.clear(); localStorage.setItem("llmlab.locale", "cs"); });
  afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

  it("sends the same arena prompt to two catalog models and splits evidence passages", async () => {
    let posted: Record<string, unknown> | null = null;
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (init?.method === "POST") posted = JSON.parse(String(init.body)) as Record<string, unknown>;
      const data = url.includes("/models") ? models : url.endsWith("/datasets") ? [] : { id: "run_test", kind: "arena", name: "Test", status: "completed", progress: 100, results: [], metrics: { quality_available: false, quality_winner: null } };
      return new Response(JSON.stringify(data), { status: 200 });
    }));
    render(<AppProvider><ArenaPage /></AppProvider>);
    await waitFor(() => expect(screen.getByText("2 vybrané")).toBeInTheDocument());
    fireEvent.change(screen.getByPlaceholderText("Na co se chceš modelů zeptat?"), { target: { value: "Co je token?" } });
    fireEvent.change(screen.getByRole("textbox", { name: /Podklady pro kontrolu tvrzení/ }), { target: { value: "První pasáž.\n\nDruhá pasáž." } });
    fireEvent.click(screen.getByRole("button", { name: "Spustit arénu" }));
    await waitFor(() => expect(posted).not.toBeNull());
    expect(posted).toMatchObject({ kind: "arena", model_keys: ["ollama:local-a", "openai:cloud-b"], prompt: "Co je token?", evidence: ["První pasáž.", "Druhá pasáž."] });
  });

  it("shows an empty history with a route to the first prompt", async () => {
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => new Response(JSON.stringify(String(input).includes("/models") ? models : String(input).includes("/episodes") ? { episodes: [] } : []), { status: 200 })));
    render(<AppProvider><HistoryPage /></AppProvider>);
    expect(await screen.findByText(/Historie je prázdná/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Otevřít Prompt a tokeny" })).toHaveAttribute("href", "/ai-lab/prompt-tokens");
  });

  it("keeps unknown cost calls visible beside the known estimate", async () => {
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      const data = url.includes("/models") ? models : url.includes("/operations/summary") ? { runs: 2, priced_calls: 0, unknown_calls: 2, estimated_usd: 0, input_tokens: 90, output_tokens: 45, by_model: [], by_day: [] } : url.includes("/prices") ? { version: "2026-09-24", currency: "USD", unit: "1M tokens", prices: {} } : [];
      return new Response(JSON.stringify(data), { status: 200 });
    }));
    render(<AppProvider><OperationsPage /></AppProvider>);
    expect(await screen.findByText(/2 volání má neznámou cenu/)).toBeInTheDocument();
    expect(screen.getByText("Známý odhad API poplatků")).toBeInTheDocument();
  });
});
