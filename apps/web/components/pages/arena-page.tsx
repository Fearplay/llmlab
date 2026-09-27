"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useApp } from "@/components/app-provider";
import { AnswerReveal, HelpLabel, InfoTip, PageHeader, RunStatus } from "@/components/ui";
import { errorMessage, fetchJson, formatCost, type ExperimentRecord, type ExperimentResult } from "./live-api";
import styles from "./live-pages.module.css";

interface DatasetOption { id: string; name: string; version?: number; cases?: unknown[] }
const runningStatuses = new Set(["queued", "running", "cancel_requested"]);

export function ArenaPage() {
  const { locale, models, selectedModel } = useApp();
  const cs = locale === "cs";
  const [selectedKeys, setSelectedKeys] = useState<string[]>([]);
  const [prompt, setPrompt] = useState("");
  const [systemPrompt, setSystemPrompt] = useState("");
  const [expected, setExpected] = useState("");
  const [evidence, setEvidence] = useState("");
  const [temperature, setTemperature] = useState(0.3);
  const [topP, setTopP] = useState(1);
  const [maxTokens, setMaxTokens] = useState(512);
  const [judgeKey, setJudgeKey] = useState("");
  const [orderCheck, setOrderCheck] = useState(false);
  const [blind, setBlind] = useState(false);
  const [blindPairs, setBlindPairs] = useState<Array<{ case_id: string; A: string; B: string }>>([]);
  const [votes, setVotes] = useState<Record<string, { choice: string; models: { A: string; B: string }; votes: Record<string, number> }>>({});
  const [datasets, setDatasets] = useState<DatasetOption[]>([]);
  const [datasetId, setDatasetId] = useState("");
  const [run, setRun] = useState<ExperimentRecord | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const available = useMemo(() => models.filter((model) => model.available && (Array.isArray(model.capabilities) ? model.capabilities.includes("generation") : model.capabilities?.generation)), [models]);

  useEffect(() => {
    if (!available.length) return;
    queueMicrotask(() => setSelectedKeys((current) => current.length ? current : [selectedModel?.key ?? available[0].key, ...available.filter((item) => item.key !== (selectedModel?.key ?? available[0].key)).slice(0, 1).map((item) => item.key)]));
  }, [available, selectedModel?.key]);
  useEffect(() => {
    fetchJson<DatasetOption[] | { datasets: DatasetOption[] }>("/api/v1/datasets")
      .then((data) => setDatasets(Array.isArray(data) ? data : data.datasets ?? []))
      .catch(() => undefined);
  }, []);
  useEffect(() => {
    if (!run || !runningStatuses.has(run.status)) return;
    const timer = window.setTimeout(() => {
      fetchJson<ExperimentRecord>(`/api/v1/experiments/${encodeURIComponent(run.id)}`)
        .then(setRun)
        .catch((caught) => setError(errorMessage(caught, locale)));
    }, 1500);
    return () => window.clearTimeout(timer);
  }, [run, locale]);
  useEffect(() => {
    if (!blind || !run || run.status !== "completed") return;
    fetchJson<{ pairs: Array<{ case_id: string; A: string; B: string }> }>(`/api/v1/experiments/${encodeURIComponent(run.id)}/blind`).then((value) => setBlindPairs(value.pairs)).catch((caught) => setError(errorMessage(caught, locale)));
  }, [blind, run, locale]);

  const toggleModel = (key: string) => setSelectedKeys((current) => current.includes(key) ? current.filter((item) => item !== key) : current.length < 8 ? [...current, key] : current);
  const submit = async () => {
    if (selectedKeys.length < 2 || (blind && selectedKeys.length !== 2) || (!prompt.trim() && !datasetId) || maxTokens < 1 || maxTokens > 4096) return;
    if (evidence.trim().split(/\n\s*\n/).filter(Boolean).length > 20) { setError(cs ? "Použij nejvýše 20 samostatných pasáží." : "Use at most 20 separate evidence passages."); return; }
    setError(null);
    setSubmitting(true);
    setRun(null);
    setBlindPairs([]); setVotes({});
    try {
      const created = await fetchJson<ExperimentRecord>("/api/v1/experiments", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({
        name: cs ? "Porovnání modelů" : "Model comparison", kind: "arena", model_keys: selectedKeys,
        prompt: prompt.trim(), system_prompt: systemPrompt.trim(), expected: expected.trim() || null,
        evidence: evidence.trim() ? evidence.trim().split(/\n\s*\n/).map((item) => item.trim()).filter(Boolean) : [], dataset_id: datasetId || null,
        temperature, top_p: topP, max_tokens: maxTokens,
        judge_model_key: judgeKey || null, order_check: orderCheck,
      }) });
      setRun(created);
    } catch (caught) { setError(errorMessage(caught, locale)); }
    finally { setSubmitting(false); }
  };
  const vote = async (caseId: string, choice: "A" | "B" | "tie") => {
    if (!run) return;
    try {
      const outcome = await fetchJson<{ choice: string; models: { A: string; B: string }; votes: Record<string, number> }>(`/api/v1/experiments/${encodeURIComponent(run.id)}/vote`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ case_id: caseId, choice }) });
      setVotes((current) => ({ ...current, [caseId]: outcome }));
    } catch (caught) { setError(errorMessage(caught, locale)); }
  };

  const results = run?.results ?? [];
  const complete = results.filter((item) => item.status === "completed");
  const referenceAvailable = Boolean(expected.trim() || datasetId);
  const qualityWinner = referenceAvailable && run?.metrics?.quality_available ? run.metrics.quality_winner : null;
  const latencyResults = complete.filter((item) => typeof item.latency_ms === "number");
  const timedModels = (run?.metrics?.models ?? []).filter((item) => item.average_latency_ms !== null && item.completed === item.cases);
  const fastest = run?.status === "completed" && timedModels.length ? [...timedModels].sort((a, b) => (a.average_latency_ms ?? Infinity) - (b.average_latency_ms ?? Infinity))[0].model_key : null;
  const groupedResults = complete.reduce((groups, item) => { groups.set(item.model_key, [...(groups.get(item.model_key) ?? []), item]); return groups; }, new Map<string, ExperimentResult[]>());
  const modelCosts = [...groupedResults.entries()].flatMap(([key, items]) => {
    const metric = run?.metrics?.models?.find((candidate) => candidate.model_key === key);
    const costsKnown = items.every((item) => typeof item.cost?.estimated_usd === "number" && (!item.judge || typeof item.judge.cost?.estimated_usd === "number") && (!item.order_check || typeof item.order_check.cost?.estimated_usd === "number"));
    return metric && metric.completed === metric.cases && items.length === metric.cases && costsKnown
      ? [{ key, total: items.reduce((sum, item) => sum + (item.cost?.estimated_usd ?? 0) + (item.judge?.cost?.estimated_usd ?? 0) + (item.order_check?.cost?.estimated_usd ?? 0), 0) }] : [];
  });
  const cheapest = run?.status === "completed" && modelCosts.length ? [...modelCosts].sort((a, b) => a.total - b.total)[0].key : null;
  const maxLatency = Math.max(1, ...latencyResults.map((item) => item.latency_ms ?? 0));

  return <div className={styles.layout}>
    <PageHeader title={cs ? "Aréna modelů" : "Model arena"} description={cs ? "Pošli stejný prompt nebo dataset několika modelům. Odpovědi, čas a spotřebu uvidíš vedle sebe." : "Send one prompt or dataset to several models. Compare answers, time, and usage side by side."} />
    <div className={styles.grid}>
      <section className={styles.panel} aria-labelledby="arena-task"><div className={styles.panelHead}><h2 id="arena-task">{cs ? "Zadání" : "Task"}</h2></div><div className={styles.panelBody}>
        <div className={styles.buttonRow}><button type="button" className={styles.secondaryButton} onClick={() => { setPrompt(cs ? "Kolik minut má jedna hodina? Odpověz stručně." : "How many minutes are in one hour? Answer briefly."); setExpected(cs ? "60 minut" : "60 minutes"); setEvidence(cs ? "Jedna hodina má 60 minut." : "One hour has 60 minutes."); }}>{cs ? "Načíst faktickou úlohu" : "Load fact task"}</button><button type="button" className={styles.secondaryButton} onClick={() => { setPrompt(cs ? "Vymysli dvě různé metafory pro učení nové dovednosti." : "Write two different metaphors for learning a new skill."); setExpected(""); setEvidence(""); }}>{cs ? "Načíst tvůrčí úlohu" : "Load creative task"}</button></div>
        <label className={styles.field}><HelpLabel label={cs ? "Prompt" : "Prompt"} helpKey="prompt.message" /><textarea rows={5} maxLength={8000} value={prompt} onChange={(event) => setPrompt(event.target.value)} placeholder={cs ? "Na co se chceš modelů zeptat?" : "What would you like to ask the models?"} /></label>
        <label className={styles.field}><HelpLabel label={cs ? "Systémová instrukce (volitelné)" : "System instruction (optional)"} helpKey="prompt.system" /><textarea rows={2} maxLength={4000} value={systemPrompt} onChange={(event) => setSystemPrompt(event.target.value)} /></label>
        {datasets.length > 0 && <label className={styles.field}><HelpLabel label={cs ? "Nebo testovací dataset" : "Or a test dataset"} helpKey="field.arenaDataset" /><select value={datasetId} onChange={(event) => setDatasetId(event.target.value)}><option value="">{cs ? "Bez datasetu" : "No dataset"}</option>{datasets.map((item) => <option key={item.id} value={item.id}>{item.name}{item.version ? ` v${item.version}` : ""}</option>)}</select></label>}
        <label className={styles.field}><HelpLabel label={cs ? "Očekávaná odpověď (volitelné)" : "Reference answer (optional)"} helpKey="field.referenceAnswer" /><textarea rows={2} maxLength={8000} value={expected} onChange={(event) => setExpected(event.target.value)} /><small>{cs ? "S referencí můžeme měřit shodu. Bez ní neurčujeme vítěze kvality ani halucinace." : "A reference allows matching. Without one, we do not name a quality winner or claim hallucinations."}</small></label>
        <label className={styles.field}><HelpLabel label={cs ? "Podklady pro kontrolu tvrzení (volitelné)" : "Evidence for checking claims (optional)"} helpKey="field.sourceCorpus" /><textarea rows={2} value={evidence} onChange={(event) => setEvidence(event.target.value)} /></label>
      </div></section>
      <section className={styles.panel} aria-labelledby="arena-models"><div className={styles.panelHead}><h2 id="arena-models">{cs ? "Modely" : "Models"} <InfoTip label={cs ? "Výběr modelů" : "Model selection"} helpKey="field.modelSelection" context="field" /></h2><span className={styles.status}>{selectedKeys.length} {cs ? "vybrané" : "selected"}</span></div><div className={styles.panelBody}>
        {available.length ? <div className={styles.modelList}>{available.map((item) => <label key={item.key} className={styles.modelRow}><input type="checkbox" checked={selectedKeys.includes(item.key)} disabled={selectedKeys.length >= 8 && !selectedKeys.includes(item.key)} onChange={() => toggleModel(item.key)} /><InfoTip label={cs ? `Model ${item.id}` : `Model ${item.id}`} helpKey="field.modelSelection" context="field" /><span><strong>{item.id}</strong><small>{item.provider} · {item.mode === "local" ? cs ? "lokálně" : "local" : "cloud"}</small></span></label>)}</div> : <div className={styles.empty}>{cs ? "Zatím nejsou dostupné alespoň dva generativní modely. Spusť Ollamu nebo přidej cloudový klíč v nastavení." : "There are not yet two available generation models. Start Ollama or add a cloud key in Settings."}</div>}
        <p className={styles.inlineNote}>{cs ? "Vyber alespoň dva. Cloudové požadavky mohou být zpoplatněny." : "Choose at least two. Cloud requests may incur charges."}</p>
        <div className={styles.twoFields}><Range label={cs ? "Teplota" : "Temperature"} value={temperature} max={2} step={0.1} onChange={setTemperature} /><Range label="Top-p" value={topP} max={1} step={0.05} onChange={setTopP} /></div>
        <label className={styles.field}><HelpLabel label={cs ? "Maximum výstupních tokenů" : "Maximum output tokens"} helpKey="prompt.maxTokens" /><input type="number" min={1} max={4096} value={maxTokens} onChange={(event) => setMaxTokens(Number(event.target.value))} /></label>
        <label className={styles.field}><HelpLabel label={cs ? "AI soudce (volitelné)" : "AI judge (optional)"} helpKey="field.aiJudge" /><select value={judgeKey} onChange={(event) => setJudgeKey(event.target.value)}><option value="">{cs ? "Bez soudce" : "No judge"}</option>{available.map((item) => <option key={item.key} value={item.key}>{item.provider}: {item.id}</option>)}</select><small>{cs ? "Hodnocení soudce je názor dalšího modelu a může mít vlastní cenu." : "A judge is another model's opinion and may add cost."}</small></label>
        <label className={styles.checkRow}><input type="checkbox" checked={orderCheck} onChange={(event) => setOrderCheck(event.target.checked)} /><HelpLabel label={cs ? "Ověřit vliv pořadí podkladů" : "Check evidence order effects"} helpKey="field.orderCheck" /></label>
        <label className={styles.checkRow}><input type="checkbox" checked={blind} onChange={(event) => { setBlind(event.target.checked); if (event.target.checked) setSelectedKeys((keys) => keys.slice(0, 2)); }} /><HelpLabel label={cs ? "Anonymní A/B: nejprve hlasovat, potom odhalit modely (přesně dva modely)" : "Blind A/B: vote before revealing models (exactly two models)"} helpKey="field.blindArena" /></label>
        <div className={styles.buttonRow}><button className={styles.primaryButton} disabled={submitting || selectedKeys.length < 2 || (blind && selectedKeys.length !== 2) || (!prompt.trim() && !datasetId) || maxTokens < 1 || maxTokens > 4096} onClick={() => void submit()}>{submitting ? cs ? "Spouštím…" : "Starting…" : cs ? "Spustit arénu" : "Run arena"}</button></div>
      </div></section>
    </div>
    {error && <div className={styles.empty} role="alert">{error}</div>}
    {run && <section className={styles.panel} aria-labelledby="arena-results"><div className={styles.panelHead}><h2 id="arena-results">{cs ? "Výsledky" : "Results"}</h2><div className={styles.runProgress}><RunStatus status={run.status} /><span>{run.progress ?? 0}%</span></div></div><div className={styles.panelBody}>
      {run.error && <div className={styles.empty} role="alert">{run.error}</div>}
      {runningStatuses.has(run.status) && <p className={styles.inlineNote} role="status">{cs ? "Modely odpovídají. Výsledky se průběžně obnovují." : "Models are responding. Results refresh automatically."}</p>}
      {blind ? <div className={styles.resultGrid}>{blindPairs.map((pair) => <div key={pair.case_id} className={styles.resultCard}><h3>{pair.case_id}</h3><div className={styles.blindPair}><article><strong>A</strong><p>{pair.A}</p></article><article><strong>B</strong><p>{pair.B}</p></article></div>{votes[pair.case_id] ? <p className={styles.inlineNote}>{cs ? "Hlas" : "Vote"}: {votes[pair.case_id].choice} · A = {votes[pair.case_id].models.A} · B = {votes[pair.case_id].models.B} · {cs ? "celkem hlasů" : "total votes"}: {Object.values(votes[pair.case_id].votes).reduce((sum, value) => sum + value, 0)}</p> : <div className={styles.buttonRow}><button className={styles.secondaryButton} onClick={() => void vote(pair.case_id, "A")}>A</button><button className={styles.secondaryButton} onClick={() => void vote(pair.case_id, "B")}>B</button><button className={styles.secondaryButton} onClick={() => void vote(pair.case_id, "tie")}>{cs ? "Remíza" : "Tie"}</button></div>}</div>)}{!blindPairs.length && <p>{cs ? "Čekám na dvojici odpovědí…" : "Waiting for two answers…"}</p>}</div> : <>{complete.length > 0 && <div className={styles.verdicts}><Verdict label={cs ? "Kvalita" : "Quality"} value={qualityWinner ?? (run.metrics?.quality_available ? cs ? "Bez jasného vítěze" : "No clear winner" : cs ? "Bez referenčního skóre" : "No reference score")} /><Verdict label={cs ? "Nejrychlejší" : "Fastest"} value={fastest ?? "—"} /><Verdict label={cs ? "Nejnižší známá cena" : "Lowest known cost"} value={cheapest ?? "—"} /></div>}{latencyResults.length > 1 && <div className={styles.chartList} aria-label={cs ? "Graf doby odpovědi" : "Response time chart"}>{latencyResults.map((item) => <div className={styles.chartRow} key={`${item.case_id ?? "one"}-${item.model_key}`}><span title={item.model_key}>{item.model_key}</span><div className={styles.chartTrack}><span style={{ width: `${Math.max(2, (item.latency_ms ?? 0) / maxLatency * 100)}%` }} /></div><strong>{item.latency_ms} ms</strong></div>)}</div>}{results.length ? <div className={styles.resultGrid}>{results.map((item, index) => <ResultCard key={`${item.case_id ?? "one"}-${item.model_key}-${index}`} result={item} locale={locale} referenceAvailable={referenceAvailable} />)}</div> : <div className={styles.empty}>{cs ? "Čekám na první odpověď…" : "Waiting for the first answer…"}</div>}</>}
      <p className={styles.inlineNote}>{cs ? "Čas a cena mají vlastní pořadí. Faktickou správnost bez referenční odpovědi nebo důkazů neurčujeme." : "Speed and cost have separate rankings. We do not infer factual correctness without a reference or evidence."} <Link href="/history" className="link">{cs ? "Historie běhů" : "Run history"}</Link></p>
    </div></section>}
  </div>;
}

function Range({ label, value, max, step, onChange }: { label: string; value: number; max: number; step: number; onChange: (value: number) => void }) {
  return <label className={styles.field}><span className={styles.fieldHeader}><HelpLabel label={label} helpKey={label === "Top-p" ? "prompt.topP" : "prompt.temperature"} /><strong>{value.toFixed(2)}</strong></span><input type="range" min={0} max={max} step={step} value={value} onChange={(event) => onChange(Number(event.target.value))} /></label>;
}
function Verdict({ label, value }: { label: string; value: string }) { return <div className={styles.verdict}><span>{label}</span><strong>{value}</strong></div>; }
function ResultCard({ result, locale, referenceAvailable }: { result: ExperimentResult; locale: "en" | "cs"; referenceAvailable: boolean }) {
  const cs = locale === "cs";
  return <article className={styles.resultCard}><h3>{result.model_key}</h3><RunStatus status={result.status} />{result.case_id && <span className={styles.inlineNote}> {result.case_id}</span>}
    {result.output ? <AnswerReveal answer={result.output} locale={locale} /> : <p>{result.error ?? (cs ? "Zatím bez odpovědi" : "No answer yet")}</p>}
    <div className={styles.resultMeta}><span><strong>{result.latency_ms ?? "—"}</strong> ms</span><span>{cs ? "vstup" : "input"} <strong>{result.usage?.input_tokens ?? "—"}</strong></span><span>{cs ? "výstup" : "output"} <strong>{result.usage?.output_tokens ?? "—"}</strong></span><span>{cs ? "odhad ceny" : "cost estimate"} <strong>{formatCost(result.cost?.estimated_usd, locale)}</strong></span></div>
    {referenceAvailable && result.grade && <p className={styles.inlineNote}>{cs ? "Shoda s referencí" : "Reference match"}: {result.grade.passed ? cs ? "ano" : "yes" : cs ? "ne" : "no"} ({result.grade.method ?? "grade"}{typeof result.grade.score === "number" ? ` ${Math.round(result.grade.score * 100)}%` : ""})</p>}
    {result.judge && <p className={styles.inlineNote}>{cs ? "Názor AI soudce" : "AI judge opinion"}: {result.judge.opinion ?? "—"} · {formatCost(result.judge.cost?.estimated_usd, locale)}</p>}
    {result.judge?.prompt && <details className={styles.inlineNote}><summary>{cs ? "Model a prompt soudce" : "Judge model and prompt"}</summary><p>{result.judge.model_key}</p><pre>{JSON.stringify(result.judge.prompt, null, 2)}</pre></details>}
    {result.order_check && <p className={styles.inlineNote}>{cs ? "Po prohození podkladů" : "After reversing evidence"}: {result.order_check.same_answer ? cs ? "stejná odpověď" : "same answer" : cs ? "jiná odpověď" : "different answer"}. {result.order_check.reversed_output}</p>}
  </article>;
}
