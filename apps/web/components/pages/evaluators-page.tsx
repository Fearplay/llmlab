"use client";

import { Braces, Check, FileCheck2, Scale, Sparkles, WholeWord } from "lucide-react";
import { useState } from "react";
import { useApp } from "@/components/app-provider";
import { DefinitionTerm, InfoTip, PageHeader, Panel, ProgressBar, ProvenanceStrip } from "@/components/ui";

const evaluatorData = [
  { key: "exact", icon: WholeWord, type: "deterministic", threshold: "1.00", score: 100 },
  { key: "schema", icon: Braces, type: "deterministic", threshold: "1.00", score: 99.8 },
  { key: "semantic", icon: Sparkles, type: "modelBased", threshold: "0.85", score: 88 },
  { key: "judge", icon: FileCheck2, type: "modelBased", threshold: "0.80", score: 91.2 },
  { key: "pairwise", icon: Scale, type: "modelBased", threshold: "0.55 win rate", score: 58 },
];

export function EvaluatorsPage() {
  const { t } = useApp();
  const [enabled, setEnabled] = useState<Record<string, boolean>>({ exact: true, schema: true, semantic: false, judge: true, pairwise: true });
  return <><PageHeader title={t("evaluators.title")} description={t("evaluators.subtitle")} helpKey="page.evaluators" /><ProvenanceStrip mode="fixture" tail="5 evaluator versions · support-v4" /><div className="evaluator-grid">{evaluatorData.map(({ key, icon: Icon, type, threshold, score }) => <Panel key={key} className="evaluator-card"><div className="evaluator-heading"><span className="evaluator-icon"><Icon size={19} /></span><div><div className="panel-title-row"><h2>{t(`evaluators.${key}`)}</h2><InfoTip label={t(`evaluators.${key}`)} context="section" /></div><span>{t(`evaluators.${type}`)}</span></div><label className="switch"><input type="checkbox" aria-label={`${t("evaluators.enabled")}: ${t(`evaluators.${key}`)}`} checked={enabled[key]} onChange={(event) => setEnabled((current) => ({ ...current, [key]: event.target.checked }))} /><span /></label></div><dl className="definition-list"><div><DefinitionTerm label={t("evaluators.threshold")} /><dd className="mono">{threshold}</dd></div><div><DefinitionTerm label={t("evaluators.latestScore")} /><dd className="mono">{score}%</dd></div></dl><ProgressBar value={score} tone={score >= 80 ? "green" : "blue"} /><p className="limitation"><strong>{t("evaluators.limitation")}:</strong> {t(`evaluators.${key}Limit`)}</p>{enabled[key] && <span className="status-text success"><Check size={12} />{t("evaluators.enabled")}</span>}</Panel>)}</div></>;
}
