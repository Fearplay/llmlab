"use client";

import { Check, ChevronLeft, ChevronRight, ThumbsDown, ThumbsUp } from "lucide-react";
import { useState } from "react";
import { useApp } from "@/components/app-provider";
import { Button, HelpLabel, InfoTip, MetricLabel, PageHeader, Panel, ProgressBar, ProvenanceStrip } from "@/components/ui";
import { compareCases } from "@/lib/fixtures";

export function ReviewsPage() {
  const { t } = useApp();
  const [index, setIndex] = useState(0);
  const [verdict, setVerdict] = useState<"good" | "bad" | null>(null);
  const [saved, setSaved] = useState(false);
  const item = compareCases[index];
  return <>
    <PageHeader title={t("reviews.title")} description={t("reviews.subtitle")} />
    <ProvenanceStrip mode="fixture" provider="Human review queue" model="judge-medium" tail={`run_0191 · ${compareCases.length} cases`} />
    <div className="review-toolbar"><div><span>{t("reviews.queue")}</span><strong className="mono">{index + 1} / {compareCases.length}</strong><ProgressBar value={(index + 1) / compareCases.length * 100} /></div><div className="pager"><Button variant="secondary" disabled={index === 0} onClick={() => { setIndex(index - 1); setVerdict(null); setSaved(false); }}><ChevronLeft size={14} />{t("reviews.previous")}</Button><Button variant="secondary" disabled={index === compareCases.length - 1} onClick={() => { setIndex(index + 1); setVerdict(null); setSaved(false); }}>{t("reviews.next")}<ChevronRight size={14} /></Button></div></div>
    <div className="review-layout">
      <Panel title={`${item.id} · ${item.slice}`}>
        <ReviewBlock label="User prompt" text={item.prompt} />
        <ReviewBlock label={t("reviews.correctness")} text={item.candidateOutput} candidate />
        <ReviewBlock label={t("reviews.expectedBehavior")} text={item.expected} />
        <ReviewBlock label={t("reviews.sourceEvidence")} text={item.source} evidence />
      </Panel>
      <Panel title={t("reviews.judgment")}>
        <p className="review-question">{t("reviews.question")}</p>
        <div className="verdict-buttons"><button className={verdict === "good" ? "selected good" : ""} onClick={() => { setVerdict("good"); setSaved(false); }}><ThumbsUp size={20} /><strong>{t("reviews.good")}</strong><span>{t("reviews.goodHint")}</span></button><button className={verdict === "bad" ? "selected bad" : ""} onClick={() => { setVerdict("bad"); setSaved(false); }}><ThumbsDown size={20} /><strong>{t("reviews.bad")}</strong><span>{t("reviews.badHint")}</span></button></div>
        <label className="field"><HelpLabel label={t("reviews.comment")} helpKey="field.reviewComment" /><textarea rows={5} defaultValue="Candidate contradicts the documented 30-day return window." /></label>
        <div className="judge-finding"><MetricLabel label={t("reviews.modelJudge")} /><strong className="status-text danger">{t("common.fail")} · 0.96 {t("labs.confidence")}</strong><p>{item.evidence}</p></div>
        {saved && <div className="success-message"><Check size={16} />{t("reviews.saved")}</div>}
        <Button disabled={!verdict} onClick={() => setSaved(true)}>{t("reviews.submit")}</Button>
      </Panel>
    </div>
    <Panel title={t("reviews.agreement")}><div className="agreement-row"><strong className="mono">87.4%</strong><ProgressBar value={87.4} tone="green" /><span>{t("reviews.disagreement")}</span></div></Panel>
  </>;
}

function ReviewBlock({ label, text, candidate, evidence }: { label: string; text: string; candidate?: boolean; evidence?: boolean }) { return <section className={`review-block ${candidate ? "candidate" : ""} ${evidence ? "evidence" : ""}`}><span className="section-label-with-help"><span>{label}</span><InfoTip label={label} context="section" /></span><p>{text}</p></section>; }
