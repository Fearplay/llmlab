import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AppProvider } from "@/components/app-provider";
import { RagPage } from "./rag-page";
import { splitGroundedClaims } from "./grounding-page";
import { isStructuredOutputValid, tokenizePreview } from "./prompt-tokens-page";
import type { RagRunResult, RagStatus } from "@/lib/types";

const status: RagStatus = {
  ready: true,
  corpus_id: "atlas-works-en",
  corpus_version: "1.0",
  synthetic: true,
  document_count: 16,
  chunk_count: 95,
  embedding_model: "llmlab/multilingual-hash-v1",
  requested_embedding_model: "BAAI/bge-m3",
  embedding_warning: "BGE-M3 unavailable; offline fallback active.",
  vector_dimensions: 384,
  indexed_at: "2026-09-19T12:00:00Z",
  fingerprint: "sha256:test",
  reranker_enabled: false,
  reranker_model: "BAAI/bge-reranker-v2-m3",
  local_generation_model: "qwen3.5:9b",
  dense_weight: 0.85,
  lexical_weight: 0.15,
  score_threshold: 0.3,
  documents: [],
};

const grounded: RagRunResult = {
  answer: "Běžné zařízení lze vrátit do 21 kalendářních dnů od doručení. [ATLAS-RETURNS-001, Standard returns]",
  question: "Jak dlouho můžu vrátit běžné zařízení?",
  query_language: "cs",
  mode: "fixture",
  provider: "fixture",
  model: "fixture-grounded-v2",
  fixture: true,
  corpus: { id: "atlas-works-en", version: "1.0", synthetic: true },
  retrieval: { embedding_model: "llmlab/multilingual-hash-v1", vector_dimensions: 384, top_k: 5, score_threshold: 0.14, generation_skipped: false, dense_weight: 0.85, lexical_weight: 0.15, reranker_enabled: false },
  results: [{ chunk_id: "ATLAS-RETURNS-001::standard-returns::0001", document_id: "ATLAS-RETURNS-001", title: "Returns and Refunds Policy", section: "Standard returns", path: "knowledge/en/returns.md", language: "en", version: "1.0", synthetic: true, excerpt: "Standard hardware can be returned within 21 calendar days of delivery.", dense_score: 0.61, lexical_score: 0, fused_score: 0.5185, reranker_score: null }],
  sources: [{ chunk_id: "ATLAS-RETURNS-001::standard-returns::0001", document_id: "ATLAS-RETURNS-001", title: "Returns and Refunds Policy", section: "Standard returns", path: "knowledge/en/returns.md", language: "en", version: "1.0", synthetic: true, excerpt: "Standard hardware can be returned within 21 calendar days of delivery.", dense_score: 0.61, lexical_score: 0, fused_score: 0.5185, reranker_score: null, score: 0.5185 }],
  context: "[ATLAS-RETURNS-001, Standard returns] Standard hardware can be returned within 21 calendar days of delivery.",
  final_prompt: "SYSTEM grounded prompt",
  usage: { input_tokens: 80, output_tokens: 22, cached_tokens: 0, cost_usd: 0 },
  timings_ms: { parse: 2, chunk: 1, embed: 4, retrieve: 3, generate: 1 },
  latency_ms: 11,
};

describe("RagPage", () => {
  beforeEach(() => { localStorage.clear(); localStorage.setItem("llmlab.locale", "cs"); });
  afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

  it("loads real status and renders a Czech answer with English evidence", async () => {
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => new Response(JSON.stringify(String(input).endsWith("/status") ? status : grounded), { status: 200, headers: { "Content-Type": "application/json" } })));
    render(<AppProvider><RagPage /></AppProvider>);
    await waitFor(() => expect(screen.getAllByText(/atlas-works-en/).length).toBeGreaterThan(0));
    fireEvent.click(await screen.findByRole("button", { name: /Spustit skutečnou pipeline/i }));
    expect(await screen.findByText(/Běžné zařízení lze vrátit do 21/)).toBeInTheDocument();
    expect(screen.getAllByText(/Standard hardware can be returned within 21/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/knowledge\/en\/returns.md/).length).toBeGreaterThan(0);
  });

  it("shows an out-of-scope refusal and that generation was skipped", async () => {
    const refused = { ...grounded, answer: "Tuto informaci nelze z dostupné znalostní báze určit.", results: [], sources: [], context: "", retrieval: { ...grounded.retrieval, generation_skipped: true } };
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => new Response(JSON.stringify(String(input).endsWith("/status") ? status : refused), { status: 200, headers: { "Content-Type": "application/json" } })));
    render(<AppProvider><RagPage /></AppProvider>);
    fireEvent.click(await screen.findByRole("button", { name: /Spustit skutečnou pipeline/i }));
    await waitFor(() => expect(screen.getAllByText(/Tuto informaci nelze/).length).toBeGreaterThan(0));
    await waitFor(() => expect(screen.getByText(/Generátor nebyl zavolán/)).toBeInTheDocument());
  });

  it("clears stale results when the execution mode changes", async () => {
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => new Response(JSON.stringify(String(input).endsWith("/status") ? status : grounded), { status: 200, headers: { "Content-Type": "application/json" } })));
    render(<AppProvider><RagPage /></AppProvider>);
    fireEvent.click(await screen.findByRole("button", { name: /Spustit skutečnou pipeline/i }));
    expect(await screen.findByText(/Běžné zařízení lze vrátit do 21/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Lokálně" }));
    expect(screen.queryByText(/Běžné zařízení lze vrátit do 21/)).not.toBeInTheDocument();
    expect(screen.getAllByText(/Výsledky nejsou předvyplněné/).length).toBeGreaterThan(0);
  });

  it("does not present an unknown cloud price as zero cost", async () => {
    const cloudResult: RagRunResult = {
      ...grounded,
      mode: "cloud",
      provider: "openai",
      model: "gpt-5.4-mini",
      fixture: false,
      usage: { ...grounded.usage, cost_usd: null },
    };
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => new Response(JSON.stringify(String(input).endsWith("/status") ? status : cloudResult), { status: 200, headers: { "Content-Type": "application/json" } })));
    render(<AppProvider><RagPage /></AppProvider>);
    fireEvent.click(await screen.findByRole("button", { name: /Cloud/ }));
    fireEvent.click(screen.getByRole("button", { name: /Spustit skutečnou pipeline/i }));
    expect(await screen.findByText(/cena nedostupná/i)).toBeInTheDocument();
    expect(screen.queryByText(/\$0/)).not.toBeInTheDocument();
  });
});

describe("Grounding claim parsing", () => {
  it("keeps a document citation attached to its factual sentence", () => {
    expect(splitGroundedClaims("A refund takes five business days. [ATLAS-RETURNS-001, Refund processing]")).toEqual([
      "A refund takes five business days. [ATLAS-RETURNS-001, Refund processing]",
    ]);
  });
});

describe("Prompt token preview", () => {
  it("keeps Czech words with diacritics intact", () => {
    expect(tokenizePreview("Zařízení má čtrnáctidenní lhůtu.")).toEqual([
      "Zařízení", "má", "čtrnáctidenní", "lhůtu", ".",
    ]);
  });

  it("does not label plain text as schema-valid", () => {
    expect(isStructuredOutputValid("plain text")).toBe(false);
    expect(isStructuredOutputValid('{"answer":"ok","citations":[],"confidence":null}')).toBe(true);
  });
});
