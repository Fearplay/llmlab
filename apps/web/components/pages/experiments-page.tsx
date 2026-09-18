"use client";

import { ArrowRight, GitCompareArrows, Plus } from "lucide-react";
import Link from "next/link";
import { useApp } from "@/components/app-provider";
import { DefinitionTerm, PageHeader, Panel, ProvenanceStrip } from "@/components/ui";
import { useDashboardData } from "@/lib/dashboard-store";

export function ExperimentsPage() {
  const { t } = useApp();
  const { visibleRuns } = useDashboardData();
  return <><PageHeader title={t("nav.experiments")} description={t("compare.subtitle")} actions={<><Link href="/experiments/compare" className="button button-secondary"><GitCompareArrows size={15} />{t("compare.title")}</Link><Link href="/?new=1" className="button button-primary"><Plus size={15} />{t("dashboard.newExperiment")}</Link></>} /><ProvenanceStrip mode="fixture" /><div className="content-grid two-one"><Panel title={t("dashboard.recentExperiments")}>{visibleRuns.length ? <div className="experiment-list">{visibleRuns.map((run, index) => <Link href="/experiments/compare" className="experiment-row" key={run.id}><div><strong>{index === 0 ? run.prompt : `${t("experiments.benchmark")} ${run.prompt}`}</strong><span className="mono">{run.id} · {run.model}</span></div><div><strong className="mono">{run.quality.toFixed(1)}%</strong><span>{run.date}</span></div><ArrowRight size={15} /></Link>)}</div> : <div className="panel-empty"><strong>{t("dashboard.emptyTitle")}</strong><span>{t("dashboard.emptyText")}</span></div>}</Panel><Panel title={t("experiments.design")}><dl className="definition-list"><div><DefinitionTerm label={t("common.dataset")} /><dd>support-v4 · {t("experiments.immutable")}</dd></div><div><DefinitionTerm label={t("experiments.variants")} /><dd>prompt-v17 / prompt-v18</dd></div><div><DefinitionTerm label={t("experiments.evaluatorSet")} /><dd>{t("experiments.metricSet")}</dd></div><div><DefinitionTerm label={t("experiments.gate")} /><dd>{t("dashboard.regressionRate")} ≤ 2.0%</dd></div></dl></Panel></div></>;
}
