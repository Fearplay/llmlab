"use client";

import { Database, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useApp } from "@/components/app-provider";
import { Button, Notice, PageHeader, Panel, ProvenanceStrip, TableHeading } from "@/components/ui";
import type { RagStatus } from "@/lib/types";

export function KnowledgeBasePage() {
  const { locale } = useApp();
  const [status, setStatus] = useState<RagStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [rebuilding, setRebuilding] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    setLoading(true); setError("");
    try { const response = await fetch("/api/v1/rag/status"); if (!response.ok) throw new Error(await response.text()); setStatus(await response.json() as RagStatus); }
    catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { queueMicrotask(() => void load()); }, [load]);
  const rebuild = async () => {
    setRebuilding(true); setMessage(""); setError("");
    try { const response = await fetch("/api/v1/rag/reindex", { method: "POST" }); if (!response.ok) throw new Error(await response.text()); setStatus(await response.json() as RagStatus); setMessage(locale === "cs" ? "Index byl bezpečně přegenerován." : "Index rebuilt safely."); }
    catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)); }
    finally { setRebuilding(false); }
  };
  return <>
    <PageHeader title={locale === "cs" ? "Znalostní báze" : "Knowledge Base"} description={locale === "cs" ? "Trackované anglické Markdown dokumenty, které skutečně vstupují do indexu." : "Tracked English Markdown documents that actually enter the index."} actions={<Button loading={rebuilding} onClick={() => void rebuild()}><RefreshCw size={14} />{locale === "cs" ? "Přegenerovat index" : "Rebuild index"}</Button>} />
    {error && <Notice tone="danger" title={locale === "cs" ? "Index není dostupný" : "Index unavailable"}>{error}</Notice>}
    {message && <Notice tone="success" title={locale === "cs" ? "Hotovo" : "Complete"}>{message}</Notice>}
    {status && <ProvenanceStrip mode="fixture" provider="Local vector index" model={status.embedding_model} tail={`${status.corpus_id} · ${status.fingerprint.slice(0, 19)}…`} />}
    <div className="kb-summary">
      <Summary icon={<Database size={18} />} label="Corpus" value={status?.corpus_id ?? (loading ? "…" : "—")} />
      <Summary label={locale === "cs" ? "Dokumenty / chunky" : "Documents / chunks"} value={status ? `${status.document_count} / ${status.chunk_count}` : "…"} />
      <Summary label="Embedding" value={status?.embedding_model ?? "…"} />
      <Summary label={locale === "cs" ? "Indexováno" : "Indexed"} value={status ? new Date(status.indexed_at).toLocaleString(locale) : "…"} />
    </div>
    <Panel title={locale === "cs" ? "Indexované dokumenty" : "Indexed documents"} aside={<span className="synthetic-badge">synthetic demonstration corpus</span>}>
      <div className="table-scroll"><table><thead><tr><TableHeading label="Document ID" /><TableHeading label="Title" /><TableHeading label="Lang" /><TableHeading label="Version" /><TableHeading label="Status" /><TableHeading label="Chunks" /><TableHeading label="Repository path" /></tr></thead><tbody>{status?.documents.map((document) => <tr key={document.document_id}><td className="mono">{document.document_id}</td><td>{document.title}</td><td className="mono">{document.language}</td><td className="mono">{document.version}</td><td><span className="status-text success">{document.status}</span></td><td className="mono">{document.chunk_count}</td><td className="mono">{document.path}</td></tr>)}</tbody></table></div>
    </Panel>
    {status && <Panel title={locale === "cs" ? "Otisk indexu" : "Index fingerprint"}><dl className="definition-list"><div><dt>fingerprint</dt><dd className="mono fingerprint">{status.fingerprint}</dd></div><div><dt>requested model</dt><dd className="mono">{status.requested_embedding_model}</dd></div><div><dt>actual model</dt><dd className="mono">{status.embedding_model}</dd></div><div><dt>dimensions</dt><dd className="mono">{status.vector_dimensions}</dd></div></dl></Panel>}
  </>;
}

function Summary({ icon, label, value }: { icon?: React.ReactNode; label: string; value: string }) { return <div>{icon}<span>{label}</span><strong className="mono">{value}</strong></div>; }
