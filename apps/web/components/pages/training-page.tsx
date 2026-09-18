"use client";

import { Check, Play, Square } from "lucide-react";
import { useEffect, useState } from "react";
import { useApp } from "@/components/app-provider";
import { TrainingChart } from "@/components/charts";
import { Button, HelpLabel, MetricLabel, ModeSelector, PageHeader, Panel, ProgressBar, ProvenanceStrip } from "@/components/ui";
import type { ExecutionMode } from "@/lib/types";

const loss = [0.82, 0.61, 0.46, 0.35, 0.28, 0.22, 0.17, 0.13, 0.1, 0.08, 0.06, 0.05];
const valLoss = [0.86, 0.66, 0.53, 0.44, 0.4, 0.39, 0.41, 0.45, 0.5, 0.56, 0.61, 0.68];

export function TrainingPage() {
  const { t } = useApp();
  const [mode, setMode] = useState<ExecutionMode>("fixture");
  const [targetEpochs, setTargetEpochs] = useState(8);
  const [epoch, setEpoch] = useState(8);
  const [running, setRunning] = useState(false);
  const [learningRate, setLearningRate] = useState(0.01);
  useEffect(() => {
    if (!running) return;
    const timer = window.setInterval(() => setEpoch((value) => {
      if (value >= targetEpochs) { setRunning(false); return value; }
      return value + 1;
    }), 420);
    return () => window.clearInterval(timer);
  }, [running, targetEpochs]);
  const start = () => { setEpoch(1); setRunning(true); };
  const current = Math.max(0, Math.min(loss.length - 1, epoch - 1));
  return <>
    <PageHeader title={t("labs.trainingTitle")} description={t("labs.trainingSubtitle")} helpKey="page.training" actions={<ModeSelector value={mode} onChange={setMode} includeFixture />} />
    <ProvenanceStrip mode={mode} provider={mode === "local" ? "PyTorch CPU" : "Fixture trainer"} model="tiny-bow-classifier" tail="support-intent-v2 · seed 42" />
    <div className="training-layout">
      <Panel title={t("labs.trainingConfig")}>
        <label className="field"><HelpLabel label={t("common.dataset")} /><select defaultValue="intent" disabled><option value="intent">support-intent-v2 · 1,200 rows</option></select></label>
        <label className="field"><HelpLabel label={t("labs.architecture")} helpKey="field.trainingArchitecture" /><select defaultValue="bow" disabled><option value="bow">Bag-of-words → Linear (4 classes)</option></select></label>
        <label className="field"><HelpLabel label={t("labs.epochs")} helpKey="training.epochs" /><input type="number" min={2} max={12} value={targetEpochs} onChange={(event) => setTargetEpochs(Number(event.target.value))} /></label>
        <label className="field"><HelpLabel label={t("labs.learningRate")} helpKey="training.learningRate" /><input type="number" min={0.0001} max={0.1} step={0.001} value={learningRate} onChange={(event) => setLearningRate(Number(event.target.value))} /></label>
        <div className="form-grid"><label className="field"><HelpLabel label={t("labs.batchSize")} helpKey="field.batchSize" /><input value="32" readOnly /></label><label className="field"><HelpLabel label={t("labs.seed")} helpKey="prompt.seed" /><input value="42" readOnly /></label></div>
        <div className="button-row"><Button onClick={start} loading={running}><Play size={14} />{t("labs.startTraining")}</Button>{running && <Button variant="secondary" onClick={() => setRunning(false)}><Square size={12} />{t("labs.stop")}</Button>}</div>
        <p className="method-note">{t("labs.cpuNote")}</p>
      </Panel>
      <Panel title={t("labs.lossCurves")} aside={<span className="panel-meta mono">epoch {epoch} / {targetEpochs}</span>}><TrainingChart epochs={epoch} />{epoch >= 7 && <div className="overfit-warning"><strong>{t("labs.overfit")}</strong><span>{t("labs.overfitText")}</span></div>}</Panel>
    </div>
    <section className="training-metrics"><TrainMetric label={t("labs.trainLoss")} helpKey="training.loss" value={loss[current].toFixed(3)} percent={(1 - loss[current]) * 100} /><TrainMetric label={t("labs.validationLoss")} helpKey="training.loss" value={valLoss[current].toFixed(3)} percent={(1 - valLoss[current]) * 100} /><TrainMetric label={t("labs.accuracy")} value={`${(74 + Math.min(epoch, 7) * 3.1).toFixed(1)}%`} percent={74 + Math.min(epoch, 7) * 3.1} /><TrainMetric label={t("labs.gradientNorm")} value={(0.84 / Math.sqrt(epoch)).toFixed(3)} percent={55} /><div className="training-state"><MetricLabel label={t("common.state")} /><strong className={running ? "status-text warning" : "status-text success"}>{running ? t("common.training") : <><Check size={13} />{t("common.completed")}</>}</strong><small className="mono">cpu · {(epoch * 0.42).toFixed(2)} s</small></div></section>
    <Panel title={t("labs.whatChanged")}><div className="lesson-grid"><div><MetricLabel label="Loss" helpKey="training.loss" /><p>{t("labs.lossLesson")}</p></div><div><MetricLabel label="Gradient" /><p>{t("labs.gradientLesson")}</p></div><div><MetricLabel label="Validation" /><p>{t("labs.validationLesson")}</p></div><div><MetricLabel label={t("labs.earlyStopping")} /><p>{t("labs.earlyLesson")}</p></div></div></Panel>
  </>;
}

function TrainMetric({ label, helpKey, value, percent }: { label: string; helpKey?: string; value: string; percent: number }) { return <div><MetricLabel label={label} helpKey={helpKey} /><strong className="mono">{value}</strong><ProgressBar value={percent} /></div>; }
