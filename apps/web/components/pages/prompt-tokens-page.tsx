"use client";

import { Braces, Play } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useApp } from "@/components/app-provider";
import { Button, Combobox, HelpLabel, InfoTip, MetricLabel, ModeSelector, Notice, PageHeader, Panel, ProvenanceStrip, Select } from "@/components/ui";
import type { ExecutionMode } from "@/lib/types";

const colors = ["token-blue", "token-green", "token-orange", "token-violet"];
const fixtureOutput = `{
  "answer": "Worn footwear cannot be returned because returned items must be new and unworn.",
  "citations": ["returns_footwear.md#eligibility"],
  "confidence": 0.96
}`;
const cloudModelDefaults: Record<string, string> = {
  openai: "gpt-4.1",
  anthropic: "claude-sonnet-5",
  gemini: "gemini-3.8-flash",
  openai_compatible: "model-name",
};
const providerModels: Record<string, string[]> = {
  fixture: ["fixture-gen-v1"],
  ollama: ["llama3.2", "qwen2.5", "mistral", "gemma3"],
  openai: ["gpt-6-astra", "gpt-5.6-sol", "gpt-5.6-terra", "gpt-5.6-luna", "gpt-5.6", "gpt-5", "gpt-5-mini", "gpt-5-nano", "gpt-4.1", "gpt-4.1-mini"],
  anthropic: ["claude-fable-5-1", "claude-opus-5", "claude-sonnet-5", "claude-haiku-4-5-20251001"],
  gemini: ["gemini-3.8-flash", "gemini-3.7-flash", "gemini-3.5-flash", "gemini-2.5-flash"],
  openai_compatible: [],
};

interface LiveGenerationResult {
  text: string;
  provider: string;
  model: string;
  mode: ExecutionMode;
  usage: { input_tokens: number; output_tokens: number; cached_tokens: number; cost_usd: number | null };
  latency_ms: number;
  fixture: boolean;
}

export function PromptTokensPage() {
  const { t, mode, setMode } = useApp();
  const [text, setText] = useState("Explain why a customer cannot return worn footwear. Cite the relevant policy.");
  const [systemText, setSystemText] = useState("");
  const [temperature, setTemperature] = useState(0.2);
  const [topP, setTopP] = useState(0.9);
  const [structured, setStructured] = useState(true);
  const [seed, setSeed] = useState(42);
  const [stopSequence, setStopSequence] = useState("none");
  const [running, setRunning] = useState(false);
  const [provider, setProvider] = useState("openai");
  const [cloudModel, setCloudModel] = useState(cloudModelDefaults.openai);
  const [localModel, setLocalModel] = useState("llama3.2");
  const [result, setResult] = useState<LiveGenerationResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const tokens = useMemo(() => text.match(/[\w'-]+|[^\s\w]/g) ?? [], [text]);
  useEffect(() => {
    queueMicrotask(() => {
      setText(t("labs.promptSample"));
      setSystemText(t("labs.systemSample"));
    });
  }, [t]);
  const activeProvider = mode === "fixture" ? "fixture" : mode === "local" ? "ollama" : provider;
  const activeModel = mode === "fixture" ? "fixture-gen-v1" : mode === "local" ? localModel : cloudModel;
  const modelOptions = providerModels[activeProvider] ?? [];
  const run = async () => {
    setRunning(true);
    setError(null);
    setResult(null);
    if (mode === "fixture") {
      window.setTimeout(() => {
        setResult({ text: structured ? fixtureOutput : "Worn footwear is excluded because eligible returns must be new and unworn. [returns_footwear.md]", provider: "fixture", model: "fixture-gen-v1", mode: "fixture", usage: { input_tokens: 48, output_tokens: 37, cached_tokens: 0, cost_usd: 0 }, latency_ms: 412, fixture: true });
        setRunning(false);
      }, 550);
      return;
    }
    try {
      const response = await fetch("/api/v1/generation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode,
          provider: activeProvider,
          model: activeModel,
          messages: [{ role: "system", content: systemText }, { role: "user", content: text }],
          temperature,
          top_p: topP,
          seed,
          response_schema: structured && provider === "openai" ? {
            type: "object",
            properties: { answer: { type: "string" }, citations: { type: "array", items: { type: "string" } }, confidence: { type: "number" } },
            required: ["answer", "citations", "confidence"],
            additionalProperties: false,
          } : null,
        }),
      });
      const rawBody = await response.text();
      let body: (LiveGenerationResult & { detail?: string }) | null = null;
      try {
        body = JSON.parse(rawBody) as LiveGenerationResult & { detail?: string };
      } catch {
        // A proxy or crashed service may return plain text or HTML. Preserve that useful error.
      }
      if (!response.ok) throw new Error(body?.detail || rawBody.trim() || `${response.status} ${response.statusText}`);
      if (!body) throw new Error(t("labs.invalidProviderResponse"));
      setResult(body);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t("labs.requestFailed"));
    } finally {
      setRunning(false);
    }
  };

  return <>
    <PageHeader title={t("labs.promptTitle")} description={t("labs.promptSubtitle")} actions={<ModeSelector value={mode} onChange={setMode} />} helpKey="prompt.page" />
    <ProvenanceStrip mode={result?.mode ?? mode} provider={result?.provider ?? activeProvider} model={result?.model ?? activeModel} tail={result ? `${result.usage.input_tokens + result.usage.output_tokens} tokens · ${result.latency_ms} ms` : t("labs.noResultYet")} />
    {error && <Notice tone="danger" title={t("labs.requestFailed")}>{error}</Notice>}
    <div className="lab-grid two-one">
      <Panel title={t("labs.input")} helpKey="prompt.input">
        <label className="field"><HelpLabel label={t("labs.systemLabel")} helpKey="prompt.system" /><textarea aria-label={t("labs.systemLabel")} rows={5} value={systemText} onChange={(event) => setSystemText(event.target.value)} /></label>
        <label className="field"><HelpLabel label={t("labs.userMessage")} helpKey="prompt.message" /><textarea aria-label={t("labs.userMessage")} rows={7} value={text} onChange={(event) => setText(event.target.value)} /></label>
        <div className="token-ribbon" aria-label="Token estimate">{tokens.map((token, index) => <span className={colors[index % colors.length]} key={`${token}-${index}`}>{token}</span>)}</div>
        <div className="token-summary"><Braces size={16} /><strong className="mono">{tokens.length}</strong><span>{t("labs.estimatedTokens")}</span><InfoTip label={t("labs.estimatedTokens")} helpKey="prompt.tokens" context="metric" /><small>{t("labs.measuredNote")}</small></div>
      </Panel>
      <Panel title={t("labs.samplingContract")} helpKey="prompt.sampling">
        <label className="field"><HelpLabel label={t("app.provider")} helpKey="prompt.provider" /><Select value={activeProvider} disabled={mode !== "cloud"} onChange={(next) => { setProvider(next); setCloudModel(cloudModelDefaults[next] ?? "model-name"); setResult(null); }} ariaLabel={t("app.provider")}>{mode === "fixture" ? <option value="fixture">Fixture engine</option> : mode === "local" ? <option value="ollama">Ollama</option> : <><option value="openai">OpenAI</option><option value="anthropic">Anthropic</option><option value="gemini">Gemini</option><option value="openai_compatible">OpenAI-compatible</option></>}</Select></label>
        <div className="field"><HelpLabel label={t("app.model")} helpKey="prompt.model" /><Combobox key={activeProvider} ariaLabel={t("app.model")} value={activeModel} options={modelOptions} disabled={mode === "fixture"} onChange={(next) => mode === "local" ? setLocalModel(next) : setCloudModel(next)} /><small>{t("labs.modelPickerHint")}</small></div>
        <RangeField label={t("labs.temperature")} helpKey="prompt.temperature" value={temperature} onChange={setTemperature} max={2} step={0.1} />
        <RangeField label={t("labs.topP")} helpKey="prompt.topP" value={topP} onChange={setTopP} max={1} step={0.05} />
        <label className="field"><HelpLabel label={t("labs.seed")} helpKey="prompt.seed" /><input aria-label={t("labs.seed")} type="number" value={seed} onChange={(event) => setSeed(Number(event.target.value))} /></label>
        <label className="toggle-row"><input aria-label={t("labs.structured")} type="checkbox" checked={structured} onChange={(event) => setStructured(event.target.checked)} /><span><span className="toggle-title"><strong>{t("labs.structured")}</strong><InfoTip label={t("labs.structured")} helpKey="prompt.structured" context="field" /></span><small>{t("labs.schemaContract")}</small></span></label>
        <label className="field"><HelpLabel label={t("labs.stopSequence")} helpKey="prompt.stop" /><Select value={stopSequence} onChange={setStopSequence} ariaLabel={t("labs.stopSequence")}><option value="none">{t("labs.none")}</option><option value="end">&lt;END&gt;</option></Select></label>
        <Button onClick={run} loading={running}><Play size={14} />{t("app.run")}</Button>
      </Panel>
    </div>
    <Panel title={t("labs.output")} helpKey="prompt.output" aside={<span className="panel-meta mono">seed {seed} · temp {temperature.toFixed(1)}</span>}>
      {result ? <div className="output-layout"><pre className="code-output">{result.text}</pre><dl className="usage-list"><div><dt><MetricLabel label={t("common.input")} helpKey="metric.inputTokens" /></dt><dd className="mono">{result.usage.input_tokens} {t("common.tokens")}</dd></div><div><dt><MetricLabel label={t("common.output")} helpKey="metric.outputTokens" /></dt><dd className="mono">{result.usage.output_tokens} {t("common.tokens")}</dd></div><div><dt><MetricLabel label={t("common.latency")} helpKey="metric.latency" /></dt><dd className="mono">{result.latency_ms} ms</dd></div><div><dt><MetricLabel label={t("common.schema")} helpKey="metric.schema" /></dt><dd>{structured ? t("common.valid") : t("common.off")}</dd></div></dl></div> : <p className="empty-hint">{t("labs.runForResult")}</p>}
    </Panel>
  </>;
}

function RangeField({ label, helpKey, value, onChange, max, step }: { label: string; helpKey: string; value: number; onChange: (value: number) => void; max: number; step: number }) {
  return <label className="field range-field"><span><HelpLabel label={label} helpKey={helpKey} /><strong className="mono">{value.toFixed(2)}</strong></span><input aria-label={label} type="range" min={0} max={max} step={step} value={value} onChange={(event) => onChange(Number(event.target.value))} /></label>;
}
