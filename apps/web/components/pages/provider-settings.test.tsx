import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AppProvider, useApp } from "@/components/app-provider";
import { ProvidersPage } from "./providers-page";
import { SettingsPage } from "./settings-page";

const catalog = { models: [{ key: "ollama:qwen", provider: "ollama", id: "qwen", mode: "local", capabilities: { generation: true, embeddings: false }, available: true }], providers: [
  { id: "ollama", mode: "local", configured: true, reachable: true, detail: "1 models" },
  { id: "openai", mode: "cloud", configured: false, reachable: false, detail: "Provider is not configured" },
] };

describe("provider settings", () => {
  beforeEach(() => { localStorage.clear(); localStorage.setItem("llmlab.locale", "cs"); });
  afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

  it("shows actual catalog reachability and installed models without demo providers", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify(catalog), { status: 200 })));
    render(<AppProvider><ProvidersPage /></AppProvider>);
    expect(await screen.findByText("qwen")).toBeInTheDocument();
    expect(screen.getByText("Připojeno")).toBeInTheDocument();
    expect(screen.getByText("Nenastaveno")).toBeInTheDocument();
    expect(screen.queryByText("Fixture engine")).not.toBeInTheDocument();
  });

  it("updates the shared model picker catalog when the providers page reconnects", async () => {
    const cloudCatalog = {
      models: [...catalog.models, { key: "openai:gpt-test", provider: "openai", id: "gpt-test", mode: "cloud", capabilities: { generation: true }, available: true }],
      providers: [...catalog.providers.slice(0, 1), { id: "openai", mode: "cloud", configured: true, reachable: true, detail: "1 models" }],
    };
    let sharedRequests = 0;
    vi.stubGlobal("fetch", vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      const sharedCatalog = init?.cache === "no-store";
      if (sharedCatalog) sharedRequests += 1;
      return new Response(JSON.stringify(sharedCatalog && sharedRequests === 1 ? catalog : cloudCatalog), { status: 200 });
    }));
    function CloudModelCount() {
      const { models } = useApp();
      return <span data-testid="cloud-model-count">{models.filter((model) => model.provider === "openai").length}</span>;
    }
    render(<AppProvider><ProvidersPage /><CloudModelCount /></AppProvider>);
    await waitFor(() => expect(screen.getByTestId("cloud-model-count")).toHaveTextContent("1"));
    expect(sharedRequests).toBeGreaterThanOrEqual(2);
  });

  it("saves a key through local API, clears the input, and never renders the saved value", async () => {
    let saved = false;
    let sent: unknown = null;
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.includes("/settings/providers/openai") && init?.method === "PUT") { sent = JSON.parse(String(init.body)); saved = true; return new Response(JSON.stringify({ provider: "openai", configured: true, source: "keyring" }), { status: 200 }); }
      if (url.includes("/settings/providers")) return new Response(JSON.stringify({ keyring_available: true, providers: { openai: { configured: saved, source: saved ? "keyring" : "missing" }, anthropic: { configured: false, source: "missing" }, gemini: { configured: false, source: "missing" }, openai_compatible: { configured: false, source: "missing" } } }), { status: 200 });
      return new Response(JSON.stringify(catalog), { status: 200 });
    }));
    render(<AppProvider><SettingsPage /></AppProvider>);
    const input = (await screen.findAllByPlaceholderText("Vlož API klíč"))[0];
    fireEvent.change(input, { target: { value: "test-secret-do-not-render" } });
    fireEvent.click(screen.getAllByRole("button", { name: /^Uložit$/ })[0]);
    await waitFor(() => expect(sent).toEqual({ value: "test-secret-do-not-render" }));
    await waitFor(() => expect(input).toHaveValue("") );
    expect(screen.queryByText("test-secret-do-not-render")).not.toBeInTheDocument();
  });

  it("explains the .env fallback when the system credential store is unavailable", async () => {
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => new Response(JSON.stringify(String(input).includes("/settings/providers") ? { keyring_available: false, providers: { openai: { configured: false, source: "missing" } } } : catalog), { status: 200 })));
    render(<AppProvider><SettingsPage /></AppProvider>);
    expect(await screen.findByText(/Nastav OPENAI_API_KEY v souboru .env/)).toBeInTheDocument();
    expect(screen.queryByPlaceholderText("Vlož API klíč")).not.toBeInTheDocument();
  });
});
