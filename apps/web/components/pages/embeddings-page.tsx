"use client";

import { Calculator } from "lucide-react";
import { useEffect, useState } from "react";
import { useApp } from "@/components/app-provider";
import { Button, HelpLabel, Notice, PageHeader, Panel, ProgressBar, ProvenanceStrip } from "@/components/ui";
import type { RagSearchResult, RagStatus } from "@/lib/types";

export function EmbeddingsPage() {
  const { locale } = useApp();
  const [query, setQuery] = useState("Jak dlouho můžu vrátit běžné zařízení?");
  const [status, setStatus] = useState<RagStatus | null>(null);
  const [results, setResults] = useState<RagSearchResult[]>([]);
  const [language, setLanguage] = useState("—");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => { fetch("/api/v1/rag/status").then(async (response) => { if (!response.ok) throw new Error(await response.text()); return response.json(); }).then((data: RagStatus) => setStatus(data)).catch(() => setError("RAG status unavailable")); }, []);
  const calculate = async () => {
    setLoading(true); setError(""); setResults([]); setLanguage("—");
    try {
      const response = await fetch("/api/v1/rag/search", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ question: query, top_k: 8 }) });
      if (!response.ok) throw new Error(await searchError(response));
      const payload = await response.json() as { query_language: string; results: RagSearchResult[] };
      setLanguage(payload.query_language); setResults(payload.results);
    } catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)); }
    finally { setLoading(false); }
  };
  return <>
    <PageHeader title={locale === "cs" ? "Embeddingy a hybridní retrieval" : "Embeddings and hybrid retrieval"} description={locale === "cs" ? "Porovnej skutečnou dense podobnost, BM25 a výsledné vážené skóre nad anglickým corpusem." : "Compare real dense similarity, BM25, and the final weighted score over the English corpus."} helpKey="page.embeddings" />
    {status && <ProvenanceStrip mode="fixture" provider="Real local index" model={status.embedding_model} tail={`${status.vector_dimensions} dimensions · ${status.chunk_count} chunks`} />}
    {error && <Notice tone="danger" title="Search unavailable">{error}</Notice>}
    <Panel title={locale === "cs" ? "Dotaz" : "Query"}>
      <div className="embedding-query"><label className="field"><HelpLabel label={locale === "cs" ? "Český nebo anglický dotaz" : "Czech or English query"} /><textarea rows={3} maxLength={2000} value={query} onChange={(event) => { setQuery(event.target.value); setResults([]); setLanguage("—"); setError(""); }} /></label><Button loading={loading} onClick={() => void calculate()}><Calculator size={15} />{locale === "cs" ? "Spočítat" : "Calculate"}</Button></div>
      <div className="score-ledger"><div><span>language</span><strong className="mono">{language}</strong></div><div><span>model</span><strong className="mono">{status?.embedding_model ?? "…"}</strong></div><div><span>dimensions</span><strong className="mono">{status?.vector_dimensions ?? "…"}</strong></div><div><span>projection</span><strong className="mono">not shown</strong></div></div>
    </Panel>
    <Panel title={locale === "cs" ? "Pořadí skutečných chunků" : "Real chunk ranking"} aside={<span className="panel-meta">dense {Math.round((status?.dense_weight ?? 0) * 100)}% · BM25 {Math.round((status?.lexical_weight ?? 0) * 100)}%</span>}>
      {!results.length ? <div className="rag-empty"><p>{locale === "cs" ? "Výsledky vzniknou až po skutečném API požadavku." : "Results appear only after a real API request."}</p></div> : <div className="ranking-table"><div className="ranking-head rag-ranking"><span>#</span><span>Chunk</span><span>Dense</span><span>BM25</span><span>Fused</span></div>{results.map((item, index) => <div className="ranking-row rag-ranking" key={item.chunk_id}><strong className="mono">{index + 1}</strong><p><b>{item.document_id} · {item.section}</b><small className="mono">{item.path}</small>{item.excerpt}</p><Score value={item.dense_score} /><Score value={item.lexical_score} /><Score value={item.fused_score} /></div>)}</div>}
    </Panel>
  </>;
}

function Score({ value }: { value: number }) { return <div><strong className="mono">{value.toFixed(4)}</strong><ProgressBar value={value * 100} /></div>; }

async function searchError(response: Response): Promise<string> {
  try {
    const payload = await response.json() as { detail?: unknown };
    if (typeof payload.detail === "string") return payload.detail;
  } catch {
    // A concise status is clearer than proxy HTML or an empty body.
  }
  return `Search failed (${response.status})`;
}
