"use client";

import { Calculator, Info } from "lucide-react";
import { useMemo, useState } from "react";
import { useApp } from "@/components/app-provider";
import { EmbeddingChart } from "@/components/charts";
import { Button, HelpLabel, MetricLabel, PageHeader, Panel, ProgressBar, ProvenanceStrip } from "@/components/ui";

const corpus = [
  { text: "Footwear can be returned within 30 days when unworn.", vector: 0.921, lexical: 0.36, pos: [0.54, 0.48] as [number, number] },
  { text: "Shoes must be new and in their original packaging.", vector: 0.846, lexical: 0.18, pos: [0.37, 0.31] as [number, number] },
  { text: "Refunds are processed in five to seven business days.", vector: 0.612, lexical: 0.09, pos: [-0.06, 0.28] as [number, number] },
  { text: "Standard delivery normally takes three to five days.", vector: 0.288, lexical: 0, pos: [-0.54, -0.41] as [number, number] },
];

export function EmbeddingsPage() {
  const { t } = useApp();
  const [query, setQuery] = useState("How long do I have to send shoes back?");
  const [calculated, setCalculated] = useState(true);
  const points = useMemo(() => [{ name: "Query", value: [0.62, 0.62] as [number, number], score: 1 }, ...corpus.map((item, index) => ({ name: `D${index + 1}`, value: item.pos, score: item.vector }))], []);
  return <>
    <PageHeader title={t("labs.embeddingsTitle")} description={t("labs.embeddingsSubtitle")} helpKey="page.embeddings" />
    <ProvenanceStrip mode="fixture" provider="Fixture engine" model="fixture-embed-v1" tail="dimensions 8 · normalized" />
    <div className="embedding-layout">
      <Panel title={t("labs.query")}>
        <label className="field"><HelpLabel label={t("labs.query")} helpKey="field.embeddingQuery" /><textarea rows={3} value={query} onChange={(event) => setQuery(event.target.value)} /></label>
        <Button onClick={() => { setCalculated(false); window.setTimeout(() => setCalculated(true), 260); }}><Calculator size={15} />{t("labs.calculate")}</Button>
        <div className="vector-preview"><MetricLabel label={t("labs.vectorPreview")} /><code>[0.18, −0.42, 0.71, 0.05, −0.11, 0.34, …]</code></div>
      </Panel>
      <Panel title={t("labs.projectionTitle")} aside={<span className="panel-meta">PCA · demo</span>}><EmbeddingChart points={points} /><p className="method-note"><Info size={13} />{t("labs.projectionNote")}</p></Panel>
    </div>
    <Panel title={t("labs.corpus")} aside={<span className="panel-meta">4 documents · cosine similarity</span>}>
      <div className={`ranking-table ${calculated ? "" : "calculating"}`}><div className="ranking-head"><MetricLabel label={t("labs.rank")} /><MetricLabel label={t("labs.document")} /><MetricLabel label={t("labs.vector")} /><MetricLabel label={t("labs.lexical")} /></div>{corpus.map((item, index) => <div className="ranking-row" key={item.text}><strong className="mono">{index + 1}</strong><p><b>D{index + 1}</b>{item.text}</p><div><strong className="mono">{item.vector.toFixed(3)}</strong><ProgressBar value={item.vector * 100} /></div><div><strong className="mono">{item.lexical.toFixed(2)}</strong><ProgressBar value={item.lexical * 100} tone="gray" /></div></div>)}</div>
    </Panel>
  </>;
}
