"use client";

import { Bot, Check, CircleAlert, Play, Wrench } from "lucide-react";
import { useEffect, useState } from "react";
import { useApp } from "@/components/app-provider";
import { Button, HelpLabel, MetricLabel, PageHeader, Panel, ProgressBar, ProvenanceStrip } from "@/components/ui";
import { agentTrace } from "@/lib/fixtures";

export function AgentsPage() {
  const { t } = useApp();
  const [visible, setVisible] = useState(agentTrace.length);
  const [running, setRunning] = useState(false);
  useEffect(() => {
    if (!running) return;
    const timer = window.setInterval(() => setVisible((value) => {
      if (value >= agentTrace.length) { setRunning(false); return value; }
      return value + 1;
    }), 260);
    return () => window.clearInterval(timer);
  }, [running]);
  const run = () => { setVisible(0); setRunning(true); };
  return <>
    <PageHeader title={t("labs.agentsTitle")} description={t("labs.agentsSubtitle")} helpKey="page.agents" actions={<Button onClick={run} loading={running}><Play size={14} />{t("labs.runAgent")}</Button>} />
    <ProvenanceStrip mode="fixture" provider="Fixture agent runtime" model="tool-agent-v1" tail="trajectory agent-run-0042" />
    <div className="agent-layout">
      <Panel title={t("labs.taskContract")}>
        <label className="field"><HelpLabel label={t("labs.userTask")} helpKey="field.agentTask" /><textarea rows={4} defaultValue="Where is order #A-2048 and can I change its address?" /></label>
        <div className="tool-contract"><Wrench size={16} /><div><strong>order_lookup</strong><code>{`{ order_id: string }`}</code></div></div>
        <div className="tool-contract"><Wrench size={16} /><div><strong>policy_search</strong><code>{`{ query: string }`}</code></div></div>
        <p className="method-note"><CircleAlert size={14} />{t("labs.observableOnly")}</p>
      </Panel>
      <Panel title={t("labs.trace")} aside={<span className="panel-meta mono">{Math.min(visible, agentTrace.length)} / {agentTrace.length} events</span>}>
        <ol className="trace-list">{agentTrace.slice(0, visible).map((item, index) => <li key={item.id}><span className={`trace-icon trace-${item.type}`}>{item.type === "tool_call" || item.type === "tool_result" ? <Wrench size={14} /> : item.type === "evaluation" ? <Check size={14} /> : <Bot size={14} />}</span><div><header><strong>{item.title}</strong><time className="mono">{item.duration}</time></header><pre>{item.detail}</pre><small className="mono">event_{String(index + 1).padStart(2, "0")} · {item.type}</small></div></li>)}</ol>
      </Panel>
    </div>
    <section className="agent-scores"><AgentScore label={t("labs.goalCompletion")} value="1.00" percent={100} /><AgentScore label={t("labs.toolAccuracy")} value="1.00" percent={100} /><AgentScore label={t("labs.redundantCalls")} value="0" percent={100} /><div><MetricLabel label={t("labs.trajectoryVerdict")} /><strong className="status-text success"><Check size={14} />{t("common.pass")}</strong><small>{t("labs.tracePass")}</small></div></section>
  </>;
}

function AgentScore({ label, value, percent }: { label: string; value: string; percent: number }) { return <div><MetricLabel label={label} /><strong className="mono">{value}</strong><ProgressBar value={percent} tone="green" /></div>; }
