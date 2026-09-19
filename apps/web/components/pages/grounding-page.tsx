"use client";

import { CircleHelp, Link2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useApp } from "@/components/app-provider";
import { Notice, PageHeader, Panel, ProvenanceStrip, TableHeading } from "@/components/ui";
import type { RagRunResult } from "@/lib/types";

export function GroundingPage() {
  const { locale } = useApp();
  const [result, setResult] = useState<RagRunResult | null>(null);
  const [selected, setSelected] = useState(0);
  useEffect(() => { queueMicrotask(() => { const raw = localStorage.getItem("llmlab:last-rag"); if (raw) { try { setResult(JSON.parse(raw) as RagRunResult); } catch { localStorage.removeItem("llmlab:last-rag"); } } }); }, []);
  const sentences = result?.answer.split(/(?<=[.!?])\s+/).filter(Boolean) ?? [];
  const source = result?.sources[selected] ?? result?.sources[0];
  return <>
    <PageHeader title={locale === "cs" ? "Grounding skutečného RAG výsledku" : "Grounding a real RAG result"} description={locale === "cs" ? "Tato obrazovka čte poslední výsledek RAG. Automatický claim evaluator zatím není implementovaný a žádné skóre nepředstírá." : "This screen reads the latest RAG result. Automated claim evaluation is not implemented, so no score is fabricated."} helpKey="page.grounding" />
    {!result ? <Notice tone="info" title={locale === "cs" ? "Chybí skutečný výsledek" : "No real result yet"}>{locale === "cs" ? "Nejprve spusť RAG pipeline; tato stránka nemá předvyplněná tvrzení." : "Run the RAG pipeline first; this page has no prefilled claims."}</Notice> : <>
      <ProvenanceStrip mode={result.mode} provider={result.provider} model="not evaluated" tail={`${result.corpus.id} · ${result.sources.length} sources`} />
      <Notice tone="warning" title={locale === "cs" ? "Evaluátor: nevyhodnoceno" : "Evaluator: not evaluated"}>{locale === "cs" ? "Citace a evidence jsou skutečné, ale podpora jednotlivých tvrzení nebyla automaticky klasifikována." : "Citations and evidence are real, but individual claim support has not been automatically classified."}</Notice>
      <div className="grounding-grid">
        <Panel title={locale === "cs" ? "Odpověď generátoru" : "Generator answer"}><article className="annotated-answer">{sentences.map((sentence, index) => <button key={`${sentence}-${index}`} onClick={() => setSelected(Math.min(index, Math.max(0, result.sources.length - 1)))}>{sentence}<sup>{index + 1}</sup></button>)}</article></Panel>
        <Panel title={locale === "cs" ? "Původní anglický důkaz" : "Original English evidence"} aside={<span className="severity severity-medium">not evaluated</span>}>
          {source ? <div className="claim-detail"><CircleHelp className="muted" size={20} /><blockquote>{sentences[selected] ?? result.answer}</blockquote><div className="evidence-link"><Link2 size={15} /><div><strong>{source.document_id} · {source.section}</strong><p>{source.excerpt}</p><small className="mono">{source.path} · fused {source.fused_score.toFixed(4)}</small></div></div></div> : <p>{locale === "cs" ? "Out-of-scope výsledek nemá zdroje." : "An out-of-scope result has no sources."}</p>}
        </Panel>
      </div>
      <Panel title={locale === "cs" ? "Ledger citací" : "Citation ledger"}><div className="table-scroll"><table><thead><tr><TableHeading label="#" /><TableHeading label="Document ID" /><TableHeading label="Section" /><TableHeading label="Path" /><TableHeading label="Evaluation" /></tr></thead><tbody>{result.sources.map((item, index) => <tr key={item.chunk_id} className={selected === index ? "selected-row" : ""} onClick={() => setSelected(index)}><td>{index + 1}</td><td className="mono">{item.document_id}</td><td>{item.section}</td><td className="mono">{item.path}</td><td>not evaluated</td></tr>)}</tbody></table></div></Panel>
    </>}
  </>;
}
