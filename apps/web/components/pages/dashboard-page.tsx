"use client";

import { ArrowRight, Check, CircleAlert, Plus, RotateCcw, Trash2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useApp } from "@/components/app-provider";
import { CostQualityChart, QualityTrendChart } from "@/components/charts";
import { Button, Dialog, HelpLabel, MetricLabel, Notice, PageHeader, Panel, ProgressBar, ProvenanceStrip, TableHeading } from "@/components/ui";
import { useDashboardData } from "@/lib/dashboard-store";
import { regressions } from "@/lib/fixtures";
import type { RunRecord } from "@/lib/types";

export function DashboardPage() {
  const { t, mode, locale } = useApp();
  const router = useRouter();
  const { userRuns, visibleRuns, showFixtures, addUserRun, removeUserRun, clearFixtures, restoreFixtures } = useDashboardData();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [runProgress, setRunProgress] = useState<number | null>(null);
  const [runName, setRunName] = useState("prompt-v19 regression");
  const [runModel, setRunModel] = useState("fixture-gen-v1");
  const [pendingRunId, setPendingRunId] = useState<string | null>(null);
  const runComplete = runProgress === 100;
  const latest = visibleRuns[0];

  const openNewRun = useCallback(() => {
    setRunProgress(null);
    setPendingRunId(null);
    setDialogOpen(true);
  }, []);

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("new") !== "1") return;
    window.history.replaceState({}, "", window.location.pathname);
    const timer = window.setTimeout(openNewRun, 0);
    return () => window.clearTimeout(timer);
  }, [openNewRun]);

  useEffect(() => {
    if (runProgress === null || runProgress >= 100) return;
    const timer = window.setTimeout(() => {
      const next = Math.min(100, runProgress + 8);
      if (next === 100 && pendingRunId) {
        const run: RunRecord = {
          id: pendingRunId,
          date: new Intl.DateTimeFormat(locale === "cs" ? "cs-CZ" : "en-GB", { month: "short", day: "2-digit", hour: "2-digit", minute: "2-digit" }).format(new Date()),
          model: runModel.trim() || "fixture-gen-v1",
          prompt: runName.trim() || "Untitled experiment",
          quality: 90.6,
          passRate: 88.8,
          cost: 0,
          latency: 0.42,
          status: "completed",
          mode: "fixture",
        };
        addUserRun(run);
        setPendingRunId(null);
      }
      setRunProgress(next);
    }, 180);
    return () => window.clearTimeout(timer);
  }, [addUserRun, locale, pendingRunId, runModel, runName, runProgress]);

  const closeDialog = useCallback(() => setDialogOpen(false), []);
  const startRun = () => {
    setPendingRunId(`run_${Date.now().toString(36)}`);
    setRunProgress(0);
  };

  return (
    <>
      <PageHeader eyebrow={t("dashboard.eyebrow")} title={t("dashboard.title")} description={t("dashboard.subtitle")} actions={<><Button variant="secondary" onClick={() => router.push("/settings")}>{t("dashboard.editProject")}</Button>{mode === "fixture" ? <Button onClick={openNewRun}><Plus size={15} />{t("dashboard.newExperiment")}</Button> : <Link href="/ai-lab/prompt-tokens" className="button button-primary">{t("dashboard.openLiveLab")}<ArrowRight size={14} /></Link>}</>} />
      <ProvenanceStrip mode={latest?.mode ?? "fixture"} model={latest?.model} tail={showFixtures ? "support-v4 · prompt-v18" : t("dashboard.userDataOnly")} />
      {mode !== "fixture" && <Notice title={t("dashboard.storedHistory")}>{t("dashboard.historyModeNotice")}</Notice>}

      <div className="data-scope-bar">
        <div><strong>{showFixtures ? t("dashboard.demoAndUserData") : t("dashboard.userDataOnly")}</strong><span>{showFixtures ? t("dashboard.demoDataExplanation") : t("dashboard.userDataExplanation")}</span></div>
        {showFixtures ? <Button variant="secondary" onClick={clearFixtures}><Trash2 size={14} />{t("dashboard.clearDemo")}</Button> : <Button variant="quiet" onClick={restoreFixtures}><RotateCcw size={14} />{t("dashboard.restoreDemo")}</Button>}
      </div>

      {!latest ? <EmptyOverview onCreate={openNewRun} onRestore={restoreFixtures} t={t} /> : <>
        <section className="metric-band" aria-label={t("dashboard.projectMetrics")}>
          <Metric label={t("dashboard.quality")} value={`${latest.quality.toFixed(1)}%`} note={latest.prompt} />
          <Metric label={t("dashboard.passRate")} value={`${latest.passRate.toFixed(1)}%`} note={t("dashboard.latestRun")} />
          <Metric label={t("dashboard.cost")} value={latest.cost === null ? "—" : `$${latest.cost.toFixed(4)}`} note={latest.mode} />
          <Metric label={t("dashboard.latency")} value={`${latest.latency.toFixed(2)} s`} note={latest.model} />
          <Metric label={t("dashboard.regressionRate")} value={showFixtures ? "5.0%" : "—"} tone={showFixtures ? "negative" : "neutral"} note={showFixtures ? "threshold ≤ 2.0%" : t("dashboard.needsComparison")} />
        </section>

        {showFixtures && <div className="dashboard-charts">
          <Panel title={t("dashboard.qualityTrend")} aside={<span className="panel-meta">{t("dashboard.last30")}</span>}><QualityTrendChart /></Panel>
          <Panel title={t("dashboard.costQuality")} aside={<span className="panel-meta">{t("dashboard.pareto")}</span>}><CostQualityChart /></Panel>
        </div>}

        <div className="dashboard-tables">
          <Panel title={t("dashboard.recentExperiments")} aside={<a className="inline-link" href="/experiments">{t("common.viewAll")} <ArrowRight size={13} /></a>}>
            <div className="table-scroll"><table><thead><tr><TableHeading label={t("dashboard.runId")} /><TableHeading label={t("dashboard.source")} /><TableHeading label={t("dashboard.date")} /><TableHeading label={t("app.model")} helpKey="prompt.model" /><TableHeading label={t("dashboard.prompt")} /><TableHeading label={t("dashboard.quality")} /><TableHeading label={t("dashboard.passRate")} /><TableHeading label={t("dashboard.cost")} /><TableHeading label={t("app.status")} /><th><span className="sr-only">{t("dashboard.actions")}</span></th></tr></thead><tbody>{visibleRuns.map((run) => {
              const userRun = userRuns.some((item) => item.id === run.id);
              return <tr key={run.id}><td>{userRun ? <span className="mono">{run.id}</span> : <a href="/experiments/compare" className="mono link">{run.id}</a>}</td><td><span className={`data-origin ${userRun ? "data-origin-user" : "data-origin-demo"}`}>{userRun ? t("dashboard.yourRun") : t("dashboard.demo")}</span></td><td>{run.date}</td><td>{run.model}</td><td>{run.prompt}</td><td className="mono">{run.quality.toFixed(1)}%</td><td className="mono">{run.passRate.toFixed(1)}%</td><td className="mono">{run.cost === null ? "—" : `$${run.cost.toFixed(4)}`}</td><td><span className="status-text success"><Check size={12} />{t("app.completed")}</span></td><td>{userRun && <button className="icon-button delete-run" aria-label={`${t("dashboard.deleteRun")} ${run.prompt}`} onClick={() => removeUserRun(run.id)}><Trash2 size={14} /></button>}</td></tr>;
            })}</tbody></table></div>
          </Panel>
          <Panel title={t("dashboard.regressions")} aside={showFixtures ? <a className="inline-link" href="/experiments/compare">{t("common.viewAll")} <ArrowRight size={13} /></a> : undefined}>
            {showFixtures ? <div className="table-scroll"><table><thead><tr><TableHeading label={t("dashboard.testCase")} /><TableHeading label={t("dashboard.category")} /><TableHeading label="Δ" /><TableHeading label={t("dashboard.severity")} /><TableHeading label={t("app.status")} /></tr></thead><tbody>{regressions.map((item) => <tr key={item.id}><td><a href="/experiments/compare" className="link"><span className="mono">{item.id}</span> {item.title}</a></td><td>{item.category}</td><td className="mono negative">{item.delta.toFixed(3)}</td><td><span className={`severity severity-${item.severity}`}>{item.severity}</span></td><td>{item.status === "open" ? <span className="status-text danger"><CircleAlert size={12} />{t("common.openStatus")}</span> : <span className="status-text success"><Check size={12} />{t("common.reviewed")}</span>}</td></tr>)}</tbody></table></div> : <div className="panel-empty"><Check size={18} /><strong>{t("dashboard.noDemoRegressions")}</strong><span>{t("dashboard.runComparisonHint")}</span></div>}
          </Panel>
        </div>
      </>}

      <Dialog open={dialogOpen} title={t("dashboard.newExperiment")} onClose={closeDialog}>
        <div className="dialog-content">
          <label className="field"><HelpLabel label={t("dashboard.runName")} /><input aria-label={t("dashboard.runName")} value={runName} disabled={runProgress !== null} onChange={(event) => setRunName(event.target.value)} /></label>
          <div className="form-grid"><label className="field"><HelpLabel label={t("common.dataset")} /><select defaultValue="support-v4" disabled><option value="support-v4">support-v4 · 500 cases</option></select></label><label className="field"><HelpLabel label={t("app.model")} helpKey="prompt.model" /><input aria-label={t("app.model")} value={runModel} disabled={runProgress !== null} onChange={(event) => setRunModel(event.target.value)} /></label></div>
          <div className="fixture-callout"><span className="mode-badge mode-fixture">{t("app.fixture")}</span><span>{t("app.comingFromFixture")}</span></div>
          {runProgress !== null && !runComplete && <div className="run-progress"><div><strong>{t("dashboard.runningMessage")}</strong><span className="mono">{Math.round(runProgress * 5)} / 500</span></div><ProgressBar value={runProgress} /></div>}
          {runComplete && <div className="success-message"><Check size={17} /><span>{t("dashboard.completeMessage")}</span></div>}
        </div>
        <footer className="dialog-actions"><Button variant="secondary" onClick={closeDialog}>{t("app.close")}</Button>{!runComplete && <Button onClick={startRun} disabled={!runName.trim() || (runProgress !== null && runProgress < 100)}>{t("dashboard.startRun")}</Button>} {runComplete && <Button onClick={closeDialog}>{t("dashboard.viewOverview")}</Button>}</footer>
      </Dialog>
    </>
  );
}

function EmptyOverview({ onCreate, onRestore, t }: { onCreate: () => void; onRestore: () => void; t: (key: string) => string }) {
  return <section className="overview-empty"><span className="overview-empty-mark"><Plus size={22} /></span><div><h2>{t("dashboard.emptyTitle")}</h2><p>{t("dashboard.emptyText")}</p></div><div className="button-row"><Button onClick={onCreate}><Plus size={14} />{t("dashboard.newExperiment")}</Button><Button variant="quiet" onClick={onRestore}>{t("dashboard.restoreDemo")}</Button></div></section>;
}

function Metric({ label, value, delta, tone = "neutral", note }: { label: string; value: string; delta?: string; tone?: "positive" | "negative" | "neutral"; note: string }) {
  return <div className="metric-cell"><MetricLabel label={label} /><div><strong className={`metric-value ${tone}`}>{value}</strong>{delta && <span className={`metric-delta ${tone}`}>{delta}</span>}</div><span className="metric-note">{note}</span></div>;
}
