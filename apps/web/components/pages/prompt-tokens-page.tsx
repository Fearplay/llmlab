"use client";

import { Play } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { useApp } from "@/components/app-provider";
import { Button, HelpLabel, InfoTip, MetricLabel, ModeSelector, Notice, PageHeader, Panel, ProvenanceStrip } from "@/components/ui";
import type { ExecutionMode } from "@/lib/types";

const example = {
  cs: { system: "Odpovídej stručně a jasně. Pokud něco nevíš, řekni to.", prompt: "Vysvětli začátečníkovi jednou větou, co je kontextové okno modelu." },
  en: { system: "Answer clearly and briefly. Say when you do not know.", prompt: "Explain to a beginner in one sentence what a model context window is." },
};
const defaultSchema = JSON.stringify({ type: "object", properties: { answer: { type: "string" } }, required: ["answer"], additionalProperties: false }, null, 2);

interface GenerationResult {
  text: string;
  provider: string;
  model: string;
  mode: ExecutionMode;
  usage: { input_tokens: number; output_tokens: number; cached_tokens: number; cost_usd: number | null };
  latency_ms: number;
  fixture: boolean;
  run_id?: string;
  applied_settings?: Record<string, unknown>;
}

function supportsStructured(capabilities: string[] | Record<string, boolean>) {
  return Array.isArray(capabilities) ? capabilities.includes("structured_output") : capabilities.structured_output === true;
}

export function PromptTokensPage() {
  const { t, locale, mode, setMode, selectedModel, modelsLoading, modelError } = useApp();
  const [prompt, setPrompt] = useState("");
  const [system, setSystem] = useState("");
  const [temperature, setTemperature] = useState(0.3);
  const [topP, setTopP] = useState(1);
  const [maxTokens, setMaxTokens] = useState(512);
  const [stopSequence, setStopSequence] = useState("");
  const [structured, setStructured] = useState(false);
  const [schemaText, setSchemaText] = useState(defaultSchema);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<GenerationResult | null>(null);
  const [schemaValid, setSchemaValid] = useState<boolean | null>(null);
  const [resultSchemaRequested, setResultSchemaRequested] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const estimatedInputTokens = Math.max(0, Math.ceil((system.length + prompt.length) / 4) + (prompt ? 8 : 0));
  const contextWindow = selectedModel?.context_window;
  const contextShare = contextWindow ? Math.min(100, Math.round(estimatedInputTokens / contextWindow * 100)) : null;
  const fixture = mode === "fixture";
  const canStructure = fixture || !!(selectedModel && supportsStructured(selectedModel.capabilities));
  const schemaRequested = structured && canStructure;
  const model = fixture ? { id: "fixture-gen-v2", provider: "fixture" } : selectedModel;
  const clearResult = () => { setResult(null); setSchemaValid(null); setResultSchemaRequested(false); setError(null); };

  const run = async () => {
    if (!prompt.trim() || !model || maxTokens < 1) return;
    let schema: Record<string, unknown> | null = null;
    if (schemaRequested) {
      try {
        const parsed = JSON.parse(schemaText) as unknown;
        if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("Schema must be an object");
        schema = parsed as Record<string, unknown>;
      } catch { setError(t("labs.invalidSchemaInput")); return; }
    }
    setRunning(true);
    clearResult();
    try {
      const response = await fetch("/api/v1/generation", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode, provider: model.provider, model: model.id,
          messages: [...(system.trim() ? [{ role: "system", content: system }] : []), { role: "user", content: prompt }],
          temperature, top_p: topP, max_tokens: maxTokens, stop: stopSequence.trim() ? [stopSequence.trim()] : [], response_schema: schema }),
      });
      const raw = await response.text();
      let body: (GenerationResult & { detail?: unknown }) | null = null;
      try { body = JSON.parse(raw) as GenerationResult & { detail?: unknown }; } catch { /* Proxy may return HTML. */ }
      if (!response.ok) throw new Error(typeof body?.detail === "string" ? body.detail : `HTTP ${response.status}: ${raw.slice(0, 150)}`);
      if (!body || typeof body.text !== "string") throw new Error(t("labs.invalidProviderResponse"));
      setResult(body);
      setResultSchemaRequested(Boolean(schema));
      if (schema) {
        try {
          const check = await fetch("/api/v1/evaluations", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ evaluator: "json_schema", output: body.text, config: { schema } }) });
          if (check.ok) setSchemaValid(((await check.json()) as { passed: boolean }).passed);
        } catch { /* Leave schema result unknown when the evaluator is unavailable. */ }
      }
    } catch (caught) { setError(explainGenerationError(caught, t)); }
    finally { setRunning(false); }
  };

  return <>
    <PageHeader title={t("labs.promptTitle")} description={t("labs.promptSubtitle")} actions={<ModeSelector value={mode} onChange={(next) => { setMode(next); clearResult(); }} />} helpKey="prompt.page" />
    <ProvenanceStrip mode={result?.mode ?? mode} provider={result?.provider ?? model?.provider ?? "—"} model={result?.model ?? model?.id ?? "—"} tail={result ? `${result.usage.input_tokens + result.usage.output_tokens} ${t("common.tokens")} · ${result.latency_ms} ms` : t("labs.noResultYet")} />
    {fixture && <Notice title={t("labs.fixtureModeTitle")}>{t("labs.fixtureModeText")}</Notice>}
    {!fixture && !selectedModel && <Notice tone="warning" title={t("labs.noAvailableModel")}>{modelsLoading ? t("labs.loadingModels") : modelError ? t("labs.modelApiUnavailable") : t("labs.installOrConfigureModel")} <Link href="/providers" className="link">{t("nav.providers")}</Link></Notice>}
    {error && <Notice tone="danger" title={t("labs.requestFailed")}>{error}</Notice>}
    <div className="lab-grid two-one prompt-lab-grid">
      <Panel title={t("labs.input")} helpKey="prompt.input">
        <div className="prompt-example-line"><span>{t("labs.writeOwnPrompt")}</span><button type="button" onClick={() => { setSystem(example[locale].system); setPrompt(example[locale].prompt); clearResult(); }}>{t("labs.loadExample")}</button></div>
        <label className="field"><HelpLabel label={t("labs.systemLabel")} helpKey="prompt.system" /><textarea rows={3} value={system} placeholder={t("labs.systemPlaceholder")} onChange={(event) => { setSystem(event.target.value); clearResult(); }} /></label>
        <label className="field"><HelpLabel label={t("labs.userMessage")} helpKey="prompt.message" /><textarea rows={7} value={prompt} placeholder={t("labs.promptPlaceholder")} onChange={(event) => { setPrompt(event.target.value); clearResult(); }} /></label>
        <div className="token-ribbon" aria-label={t("labs.tokenPreview")}>{tokenizePreview(`${system} ${prompt}`).slice(0, 80).map((token, index) => <span className={["token-blue", "token-green", "token-orange", "token-violet"][index % 4]} key={`${index}-${token}`}>{token}</span>)}{!prompt && !system && <small>{t("labs.tokenPreviewEmpty")}</small>}</div>
        <div className="token-summary"><strong className="mono">≈ {estimatedInputTokens}</strong><span>{t("labs.estimatedTokens")}</span><InfoTip label={t("labs.estimatedTokens")} helpKey="prompt.tokens" context="metric" /><small>{t("labs.measuredNote")}</small></div>
        {contextWindow ? <div className="context-meter"><span>{t("labs.contextWindow")}: {contextWindow.toLocaleString(locale)} · {t("labs.estimatedUse")}: ≈ {contextShare}%</span><progress value={contextShare ?? 0} max={100} /></div> : <p className="prompt-muted">{t("labs.contextUnknown")}</p>}
      </Panel>
      <Panel title={t("labs.samplingContract")} helpKey="prompt.sampling">
        <p className="prompt-muted">{model ? `${model.provider} / ${model.id}` : t("labs.chooseModelTopRight")}</p>
        <RangeField label={t("labs.temperature")} helpKey="prompt.temperature" value={temperature} onChange={(value) => { setTemperature(value); clearResult(); }} max={2} step={0.1} />
        <RangeField label={t("labs.topP")} helpKey="prompt.topP" value={topP} onChange={(value) => { setTopP(value); clearResult(); }} max={1} step={0.05} />
        <label className="field"><HelpLabel label={t("labs.maxTokens")} helpKey="prompt.maxTokens" /><input type="number" min={1} max={32768} value={maxTokens} onChange={(event) => { setMaxTokens(Number(event.target.value)); clearResult(); }} /></label>
        <label className="field"><HelpLabel label={t("labs.stopSequence")} helpKey="prompt.stop" /><input value={stopSequence} placeholder={t("labs.stopPlaceholder")} onChange={(event) => { setStopSequence(event.target.value); clearResult(); }} /></label>
        <label className="toggle-row"><input type="checkbox" checked={schemaRequested} disabled={!canStructure} onChange={(event) => { setStructured(event.target.checked); clearResult(); }} /><span><span className="toggle-title"><strong>{t("labs.structured")}</strong><InfoTip label={t("labs.structured")} helpKey="prompt.structured" context="field" /></span><small>{canStructure ? t("labs.schemaContract") : t("labs.schemaUnavailable")}</small></span></label>
        {schemaRequested && <label className="field"><HelpLabel label={t("labs.jsonSchema")} helpKey="prompt.structured" /><textarea className="mono" rows={7} value={schemaText} onChange={(event) => { setSchemaText(event.target.value); clearResult(); }} /></label>}
        <Button onClick={run} loading={running} disabled={!prompt.trim() || !model || maxTokens < 1}><Play size={14} />{t("app.run")}</Button>
      </Panel>
    </div>
    <Panel title={t("labs.output")} helpKey="prompt.output" aside={result?.run_id ? <Link className="inline-link" href="/history">{t("labs.viewInHistory")}</Link> : undefined}>
      {result ? <div className="output-layout"><pre className="code-output">{result.text}</pre><dl className="usage-list"><div><dt><MetricLabel label={t("common.input")} helpKey="metric.inputTokens" /></dt><dd className="mono">{result.usage.input_tokens} {t("common.tokens")}</dd></div><div><dt><MetricLabel label={t("common.output")} helpKey="metric.outputTokens" /></dt><dd className="mono">{result.usage.output_tokens} {t("common.tokens")}</dd></div><div><dt><MetricLabel label={t("common.latency")} helpKey="metric.latency" /></dt><dd className="mono">{result.latency_ms} ms</dd></div><div><dt><MetricLabel label={t("common.schema")} helpKey="metric.schema" /></dt><dd>{resultSchemaRequested ? schemaValid === null ? t("labs.schemaNotChecked") : schemaValid ? t("common.valid") : t("common.invalid") : t("common.off")}</dd></div></dl></div> : <p className="empty-hint">{t("labs.runForResult")}</p>}
      {result && <p className="prompt-muted">{result.applied_settings ? `${t("labs.appliedSettings")}: ${JSON.stringify(result.applied_settings)}` : t("labs.settingsNotConfirmed")}</p>}
    </Panel>
  </>;
}

function explainGenerationError(caught: unknown, t: (key: string) => string) {
  const message = caught instanceof Error ? caught.message : t("labs.requestFailed");
  if (message.includes("not configured") || message.includes("missing")) return t("labs.providerNotConfigured");
  if (message.includes("Failed to fetch") || message.includes("ConnectError") || message.includes("HTTP 502")) return t("labs.backendUnavailable");
  return message;
}

function RangeField({ label, helpKey, value, onChange, max, step }: { label: string; helpKey: string; value: number; onChange: (value: number) => void; max: number; step: number }) {
  return <label className="field range-field"><span><HelpLabel label={label} helpKey={helpKey} /><strong className="mono">{value.toFixed(2)}</strong></span><input aria-label={label} type="range" min={0} max={max} step={step} value={value} onChange={(event) => onChange(Number(event.target.value))} /></label>;
}

export function tokenizePreview(text: string): string[] { return text.match(/[\p{L}\p{N}_'-]+|[^\s\p{L}\p{N}_]/gu) ?? []; }
export function isStructuredOutputValid(text: string): boolean { try { const value = JSON.parse(text) as unknown; return value !== null && typeof value === "object" && !Array.isArray(value); } catch { return false; } }
