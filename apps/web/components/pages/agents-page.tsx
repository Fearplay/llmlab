"use client";

import { useEffect, useState } from "react";
import { useApp } from "@/components/app-provider";
import { agentApi, type AgentRun } from "@/lib/agent-client";
import styles from "./agent-lab.module.css";

type FileInput = { name: string; content: string };
type AgentStep = { step: number; raw_output?: string; tool?: string; tool_result?: unknown; final?: string; error?: string; usage?: { input_tokens?: number; output_tokens?: number }; latency_ms?: number };

export function AgentsPage() {
  const { locale, selectedModel, modelsLoading } = useApp();
  const cs = locale === "cs";
  const [goal, setGoal] = useState("");
  const [files, setFiles] = useState<FileInput[]>([]);
  const [recordsText, setRecordsText] = useState("");
  const [maxSteps, setMaxSteps] = useState(6);
  const [memoryMode, setMemoryMode] = useState("recent");
  const [reflection, setReflection] = useState(false);
  const [run, setRun] = useState<AgentRun | null>(null);
  const [recent, setRecent] = useState<AgentRun[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => { void agentApi<AgentRun[]>("/runs").then((items) => setRecent(items.filter((item) => item.kind === "agent").slice(0, 6))).catch(() => {}); }, []);
  useEffect(() => {
    if (!run || !["queued", "running", "cancel_requested"].includes(run.status)) return;
    const timer = window.setInterval(() => {
      void agentApi<AgentRun>(`/runs/${run.id}`).then((next) => {
        setRun(next);
        if (!["queued", "running", "cancel_requested"].includes(next.status)) {
          setBusy(false);
          void agentApi<AgentRun[]>("/runs").then((items) => setRecent(items.filter((item) => item.kind === "agent").slice(0, 6))).catch(() => {});
        }
      }).catch((cause) => { setError((cause as Error).message); setBusy(false); });
    }, 850);
    return () => window.clearInterval(timer);
  }, [run]);

  const start = async () => {
    if (!selectedModel || !goal.trim()) return;
    setError(""); setBusy(true); setRun(null);
    try {
      let records: Record<string, unknown>[] = [];
      if (recordsText.trim()) {
        const parsed: unknown = JSON.parse(recordsText);
        if (!Array.isArray(parsed) || parsed.some((item) => !item || typeof item !== "object" || Array.isArray(item))) throw new Error(cs ? "Databáze musí být JSON pole objektů." : "Database must be a JSON array of objects.");
        records = parsed as Record<string, unknown>[];
      }
      const fileMap = Object.fromEntries(files.filter((file) => file.name.trim()).map((file) => [file.name.trim(), file.content]));
      const created = await agentApi<AgentRun>("/runs", { method: "POST", body: JSON.stringify({ model_key: selectedModel.key, goal: goal.trim(), files: fileMap, records, memory_mode: memoryMode, reflection, max_steps: maxSteps }) });
      setRun(created);
    } catch (cause) { setError((cause as Error).message); setBusy(false); }
  };
  const cancel = async () => {
    if (!run) return;
    try { setRun(await agentApi<AgentRun>(`/runs/${run.id}/cancel`, { method: "POST" })); }
    catch (cause) { setError((cause as Error).message); }
  };
  const loadExample = () => {
    setGoal(cs ? "Sečti čísla v numbers.txt a odpověz výsledkem." : "Add the numbers in numbers.txt and report the result.");
    setFiles([{ name: "numbers.txt", content: "14, 92, 31, 7, 48" }]);
    setRecordsText(""); setRun(null); setError("");
  };
  const steps = (run?.results[0]?.steps || run?.trace || []) as AgentStep[];
  const result = run?.results[0] as { status?: string; answer?: string | null; reflection?: { text?: string } | null } | undefined;

  return <div className={styles.page}>
    <header className={styles.header}><div><h1>{cs ? "Agent v sandboxu" : "Sandbox agent"}</h1><p>{cs ? "Dejte modelu cíl a sledujte, které simulované nástroje skutečně použije. Žádný nástroj nečte vaše soubory ani databázi." : "Give a model a goal and inspect which simulated tools it actually uses. No tool reads your files or database."}</p></div><span className={styles.modelBadge}>{selectedModel ? `${selectedModel.provider}: ${selectedModel.id}` : modelsLoading ? cs ? "Načítám modely…" : "Loading models…" : cs ? "Vyberte model vpravo nahoře" : "Choose a model at the top right"}</span></header>
    {error && <div className={styles.error} role="alert">{error}</div>}
    <div className={styles.columns}>
      <section className={styles.panel}><div className={styles.panelHeading}><h2>{cs ? "Zadání" : "Task"}</h2><button className={styles.linkButton} type="button" onClick={loadExample}>{cs ? "Načíst příklad" : "Load example"}</button></div><label className={styles.field}><span>{cs ? "Co má agent zjistit?" : "What should the agent find out?"}</span><textarea rows={4} value={goal} onChange={(event) => setGoal(event.target.value)} placeholder={cs ? "Například: Spočítej součet čísel v souboru…" : "For example: Add the numbers in a file…"} /></label><div className={styles.field}><div className={styles.inlineHeading}><span>{cs ? "Simulované soubory" : "Simulated files"}</span><button className={styles.linkButton} onClick={() => setFiles((items) => [...items, { name: "", content: "" }])}>{cs ? "Přidat soubor" : "Add file"}</button></div><small>{cs ? "Obsah zadáte tady; aplikace neotevírá skutečné soubory." : "Enter content here; the app does not open real files."}</small>{files.map((file, index) => <div className={styles.fileRow} key={index}><input aria-label={cs ? `Název souboru ${index + 1}` : `File name ${index + 1}`} value={file.name} placeholder="notes.txt" onChange={(event) => setFiles((items) => items.map((item, position) => position === index ? { ...item, name: event.target.value } : item))} /><textarea aria-label={cs ? `Obsah souboru ${index + 1}` : `File content ${index + 1}`} rows={2} value={file.content} placeholder={cs ? "Text souboru" : "File text"} onChange={(event) => setFiles((items) => items.map((item, position) => position === index ? { ...item, content: event.target.value } : item))} /><button aria-label={cs ? "Odebrat soubor" : "Remove file"} onClick={() => setFiles((items) => items.filter((_, position) => position !== index))}>×</button></div>)}</div><label className={styles.field}><span>{cs ? "Simulovaná databáze (JSON pole)" : "Simulated database (JSON array)"}</span><small>{cs ? "Pro hledání záznamů. Nechte prázdné, pokud ji nepotřebujete." : "For record searches. Leave empty if you do not need it."}</small><textarea className={styles.mono} rows={4} value={recordsText} onChange={(event) => setRecordsText(event.target.value)} placeholder='[{"name":"Example","value":42}]' /></label><div className={styles.formPair}><label className={styles.field}><span>{cs ? "Paměť" : "Memory"}</span><select value={memoryMode} onChange={(event) => setMemoryMode(event.target.value)}><option value="none">{cs ? "Bez paměti" : "None"}</option><option value="recent">{cs ? "Poslední 3 kroky" : "Last 3 steps"}</option><option value="summary">{cs ? "Stručný souhrn" : "Short summary"}</option><option value="structured">{cs ? "Strukturované výsledky" : "Structured results"}</option></select></label><label className={styles.field}><span>{cs ? "Limit kroků" : "Step limit"} · {maxSteps}</span><input type="range" min="1" max="12" value={maxSteps} onChange={(event) => setMaxSteps(Number(event.target.value))} /></label></div><label className={styles.check}><input type="checkbox" checked={reflection} onChange={(event) => setReflection(event.target.checked)} /><span>{cs ? "Při neúspěchu požádat model o krátké poučení (další volání)" : "Ask the model for a brief lesson after failure (extra call)"}</span></label><div className={styles.actions}><button className={styles.primary} disabled={!selectedModel || !goal.trim() || busy} onClick={start}>{busy ? cs ? "Agent pracuje…" : "Agent running…" : cs ? "Spustit agenta" : "Run agent"}</button>{run && ["queued", "running"].includes(run.status) && <button onClick={cancel}>{cs ? "Zastavit" : "Stop"}</button>}</div><p className={styles.hint}>{cs ? "Dostupné nástroje: číst simulovaný soubor, hledat v simulované databázi a bezpečně počítat." : "Tools: read a simulated file, search a simulated database, and calculate safely."}</p></section>
      <section className={styles.panel}><div className={styles.panelHeading}><h2>{cs ? "Odpověď a stopa" : "Answer and trace"}</h2>{run && <span className={styles.status}>{run.status}</span>}</div>{!run ? <div className={styles.empty}><strong>{cs ? "Zatím žádný běh" : "No run yet"}</strong><p>{cs ? "Zadejte cíl, případné podklady a spusťte agenta. Zde uvidíte každé rozhodnutí." : "Enter a goal and optional data, then run the agent. Every decision will appear here."}</p></div> : <><div className={styles.result}>{run.status === "failed" ? <p className={styles.errorText}>{run.error}</p> : result?.answer ? <><span>{cs ? "Závěrečná odpověď" : "Final answer"}</span><p>{result.answer}</p></> : <p>{run.status === "completed" ? cs ? `Agent skončil: ${result?.status || "bez odpovědi"}.` : `Agent stopped: ${result?.status || "no answer"}.` : cs ? "Agent zpracovává další krok…" : "Agent is working on the next step…"}</p>}</div><div className={styles.trace}><h3>{cs ? "Kroky" : "Steps"} <span>{steps.length}</span></h3>{steps.map((step) => <article key={step.step}><div className={styles.stepHead}><strong>{cs ? "Krok" : "Step"} {step.step}</strong><span>{step.tool || (step.final ? cs ? "Odpověď" : "Answer" : cs ? "Rozhodnutí" : "Decision")}</span></div>{step.raw_output && <pre>{step.raw_output}</pre>}{step.tool_result !== undefined && <div className={styles.toolResult}><small>{cs ? "Výsledek nástroje" : "Tool result"}</small><pre>{JSON.stringify(step.tool_result, null, 2)}</pre></div>}{step.error && <p className={styles.errorText}>{step.error}</p>}<small className={styles.stepMeta}>{step.usage?.input_tokens ?? 0} / {step.usage?.output_tokens ?? 0} {cs ? "tokenů" : "tokens"} · {step.latency_ms ?? 0} ms</small></article>)}</div>{result?.reflection?.text && <div className={styles.reflection}><strong>{cs ? "Poučení pro příští pokus" : "Lesson for next attempt"}</strong><p>{result.reflection.text}</p></div>}<div className={styles.usage}>{cs ? "Spotřeba" : "Usage"}: {run.usage.input_tokens ?? 0} / {run.usage.output_tokens ?? 0} {cs ? "tokenů" : "tokens"} · {run.usage.cost_usd == null ? cs ? "cena neznámá" : "price unknown" : `$${run.usage.cost_usd.toFixed(4)}`}</div></>}</section>
    </div>
    {recent.length > 0 && <section className={styles.panel}><h2>{cs ? "Poslední běhy" : "Recent runs"}</h2><div className={styles.recent}>{recent.map((item) => <button key={item.id} onClick={() => { setRun(item); setError(""); }}><span>{item.model_key}</span><span>{item.status}</span><span>{new Date(item.created_at).toLocaleString(locale)}</span></button>)}</div></section>}
  </div>;
}
