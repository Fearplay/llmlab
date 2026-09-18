"use client";

import { ArrowLeftRight, Check, Download, Share2, X } from "lucide-react";
import { useMemo, useState } from "react";
import { useApp } from "@/components/app-provider";
import { CostQualityChart } from "@/components/charts";
import { Button, MetricLabel, Notice, PageHeader, Panel, Select, StatusMark, TableHeading } from "@/components/ui";
import { compareCases, compareMetrics } from "@/lib/fixtures";

export function ComparePage() {
  const { t } = useApp();
  const [selectedId, setSelectedId] = useState(compareCases[0].id);
  const [filter, setFilter] = useState("regressed");
  const [swapped, setSwapped] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [feedback, setFeedback] = useState<"shared" | "exported" | "reset" | null>(null);
  const selected = compareCases.find((item) => item.id === selectedId) ?? compareCases[0];
  const rows = useMemo(() => {
    const filtered = filter === "all" ? compareCases : compareCases.filter((item) => item.delta < 0);
    const needle = searchQuery.trim().toLowerCase();
    return needle ? filtered.filter((item) => `${item.id} ${item.slice} ${item.finding} ${item.prompt}`.toLowerCase().includes(needle)) : filtered;
  }, [filter, searchQuery]);

  const share = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setFeedback("shared");
    } catch {
      setFeedback(null);
    }
  };
  const exportComparison = () => {
    const payload = JSON.stringify({ schema_version: 1, baseline: "run_0184", candidate: "run_0191", metrics: compareMetrics, cases: compareCases }, null, 2);
    const url = URL.createObjectURL(new Blob([payload], { type: "application/json" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "llmlab-run-comparison.json";
    anchor.click();
    URL.revokeObjectURL(url);
    setFeedback("exported");
  };
  const resetComparison = () => {
    setSwapped(false);
    setFilter("regressed");
    setSearchQuery("");
    setSelectedId(compareCases[0].id);
    setFeedback("reset");
  };

  return (
    <>
      <PageHeader title={t("compare.title")} description={t("compare.subtitle")} helpKey="page.comparison" actions={<><Button variant="secondary" onClick={() => void share()}><Share2 size={14} />{t("common.share")}</Button><Button variant="secondary" onClick={exportComparison}><Download size={14} />{t("common.export")}</Button><Button onClick={resetComparison}>{t("common.newComparison")}</Button>{feedback && <span className="action-status" role="status"><Check size={12} />{t(`compare.${feedback}`)}</span>}</>} />

      <div className="compare-selectors">
        <RunSelector label={t(swapped ? "compare.candidate" : "compare.baseline")} value={swapped ? "run_0191 · prompt-v18" : "run_0184 · prompt-v17"} meta="model-medium · support-v4 · Sep 10, 10:15" />
        <button className="swap-button" onClick={() => setSwapped((value) => !value)} aria-label={t("compare.swap")}><ArrowLeftRight size={18} /></button>
        <RunSelector label={t(swapped ? "compare.baseline" : "compare.candidate")} value={swapped ? "run_0184 · prompt-v17" : "run_0191 · prompt-v18"} meta="model-medium · support-v4 · Sep 12, 14:32" candidate={!swapped} />
        <div className="evaluation-set"><span>{t("compare.evaluationSet")}</span><strong className="mono">FIXTURE · model-medium · support-v4 · 500 cases</strong><small>{t("compare.balanced")}</small></div>
      </div>

      <div className="compare-overview">
        <Panel title={t("compare.qualityGate")}><Notice tone="danger" title={t("compare.gateFailed")}>{t("compare.gateReason")}</Notice><p className="muted-block">{t("compare.allOtherPass")}</p><a href="#cases" className="inline-link">{t("compare.inspectRegressed")}</a></Panel>
        <Panel title={t("compare.keyMetrics")} className="key-metrics-panel"><div className="table-scroll"><table className="metric-table"><thead><tr><TableHeading label={t("compare.metric")} /><TableHeading label={t("compare.baseline")} /><TableHeading label={t("compare.candidate")} /><TableHeading label={t("compare.delta")} /><TableHeading label={t("compare.threshold")} /><TableHeading label={t("compare.result")} /></tr></thead><tbody>{compareMetrics.map((item) => <tr key={item.label}><th><MetricLabel label={item.label} /></th><td className="mono">{item.baseline}</td><td className="mono strong">{item.candidate}</td><td className={`mono ${item.delta.startsWith("+") && item.result !== "fail" ? "positive" : item.result === "fail" || item.delta.startsWith("−") ? "negative" : ""}`}>{swapped ? invertDelta(item.delta) : item.delta}</td><td className="mono">{item.threshold}</td><td><StatusMark result={item.result} /></td></tr>)}</tbody></table></div></Panel>
        <Panel title="Cost vs. quality"><CostQualityChart compact /><div className="outcome-bar" aria-label="Case outcomes"><span className="improved" style={{ width: "10.8%" }} /><span className="unchanged" style={{ width: "84.2%" }} /><span className="regressed" style={{ width: "5%" }} /></div><div className="outcome-legend"><span><i className="dot success-dot" />{t("compare.improved")} <strong>54</strong></span><span><i className="dot neutral-dot" />{t("compare.unchanged")} <strong>421</strong></span><span><i className="dot danger-dot" />{t("compare.regressed")} <strong>25</strong></span></div></Panel>
      </div>

      <div className="compare-lower" id="cases">
        <Panel title={`${t("compare.cases")} (500)`} aside={<div className="table-tools"><Select value={filter} onChange={setFilter} ariaLabel="Case filter"><option value="regressed">{t("compare.regressed")}</option><option value="all">{t("compare.allSlices")}</option></Select><input className="compact-input" value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder={t("compare.searchCases")} /></div>}>
          <div className="table-scroll"><table className="case-table"><thead><tr><TableHeading label={t("common.case")} /><TableHeading label={t("common.slice")} /><TableHeading label={t("compare.baseline")} /><TableHeading label={t("compare.candidate")} /><TableHeading label={t("compare.delta")} /><TableHeading label={t("labs.finding")} /></tr></thead><tbody>{rows.map((item) => <tr key={item.id} className={selectedId === item.id ? "selected" : ""} onClick={() => setSelectedId(item.id)}><td className="mono"><input type="radio" checked={selectedId === item.id} onChange={() => setSelectedId(item.id)} aria-label={`${t("common.select")} ${item.id}`} />{item.id}</td><td>{item.slice}</td><td className="mono">{item.baseline.toFixed(3)}</td><td className="mono">{item.candidate.toFixed(3)}</td><td className="mono negative">{item.delta.toFixed(3)}</td><td className="negative">{item.finding}</td></tr>)}</tbody></table></div>
        </Panel>
        <Panel title={t("compare.significance")}><p className="panel-kicker">{t("compare.bootstrap")}</p><div className="significance"><div><strong className="mono">Δ +3.3 pp</strong><small>95% CI +2.1 to +4.6</small></div><div><strong className="mono">p = 0.004</strong><small className="positive">{t("compare.significant")}</small></div></div><p className="limitation">{t("compare.bootstrapNote")}</p></Panel>
      </div>

      <Panel className="case-inspector" title={`Case ${selected.id}`} aside={<span className="severity severity-high"><X size={11} />{t("compare.regressed")}</span>}>
        <div className="case-detail-grid">
          <Detail title={t("compare.userPrompt")} body={selected.prompt} />
          <Detail title={t("compare.expected")} body={selected.expected} />
          <Detail title={t("compare.baselineOutput")} body={swapped ? selected.candidateOutput : selected.baselineOutput} tone="success" />
          <Detail title={t("compare.candidateOutput")} body={swapped ? selected.baselineOutput : selected.candidateOutput} tone="danger" />
          <Detail title={t("compare.evidence")} body={selected.evidence} tone="danger" />
          <Detail title={t("compare.sourceContext")} body={selected.source} mono />
        </div>
      </Panel>
    </>
  );
}

function RunSelector({ label, value, meta, candidate = false }: { label: string; value: string; meta: string; candidate?: boolean }) {
  const { t } = useApp();
  return <div className="run-selector"><MetricLabel label={label} /><div className="run-selector-value"><strong className="mono">{value}</strong><span className={candidate ? "candidate-tag" : "baseline-tag"}>{candidate ? t("compare.candidate") : t("compare.baseline")}</span></div><small>{meta}</small></div>;
}

function Detail({ title, body, tone, mono = false }: { title: string; body: string; tone?: "success" | "danger"; mono?: boolean }) {
  const { t } = useApp();
  return <article className={`detail-card ${tone ?? ""}`}><header><MetricLabel label={title} />{tone === "success" && <span className="status-text success"><Check size={11} />{t("common.pass")}</span>}{tone === "danger" && <span className="status-text danger"><X size={11} />{t("common.fail")}</span>}</header><p className={mono ? "mono" : ""}>{body}</p></article>;
}

function invertDelta(delta: string) {
  if (delta.startsWith("+")) return `−${delta.slice(1)}`;
  if (delta.startsWith("−")) return `+${delta.slice(1)}`;
  return delta;
}
