"use client";

import { useEffect, useState } from "react";
import { useApp } from "@/components/app-provider";
import { AnswerReveal, HelpLabel } from "@/components/ui";
import { agentApi, type AgentRun } from "@/lib/agent-client";
import styles from "./agent-lab.module.css";

type FileInput = { name: string; content: string };
type AgentStep = { step: number; timestamp?: string; approval_decided_at?: string; state_before?: string; decision?: Record<string, unknown>; raw_output?: string; tool?: string; arguments?: unknown; tool_result?: unknown; state_after?: unknown; final?: string; error?: string; attempts?: Array<{ raw_output: string; usage?: { input_tokens?: number; output_tokens?: number }; latency_ms?: number }>; usage?: { input_tokens?: number; output_tokens?: number }; latency_ms?: number };
type PendingApproval = { id: string; tool: string; target: string; change: unknown; reason: string; requested_at: string };
type LabNote = { id: string; title: string; content: string; source_run_id: string | null; created_at: string };

const scenarioNames = ["success", "loop", "wrong_tool", "invalid_arguments", "timeout", "step_limit"] as const;
type Scenario = typeof scenarioNames[number];
function scenarioSteps(name: Scenario): AgentStep[] {
  if (name === "success") return [
    { step: 1, state_before: "goal: sum numbers.txt", decision: { tool: "read_file", arguments: { name: "numbers.txt" } }, tool: "read_file", arguments: { name: "numbers.txt" }, tool_result: { content: "14, 92, 31, 7, 48" }, state_after: { numbers: [14, 92, 31, 7, 48] } },
    { step: 2, state_before: "numbers: 14, 92, 31, 7, 48", decision: { tool: "calculator", arguments: { expression: "14+92+31+7+48" } }, tool: "calculator", arguments: { expression: "14+92+31+7+48" }, tool_result: { value: 192 }, state_after: { sum: 192 } },
    { step: 3, state_before: "sum: 192", decision: { final: "192" }, final: "192", state_after: { answer: "192" } },
  ];
  const tool = name === "wrong_tool" ? "send_email" : "calculator";
  const arguments_ = name === "invalid_arguments" ? { expression: [1, 2] } : { expression: "2+2" };
  const count = name === "loop" ? 3 : name === "step_limit" ? 4 : 1;
  const rows: AgentStep[] = Array.from({ length: count }, (_, index) => ({ step: index + 1, state_before: `goal: 2 + 2; previous steps: ${index}`, decision: { tool, arguments: arguments_ }, tool, arguments: arguments_, tool_result: name === "wrong_tool" ? { error: "Tool not allowed" } : name === "invalid_arguments" ? { error: "Expression must be text" } : { value: 4 }, state_after: { steps: index + 1 } }));
  if (name === "timeout") return [{ step: 1, state_before: "goal: 2 + 2", error: "Model did not respond within 45 seconds" }];
  return rows;
}

function statusLabel(status: AgentRun["status"], cs: boolean) {
  const labels = cs ? { queued: "Ve frontě", running: "Běží", completed: "Dokončeno", failed: "Chyba", cancelled: "Zrušeno", cancel_requested: "Ukončuje se" } : { queued: "Queued", running: "Running", completed: "Completed", failed: "Failed", cancelled: "Cancelled", cancel_requested: "Stopping" };
  return labels[status];
}

export function AgentsPage() {
  const { locale, selectedModel, modelsLoading } = useApp();
  const cs = locale === "cs";
  const [goal, setGoal] = useState("");
  const [files, setFiles] = useState<FileInput[]>([]);
  const [recordsText, setRecordsText] = useState("");
  const [maxSteps, setMaxSteps] = useState(6);
  const [memoryMode, setMemoryMode] = useState("recent");
  const [reflection, setReflection] = useState(false);
  const [dataMode, setDataMode] = useState<"simulated" | "managed">("simulated");
  const [scenario, setScenario] = useState<Scenario>("success");
  const [run, setRun] = useState<AgentRun | null>(null);
  const [recent, setRecent] = useState<AgentRun[]>([]);
  const [notes, setNotes] = useState<LabNote[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => { void agentApi<AgentRun[]>("/runs").then((items) => setRecent(items.filter((item) => item.kind === "agent").slice(0, 6))).catch(() => {}); }, []);
  useEffect(() => { void agentApi<LabNote[]>("/notes").then(setNotes).catch(() => {}); }, [run?.status]);
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
      const created = await agentApi<AgentRun>("/runs", { method: "POST", body: JSON.stringify({ model_key: selectedModel.key, goal: goal.trim(), files: fileMap, records, memory_mode: memoryMode, reflection, max_steps: maxSteps, data_mode: dataMode }) });
      setRun(created);
    } catch (cause) { setError((cause as Error).message); setBusy(false); }
  };
  const cancel = async () => {
    if (!run) return;
    try { setRun(await agentApi<AgentRun>(`/runs/${run.id}/cancel`, { method: "POST" })); }
    catch (cause) { setError((cause as Error).message); }
  };
  const loadScenario = (kind: "file" | "database" | "calculator") => {
    if (kind === "file") {
      setGoal(cs ? "Sečti čísla v numbers.txt a odpověz výsledkem." : "Add the numbers in numbers.txt and report the result.");
      setFiles([{ name: "numbers.txt", content: "14, 92, 31, 7, 48" }]);
      setRecordsText("");
    } else if (kind === "database") {
      setGoal(cs ? "Najdi v databázi objednávku A42 a řekni její stav." : "Find order A42 in the database and report its status.");
      setFiles([]);
      setRecordsText(JSON.stringify([{ order: "A42", status: cs ? "odesláno" : "shipped" }, { order: "B17", status: cs ? "čeká" : "pending" }], null, 2));
    } else {
      setGoal(cs ? "Použij kalkulačku a spočítej (24 * 3) + 18." : "Use the calculator to compute (24 * 3) + 18.");
      setFiles([]);
      setRecordsText("");
    }
    setRun(null); setError("");
  };
  const loadExample = () => loadScenario("file");
  const steps = (run?.results[0]?.steps || run?.trace || []) as AgentStep[];
  const result = run?.results[0] as { status?: string; answer?: string | null; reflection?: { text?: string } | null } | undefined;
  const pending = run?.status === "running" ? run.metrics.pending_approval as PendingApproval | undefined : undefined;
  const decide = async (approve: boolean) => {
    if (!run || !pending) return;
    try { await agentApi(`/runs/${run.id}/approval`, { method: "POST", body: JSON.stringify({ approval_id: pending.id, approve }) }); setRun(await agentApi<AgentRun>(`/runs/${run.id}`)); }
    catch (cause) { setError((cause as Error).message); }
  };

  return <div className={styles.page}>
    <header className={styles.header}><div><h1>{cs ? "Agent v LLMLab" : "LLMLab agent"}</h1><p>{cs ? "Sledujte každý krok agenta. Volitelný režim spravovaných dat umí číst dokumenty a datasety LLMLab; každý zápis vyžaduje samostatné schválení." : "Inspect every agent step. Optional managed mode can read LLMLab documents and datasets; each write requires separate approval."}</p></div><span className={styles.modelBadge}>{selectedModel ? `${selectedModel.provider}: ${selectedModel.id}` : modelsLoading ? cs ? "Načítám modely…" : "Loading models…" : cs ? "Vyberte model vpravo nahoře" : "Choose a model at the top right"}</span></header>
    <div className={styles.guideGrid}>
      <aside><strong>{cs ? "1. Zadejte cíl" : "1. Set a goal"}</strong><p>{cs ? "Napište konkrétní otázku, třeba „Sečti čísla v numbers.txt“. Tlačítko Načíst příklad vyplní zadání i soubor." : "Write a specific question, such as “Add the numbers in numbers.txt”. Load example fills in the task and file."}</p></aside>
      <aside><strong>{cs ? "2. Přidejte podklady" : "2. Add data"}</strong><p>{cs ? "Agent umí číst jen obsah simulovaných souborů a databáze, který vložíte do formuláře. Prázdná databáze nevadí." : "The agent can only read simulated files and database records entered in this form. An empty database is fine."}</p></aside>
      <aside><strong>{cs ? "3. Spusťte model" : "3. Run a model"}</strong><p>{cs ? "Vyberte model v horní liště a klikněte na Spustit agenta. „Dokončeno“ znamená konec běhu; správnost ověřte v odpovědi a krocích." : "Select a model in the top bar and click Run agent. “Completed” means the run ended; check the answer and steps for correctness."}</p></aside>
    </div>
    {error && <div className={styles.error} role="alert">{error}</div>}
    {result?.status === "invalid_output" && <div className={styles.error} role="alert"><strong>{cs ? "Pokus agenta se nepodařil" : "Agent attempt failed"}</strong><p>{cs ? "Model ani po opravě nevrátil jedno platné rozhodnutí. Žádný nástroj z neplatné odpovědi se nespustil. Zkuste jiný model nebo konkrétnější zadání; původní výstup je v krocích níže." : "The model still did not return one valid decision after a repair request. No tool from the invalid response ran. Try another model or a more specific task; the raw output is in the steps below."}</p></div>}
    <div className={styles.exampleChoices}><span>{cs ? "Příklady k vyzkoušení:" : "Runnable examples:"}</span><button type="button" onClick={() => loadScenario("file")}>{cs ? "Soubor" : "File"}</button><button type="button" onClick={() => loadScenario("database")}>{cs ? "Databáze" : "Database"}</button><button type="button" onClick={() => loadScenario("calculator")}>{cs ? "Kalkulačka" : "Calculator"}</button></div>
    <label className={styles.field}><HelpLabel label={cs ? "Přístup k datům" : "Data access"} helpKey="field.agentDataMode" /><select value={dataMode} onChange={(event) => setDataMode(event.target.value as "simulated" | "managed")}><option value="simulated">{cs ? "Jen simulované podklady" : "Simulated inputs only"}</option><option value="managed">{cs ? "Dokumenty, datasety a poznámky LLMLab" : "LLMLab documents, datasets and notes"}</option></select></label>
    {pending && <section className={styles.approval} role="alert"><h2>{cs ? "Agent čeká na schválení zápisu" : "Agent write awaiting approval"}</h2><p><strong>{cs ? "Cíl" : "Target"}:</strong> {pending.target}</p><p><strong>{cs ? "Důvod" : "Reason"}:</strong> {pending.reason}</p><p><strong>{cs ? "Přesná změna" : "Exact change"}:</strong></p><pre>{JSON.stringify(pending.change, null, 2)}</pre><div className={styles.actions}><button onClick={() => void decide(false)}>{cs ? "Zamítnout" : "Reject"}</button><button className={styles.primary} onClick={() => void decide(true)}>{cs ? "Schválit tento krok" : "Approve this step"}</button></div><small>{cs ? "Schválení platí jen pro tento konkrétní zápis." : "Approval applies only to this specific write."}</small></section>}
    <div className={styles.columns}>
      <section className={styles.panel}><div className={styles.panelHeading}><h2>{cs ? "Zadání" : "Task"}</h2><button className={styles.linkButton} type="button" onClick={loadExample}>{cs ? "Načíst příklad" : "Load example"}</button></div><label className={styles.field}><HelpLabel label={cs ? "Co má agent zjistit?" : "What should the agent find out?"} helpKey="field.agentTask" /><textarea rows={4} value={goal} onChange={(event) => setGoal(event.target.value)} placeholder={cs ? "Například: Spočítej součet čísel v souboru…" : "For example: Add the numbers in a file…"} /></label><div className={styles.field}><div className={styles.inlineHeading}><HelpLabel label={cs ? "Simulované soubory" : "Simulated files"} helpKey="field.agentFiles" /><button className={styles.linkButton} onClick={() => setFiles((items) => [...items, { name: "", content: "" }])}>{cs ? "Přidat soubor" : "Add file"}</button></div><small>{cs ? "Obsah zadáte tady; aplikace neotevírá skutečné soubory." : "Enter content here; the app does not open real files."}</small>{files.map((file, index) => <div className={styles.fileRow} key={index}><label className={styles.fileField}><HelpLabel label={cs ? "Název souboru" : "File name"} helpKey="field.agentFileName" /><input aria-label={cs ? `Název souboru ${index + 1}` : `File name ${index + 1}`} value={file.name} placeholder="notes.txt" onChange={(event) => setFiles((items) => items.map((item, position) => position === index ? { ...item, name: event.target.value } : item))} /></label><label className={styles.fileField}><HelpLabel label={cs ? "Obsah souboru" : "File content"} helpKey="field.agentFileContent" /><textarea aria-label={cs ? `Obsah souboru ${index + 1}` : `File content ${index + 1}`} rows={2} value={file.content} placeholder={cs ? "Text souboru" : "File text"} onChange={(event) => setFiles((items) => items.map((item, position) => position === index ? { ...item, content: event.target.value } : item))} /></label><button aria-label={cs ? "Odebrat soubor" : "Remove file"} onClick={() => setFiles((items) => items.filter((_, position) => position !== index))}>×</button></div>)}</div><label className={styles.field}><HelpLabel label={cs ? "Simulovaná databáze (JSON pole)" : "Simulated database (JSON array)"} helpKey="field.agentDatabase" /><small>{cs ? "Pro hledání záznamů. Nechte prázdné, pokud ji nepotřebujete." : "For record searches. Leave empty if you do not need it."}</small><textarea className={styles.mono} rows={4} value={recordsText} onChange={(event) => setRecordsText(event.target.value)} placeholder='[{"name":"Example","value":42}]' /></label><div className={styles.formPair}><label className={styles.field}><HelpLabel label={cs ? "Paměť" : "Memory"} helpKey="field.agentMemory" /><select value={memoryMode} onChange={(event) => setMemoryMode(event.target.value)}><option value="none">{cs ? "Bez paměti" : "None"}</option><option value="recent">{cs ? "Poslední 3 kroky" : "Last 3 steps"}</option><option value="summary">{cs ? "Stručný souhrn" : "Short summary"}</option><option value="structured">{cs ? "Strukturované výsledky" : "Structured results"}</option></select></label><label className={styles.field}><span><HelpLabel label={cs ? "Limit kroků" : "Step limit"} helpKey="field.agentSteps" /> · {maxSteps}</span><input type="range" min="1" max="12" value={maxSteps} onChange={(event) => setMaxSteps(Number(event.target.value))} /></label></div><label className={styles.check}><input type="checkbox" checked={reflection} onChange={(event) => setReflection(event.target.checked)} /><HelpLabel label={cs ? "Při neúspěchu požádat model o krátké poučení (další volání)" : "Ask the model for a brief lesson after failure (extra call)"} helpKey="field.agentReflection" /></label><div className={styles.actions}><button className={styles.primary} disabled={!selectedModel || !goal.trim() || busy} onClick={start}>{busy ? cs ? "Agent pracuje…" : "Agent running…" : cs ? "Spustit agenta" : "Run agent"}</button>{run && ["queued", "running"].includes(run.status) && <button onClick={cancel}>{cs ? "Zastavit" : "Stop"}</button>}</div><p className={styles.hint}>{cs ? "Dostupné nástroje: číst simulovaný soubor, hledat v simulované databázi a bezpečně počítat." : "Tools: read a simulated file, search a simulated database, and calculate safely."}</p></section>
      <section className={styles.panel}><div className={styles.panelHeading}><h2>{cs ? "Odpověď a stopa" : "Answer and trace"}</h2>{run && <span className={styles.statusBadge} data-status={result?.status === "invalid_output" ? "failed" : run.status}>{result?.status === "invalid_output" ? cs ? "Neúspěšný pokus" : "Failed attempt" : statusLabel(run.status, cs)}</span>}</div>{!run ? <div className={styles.empty}><strong>{cs ? "Zatím žádný běh" : "No run yet"}</strong><p>{cs ? "Zadejte cíl, případné podklady a spusťte agenta. Zde uvidíte každé rozhodnutí." : "Enter a goal and optional data, then run the agent. Every decision will appear here."}</p></div> : <><div className={styles.result}>{run.status === "failed" ? <p className={styles.errorText}>{run.error}</p> : result?.answer ? <><span>{cs ? "Závěrečná odpověď" : "Final answer"}</span><AnswerReveal answer={result.answer} locale={locale} initiallyOpen /></> : <p>{result?.status === "invalid_output" ? cs ? "Pokus se nepodařil: neplatný výstup modelu." : "Attempt failed: invalid model output." : run.status === "completed" ? cs ? `Agent skončil: ${result?.status || "bez odpovědi"}.` : `Agent stopped: ${result?.status || "no answer"}.` : cs ? "Agent zpracovává další krok…" : "Agent is working on the next step…"}</p>}</div><div className={styles.trace}><h3>{cs ? "Kroky" : "Steps"} <span>{steps.length}</span></h3>{steps.map((step) => <article key={step.step}><div className={styles.stepHead}><strong>{cs ? "Krok" : "Step"} {step.step}</strong><span>{step.tool || (step.final ? cs ? "Odpověď" : "Answer" : cs ? "Rozhodnutí" : "Decision")}</span></div>{step.raw_output && <pre>{step.raw_output}</pre>}{step.attempts && step.attempts.length > 1 && <details className={styles.attempts}><summary>{cs ? "Původní výstup a opravný pokus" : "Original output and repair attempt"}</summary>{step.attempts.map((attempt, index) => <div key={index}><strong>{index === 0 ? cs ? "Původní výstup" : "Original output" : cs ? "Oprava formátu" : "Format repair"}</strong><pre>{attempt.raw_output}</pre><small>{attempt.usage?.input_tokens ?? 0} / {attempt.usage?.output_tokens ?? 0} {cs ? "tokenů" : "tokens"} · {attempt.latency_ms ?? 0} ms</small></div>)}</details>}{step.tool_result !== undefined && <div className={styles.toolResult}><small>{cs ? "Výsledek nástroje" : "Tool result"}</small><pre>{JSON.stringify(step.tool_result, null, 2)}</pre></div>}{step.error && <p className={styles.errorText}>{step.error}</p>}<small className={styles.stepMeta}>{step.usage?.input_tokens ?? 0} / {step.usage?.output_tokens ?? 0} {cs ? "tokenů" : "tokens"} · {step.latency_ms ?? 0} ms</small></article>)}</div>{result?.reflection?.text && <div className={styles.reflection}><strong>{cs ? "Poučení pro příští pokus" : "Lesson for next attempt"}</strong><p>{result.reflection.text}</p></div>}</>}</section>
    </div>
    {steps.length > 0 && <section className={styles.panel}><h2>{cs ? "Časová osa rozhodnutí" : "Decision timeline"}</h2><ol className={styles.timeline}>{steps.map((step) => <li key={step.step}><time>{step.timestamp ? new Date(step.timestamp).toLocaleString(locale) : "—"}</time><strong>{cs ? "Krok" : "Step"} {step.step}: {step.tool || (step.final ? cs ? "odpověď" : "answer" : cs ? "chyba" : "error")}</strong>{step.approval_decided_at && <span>{cs ? "Schválení vyřízeno" : "Approval decided"}: {new Date(step.approval_decided_at).toLocaleString(locale)} · {JSON.stringify(step.tool_result)}</span>}</li>)}</ol></section>}
    {steps.length > 0 && <section className={styles.panel}><div className={styles.panelHeading}><h2>{cs ? "Stavový průchod" : "State flow"}</h2></div><div className={styles.flowList}>{steps.map((step) => <article key={step.step}><strong>{cs ? "Krok" : "Step"} {step.step}</strong><div><span>{cs ? "Stav před" : "State before"}</span><pre>{step.state_before ?? "—"}</pre></div><div><span>{cs ? "Rozhodnutí modelu" : "Model decision"}</span><pre>{JSON.stringify(step.error ? step.raw_output ?? step.error : step.decision ?? step.raw_output ?? step.error, null, 2)}</pre></div><div><span>{cs ? "Nástroj a argumenty" : "Tool and arguments"}</span><pre>{step.tool ? `${step.tool} ${JSON.stringify(step.arguments)}` : "—"}</pre></div><div><span>{cs ? "Výsledek" : "Result"}</span><pre>{JSON.stringify(step.tool_result ?? step.final ?? step.error ?? "—", null, 2)}</pre></div><div><span>{cs ? "Nový stav" : "New state"}</span><pre>{JSON.stringify(step.state_after ?? "—", null, 2)}</pre></div></article>)}</div></section>}
    <section className={styles.panel}><div className={styles.panelHeading}><h2>{cs ? "Galerie průchodů agenta" : "Agent trace gallery"}</h2></div><div className={styles.scenarioGallery}><p>{cs ? "Deterministická ukázka souborového příkladu a typických chyb bez volání modelu." : "Deterministic file example and common failure traces without model calls."}</p><label className={styles.field}><HelpLabel label={cs ? "Scénář" : "Scenario"} helpKey="field.agentScenario" /><select value={scenario} onChange={(event) => setScenario(event.target.value as Scenario)}>{scenarioNames.map((name) => <option key={name} value={name}>{name.replaceAll("_", " ")}</option>)}</select></label><div className={styles.flowList}>{scenarioSteps(scenario).map((step) => <article key={step.step}><strong>{cs ? "Krok" : "Step"} {step.step}</strong><p>{step.tool ? `${step.tool} ${JSON.stringify(step.arguments)}` : JSON.stringify(step.decision)}</p><pre>{JSON.stringify(step.tool_result ?? step.final ?? step.error, null, 2)}</pre></article>)}</div><p>{scenario === "loop" ? cs ? "Tři stejná volání ukončí běh detekcí smyčky." : "Three repeated calls stop the run via loop detection." : scenario === "step_limit" ? cs ? "Limit kroků zastaví běh bez závěrečné odpovědi." : "The step limit stops the run without a final answer." : ""}</p></div></section>
    {recent.length > 0 && <section className={styles.panel}><h2>{cs ? "Poslední běhy" : "Recent runs"}</h2><div className={styles.recent}>{recent.map((item) => <button key={item.id} onClick={() => { setRun(item); setError(""); }}><span>{item.model_key}</span><span className={styles.statusBadge} data-status={item.results[0]?.status === "invalid_output" ? "failed" : item.status}>{item.results[0]?.status === "invalid_output" ? cs ? "Neúspěšný pokus" : "Failed attempt" : statusLabel(item.status, cs)}</span><span>{new Date(item.created_at).toLocaleString(locale)}</span></button>)}</div></section>}
    {notes.length > 0 && <section className={styles.panel}><h2>{cs ? "Poznámky agenta" : "Agent notes"}</h2><div className={styles.flowList}>{notes.slice(0, 10).map((note) => <article key={note.id}><strong>{note.title}</strong><p>{note.content}</p><small>{new Date(note.created_at).toLocaleString(locale)}</small></article>)}</div></section>}
    {run && <section className={styles.panel}><h2>{cs ? "Cena provozu" : "Operating cost"}</h2><div className={styles.usage}><strong>{run.usage.cost_usd == null ? cs ? "Cena neznámá" : "Price unknown" : `$${run.usage.cost_usd.toFixed(4)}`}</strong><span>{run.usage.input_tokens ?? 0} / {run.usage.output_tokens ?? 0} {cs ? "vstupních / výstupních tokenů" : "input / output tokens"}</span></div></section>}
  </div>;
}
