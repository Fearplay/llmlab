import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AppProvider } from "@/components/app-provider";
import { RagPage } from "./rag-page";
import { isStructuredOutputValid, tokenizePreview } from "./prompt-tokens-page";

const document = { id: "doc_one", name: "policy.txt", media_type: "txt", strategy: "fixed", chunk_size: 450, overlap: 80, embedding_model_key: "ollama:all-minilm:latest", chunk_count: 1, created_at: "2026-09-24T12:00:00Z" };
const source = { marker: "[1]", chunk_id: "chk_one", document_id: "doc_one", document_name: "policy.txt", text: "Standard hardware can be returned within 21 calendar days.", start: 0, end: 58, page: null, score: 0.9, dense_score: 0.9, bm25_score: null };
const answer = { answer: "Běžné zařízení lze vrátit do 21 dní. [1]", question: "Jaká je lhůta?", sources: [source], citations: [source], citation_markers_valid: true, grounding_status: "citations_present_unverified", citation_warning: null, usage: { input_tokens: 80, output_tokens: 20 }, model_key: "ollama:qwen3.5:9b", run_id: "run_one", latency_ms: 123, retrieval: { hits: [source] } };
const models = { models: [
  { key: "ollama:all-minilm:latest", provider: "ollama", id: "all-minilm:latest", mode: "local", capabilities: { generation: false, embeddings: true }, available: true },
  { key: "ollama:qwen3.5:9b", provider: "ollama", id: "qwen3.5:9b", mode: "local", capabilities: { generation: true, embeddings: false }, available: true },
] };

function mockFetch(documents: unknown[] = [document]) {
  vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    const payload = url.includes("/api/v1/models") ? models : url.endsWith("/user-documents") ? { documents } : url.endsWith("/user-rag/ask") ? answer : {};
    return new Response(JSON.stringify(payload), { status: 200, headers: { "Content-Type": "application/json" } });
  }));
}

describe("RagPage", () => {
  beforeEach(() => { localStorage.clear(); localStorage.setItem("llmlab.locale", "cs"); });
  afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

  it("starts with an empty document state instead of a prefilled sample", async () => {
    mockFetch([]);
    render(<AppProvider><RagPage /></AppProvider>);
    expect(await screen.findByText("Zatím žádný dokument")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Vyhledat a odpovědět/i })).toBeDisabled();
    fireEvent.change(screen.getByRole("textbox", { name: "Text dokumentu" }), { target: { value: "Text pro nový RAG dokument." } });
    expect(screen.getByText("Text z kroku 1 ještě není indexovaný")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Indexovat text z kroku 1" })).toBeInTheDocument();
  });

  it("answers using a selected document and shows the exact cited excerpt", async () => {
    mockFetch();
    render(<AppProvider><RagPage /></AppProvider>);
    await screen.findByText("policy.txt");
    fireEvent.change(screen.getByPlaceholderText(/Jaké jsou podmínky vrácení/i), { target: { value: "Jaká je lhůta?" } });
    fireEvent.click(await screen.findByRole("button", { name: /Vyhledat a odpovědět/i }));
    expect(await screen.findByText(/Běžné zařízení lze vrátit do 21 dní/)).toBeInTheDocument();
    expect(screen.getByText(/Standard hardware can be returned within 21/)).toBeInTheDocument();
    expect(screen.getByText(/Pravdivost jednotlivých tvrzení ověřte/)).toBeInTheDocument();
    await waitFor(() => expect((fetch as ReturnType<typeof vi.fn>).mock.calls.some(([url]) => String(url).endsWith("/user-rag/ask"))).toBe(true));
  });

  it("loads the long example into step 2 and makes it available to questions", async () => {
    const sampleText = "Atlas Works support policy. ".repeat(12);
    const pastedDocument = { ...document, id: "doc_pasted", name: "Atlas Works example", chunk_count: 2 };
    const chunks = [
      { id: "chk_a", text: sampleText.slice(0, 160), start: 0, end: 160, page: null },
      { id: "chk_b", text: sampleText.slice(150), start: 150, end: sampleText.length, page: null },
    ];
    let saved = false;
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const payload = url.includes("/api/v1/models") ? models
        : url.endsWith("/user-rag/sample-text") ? { name: pastedDocument.name, text: sampleText }
          : url.endsWith("/user-documents/text/preview") ? { chunks }
            : url.endsWith("/user-documents/text") && init?.method === "POST" ? (saved = true, { document: pastedDocument })
              : url.endsWith("/user-documents") ? { documents: saved ? [pastedDocument] : [] }
                : url.endsWith("/user-documents/doc_pasted/chunks") ? { document: pastedDocument, chunks }
                  : {};
      return new Response(JSON.stringify(payload), { status: url.endsWith("/user-documents/text") ? 201 : 200, headers: { "Content-Type": "application/json" } });
    });
    vi.stubGlobal("fetch", fetchMock);
    render(<AppProvider><RagPage /></AppProvider>);
    const loadExample = await screen.findByRole("button", { name: "Načíst a indexovat příklad" });
    await waitFor(() => expect(loadExample).toBeEnabled());
    fireEvent.click(loadExample);
    expect(await screen.findByDisplayValue(pastedDocument.name)).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Text dokumentu" })).toHaveValue(sampleText);
    expect(await screen.findByText("Indexované chunky")).toBeInTheDocument();
    expect(screen.getByText(/překryv 10/)).toBeInTheDocument();
    expect(screen.queryByText("Zatím žádný dokument")).not.toBeInTheDocument();
    expect(fetchMock.mock.calls.some(([url]) => String(url).endsWith("/user-documents/text/preview"))).toBe(true);
    const createCall = fetchMock.mock.calls.find(([url, init]) => String(url).endsWith("/user-documents/text") && init?.method === "POST");
    expect(createCall).toBeDefined();
    expect(JSON.parse(String(createCall?.[1]?.body))).toMatchObject({ name: pastedDocument.name, text: sampleText });
    expect(screen.getByText(/znaky 150–/)).toBeInTheDocument();
    fireEvent.change(screen.getByRole("textbox", { name: "Otázka" }), { target: { value: "What does Atlas Works do?" } });
    expect(screen.getByRole("button", { name: "Vyhledat a odpovědět" })).toBeEnabled();
  });
});

describe("Prompt token preview", () => {
  it("keeps Czech words with diacritics intact", () => {
    expect(tokenizePreview("Zařízení má čtrnáctidenní lhůtu.")).toEqual(["Zařízení", "má", "čtrnáctidenní", "lhůtu", "."]);
  });
  it("does not label plain text as schema-valid", () => {
    expect(isStructuredOutputValid("plain text")).toBe(false);
    expect(isStructuredOutputValid('{"answer":"ok","citations":[],"confidence":null}')).toBe(true);
  });
});
