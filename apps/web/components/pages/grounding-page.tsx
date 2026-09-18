"use client";

import { Check, CircleAlert, Link2 } from "lucide-react";
import { useState } from "react";
import { useApp } from "@/components/app-provider";
import { MetricLabel, PageHeader, Panel, ProgressBar, ProvenanceStrip, TableHeading } from "@/components/ui";

const claims = [
  { text: "Footwear can be returned within 30 days of delivery.", status: "supported", score: 0.97, source: "returns_footwear.md · lines 12–15" },
  { text: "The product must be unworn and in its original packaging.", status: "supported", score: 0.94, source: "returns_footwear.md · lines 14–16" },
  { text: "Return shipping is always free.", status: "unsupported", score: 0.18, source: "No supporting span retrieved" },
];

export function GroundingPage() {
  const { t, locale } = useApp();
  const [selected, setSelected] = useState(0);
  const claimRows = locale === "cs" ? [
    { ...claims[0], text: "Obuv lze vrátit do 30 dnů od doručení.", source: "returns_footwear.md · řádky 12–15" },
    { ...claims[1], text: "Výrobek musí být nenošený a v původním obalu.", source: "returns_footwear.md · řádky 14–16" },
    { ...claims[2], text: "Zpáteční doprava je vždy zdarma.", source: "Nebyl nalezen podpůrný úsek" },
  ] : claims;
  const claim = claimRows[selected];
  return <>
    <PageHeader title={t("labs.groundingTitle")} description={t("labs.groundingSubtitle")} helpKey="page.grounding" />
    <ProvenanceStrip mode="fixture" provider="Fixture evaluator" model="faithfulness-v1" tail="3 claims · support-v4" />
    <div className="grounding-summary"><Score label={t("labs.claimSupport")} value="0.76" percent={76} /><Score label={t("labs.citationPrecision")} value="0.91" percent={91} /><Score label={t("labs.answerRelevance")} value="0.95" percent={95} /><div className="risk-cell"><MetricLabel label={t("labs.hallucinationRisk")} /><strong>{t("labs.medium")}</strong><small>{t("labs.unsupportedCount")}</small></div></div>
    <div className="grounding-grid">
      <Panel title={t("labs.generatedAnswer")}>{locale === "cs" ? <article className="annotated-answer">Obuv lze vrátit <button onClick={() => setSelected(0)}>do 30 dnů od doručení<sup>1</sup></button>. Musí být <button onClick={() => setSelected(1)}>nenošená a v původním obalu<sup>2</sup></button>. <button className="unsupported-text" onClick={() => setSelected(2)}>Zpáteční doprava je vždy zdarma.<sup>3</sup></button></article> : <article className="annotated-answer">Footwear can be returned <button onClick={() => setSelected(0)}>within 30 days of delivery<sup>1</sup></button>. It must be <button onClick={() => setSelected(1)}>unworn and in the original packaging<sup>2</sup></button>. <button className="unsupported-text" onClick={() => setSelected(2)}>Return shipping is always free.<sup>3</sup></button></article>}<div className="legend"><span><i className="supported-dot" />{t("rag.supported")}</span><span><i className="unsupported-dot" />{t("rag.unsupported")}</span></div></Panel>
      <Panel title={t("labs.claim")} aside={<span className={`severity severity-${claim.status === "supported" ? "low" : "high"}`}>{t(`rag.${claim.status}`)}</span>}>
        <div className="claim-detail"><div className={claim.status === "supported" ? "claim-icon success" : "claim-icon danger"}>{claim.status === "supported" ? <Check size={20} /> : <CircleAlert size={20} />}</div><blockquote>{claim.text}</blockquote><span>{t("labs.confidence")} <strong className="mono">{claim.score.toFixed(2)}</strong></span><ProgressBar value={claim.score * 100} tone={claim.status === "supported" ? "green" : "red"} /><div className="evidence-link"><Link2 size={15} /><div><strong>{claim.source}</strong><p>{claim.status === "supported" ? "Footwear items may be returned within 30 days of delivery, provided they are new and unworn…" : "The retrieved documents define eligibility but do not promise free return shipping."}</p></div></div></div>
      </Panel>
    </div>
    <Panel title={t("labs.claimLedger")}><div className="table-scroll"><table><thead><tr><TableHeading label="#" /><TableHeading label={t("labs.claim")} /><TableHeading label={t("labs.finding")} /><TableHeading label={t("labs.confidence")} /><TableHeading label={t("labs.sourceEvidence")} /></tr></thead><tbody>{claimRows.map((item, index) => <tr key={item.text} className={selected === index ? "selected-row" : ""} onClick={() => setSelected(index)}><td className="mono">{index + 1}</td><td>{item.text}</td><td><span className={`status-text ${item.status === "supported" ? "success" : "danger"}`}>{item.status === "supported" ? <Check size={12} /> : <CircleAlert size={12} />}{t(`rag.${item.status}`)}</span></td><td className="mono">{item.score.toFixed(2)}</td><td>{item.source}</td></tr>)}</tbody></table></div></Panel>
  </>;
}

function Score({ label, value, percent }: { label: string; value: string; percent: number }) { return <div><MetricLabel label={label} /><strong className="mono">{value}</strong><ProgressBar value={percent} tone="green" /></div>; }
