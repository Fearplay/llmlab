"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useApp } from "@/components/app-provider";
import { AnswerReveal, HelpLabel, PageHeader, RunStatus } from "@/components/ui";
import { errorMessage, fetchJson, formatCost, formatDate, type EpisodeRecord, type ExperimentRecord, type ExperimentResult } from "./live-api";
import styles from "./live-pages.module.css";
import improvementStyles from "./improvements.module.css";

type Filters = { kind: string; status: string; model: string; days: string };
type SavedView = { name: string; filters: Filters };
const emptyFilters: Filters = { kind: "", status: "", model: "", days: "" };

export function HistoryPage() {
  const { locale } = useApp();
  const cs = locale === "cs";
  const [tab, setTab] = useState<"runs" | "episodes">("runs");
  const [runs, setRuns] = useState<ExperimentRecord[]>([]);
  const [episodes, setEpisodes] = useState<EpisodeRecord[]>([]);
  const [episodeDetails, setEpisodeDetails] = useState<Record<string, EpisodeRecord>>({});
  const [loading, setLoading] = useState(true);
  const [runsError, setRunsError] = useState<string | null>(null);
  const [episodesError, setEpisodesError] = useState<string | null>(null);
  const [filters, setFilters] = useState<Filters>(emptyFilters);
  const [views, setViews] = useState<SavedView[]>([]);
  const [viewName, setViewName] = useState("");
  const [filterAsOf, setFilterAsOf] = useState(0);
  useEffect(() => { if (filters.days) queueMicrotask(() => setFilterAsOf(Date.now())); }, [filters.days]);
  useEffect(() => { try { const value = JSON.parse(localStorage.getItem("llmlab.savedViews.v1") ?? "[]") as unknown;
    if (Array.isArray(value)) queueMicrotask(() => setViews(value.filter((item): item is SavedView =>
      !!item && typeof item === "object" && typeof item.name === "string" && !!item.filters)));
  } catch { /* Optional saved views. */ } }, []);
  const saveView = () => {
    if (!viewName.trim()) return;
    const next = [...views.filter((item) => item.name !== viewName.trim()), { name: viewName.trim(), filters }];
    localStorage.setItem("llmlab.savedViews.v1", JSON.stringify(next)); setViews(next); setViewName("");
  };
  const filteredRuns = runs.filter((run) => (!filters.kind || run.kind === filters.kind)
    && (!filters.status || run.status === filters.status)
    && (!filters.model || `${run.model ?? ""} ${JSON.stringify(run.spec?.model_keys ?? [])}`.toLowerCase().includes(filters.model.toLowerCase()))
    && (!filters.days || !!run.created_at && filterAsOf - new Date(run.created_at).getTime() <= Number(filters.days) * 86_400_000));

  const refresh = useCallback(async () => {
    setLoading(true);
    const [runResult, episodeResult] = await Promise.allSettled([
      fetchJson<ExperimentRecord[] | { runs: ExperimentRecord[] }>("/api/v1/experiments"),
      fetchJson<{ episodes: EpisodeRecord[] } | EpisodeRecord[]>("/api/v1/game/episodes"),
    ]);
    if (runResult.status === "fulfilled") { setRuns(Array.isArray(runResult.value) ? runResult.value : runResult.value.runs ?? []); setRunsError(null); }
    else setRunsError(errorMessage(runResult.reason, locale));
    if (episodeResult.status === "fulfilled") { setEpisodes(Array.isArray(episodeResult.value) ? episodeResult.value : episodeResult.value.episodes ?? []); setEpisodesError(null); }
    else setEpisodesError(errorMessage(episodeResult.reason, locale));
    setLoading(false);
  }, [locale]);

  useEffect(() => { queueMicrotask(() => void refresh()); }, [refresh]);
  const loadEpisode = async (id: string) => {
    if (episodeDetails[id]) return;
    try {
      const detail = await fetchJson<EpisodeRecord>(`/api/v1/game/episodes/${encodeURIComponent(id)}`);
      setEpisodeDetails((current) => ({ ...current, [id]: detail }));
    } catch (caught) { setEpisodesError(errorMessage(caught, locale)); }
  };

  return <div className={styles.layout}>
    <PageHeader title={cs ? "Historie běhů" : "Run history"} description={cs ? "Otevři uložený experiment nebo herní epizodu a prohlédni zadání, odpovědi, nastavení i spotřebu." : "Open a saved experiment or game episode to inspect inputs, answers, settings, and usage."} actions={<button className={styles.secondaryButton} onClick={() => void refresh()}>{cs ? "Obnovit" : "Refresh"}</button>} />
    <div className={styles.tabs} role="tablist" aria-label={cs ? "Typ záznamu" : "Record type"}><button role="tab" aria-selected={tab === "runs"} onClick={() => setTab("runs")}>{cs ? "Experimenty" : "Experiments"} ({runs.length})</button><button role="tab" aria-selected={tab === "episodes"} onClick={() => setTab("episodes")}>{cs ? "Herní epizody" : "Game episodes"} ({episodes.length})</button></div>
    {tab === "runs" && <section className={improvementStyles.panel}><h2>{cs ? "Pohledy na historii" : "History views"}</h2><div className={improvementStyles.grid}><label className={improvementStyles.field}><HelpLabel label={cs ? "Typ pokusu" : "Run type"} helpKey="history.kindFilter" /><select value={filters.kind} onChange={(event) => setFilters({ ...filters, kind: event.target.value })}><option value="">{cs ? "Všechny" : "All"}</option>{Array.from(new Set(runs.map((item) => item.kind))).map((kind) => <option key={kind} value={kind}>{kind}</option>)}</select></label><label className={improvementStyles.field}><HelpLabel label={cs ? "Stav" : "Status"} helpKey="history.statusFilter" /><select value={filters.status} onChange={(event) => setFilters({ ...filters, status: event.target.value })}><option value="">{cs ? "Všechny" : "All"}</option>{["completed", "failed", "cancelled", "running"].map((item) => <option key={item} value={item}>{item}</option>)}</select></label><label className={improvementStyles.field}><HelpLabel label={cs ? "Model" : "Model"} helpKey="history.modelFilter" /><input value={filters.model} onChange={(event) => setFilters({ ...filters, model: event.target.value })} /></label><label className={improvementStyles.field}><HelpLabel label={cs ? "Období" : "Period"} helpKey="history.periodFilter" /><select value={filters.days} onChange={(event) => setFilters({ ...filters, days: event.target.value })}><option value="">{cs ? "Vše" : "All time"}</option><option value="7">{cs ? "Posledních 7 dní" : "Last 7 days"}</option><option value="30">{cs ? "Posledních 30 dní" : "Last 30 days"}</option></select></label></div><div className={improvementStyles.row}><label className={improvementStyles.field}><HelpLabel label={cs ? "Název pohledu" : "View name"} helpKey="history.viewName" /><input value={viewName} onChange={(event) => setViewName(event.target.value)} /></label><button onClick={saveView} disabled={!viewName.trim()}>{cs ? "Uložit pohled" : "Save view"}</button>{views.map((item) => <button key={item.name} onClick={() => setFilters(item.filters)}>{item.name}</button>)}<button onClick={() => setFilters(emptyFilters)}>{cs ? "Vymazat filtry" : "Clear filters"}</button></div><p>{filteredRuns.length} / {runs.length} {cs ? "záznamů" : "runs"}</p></section>}
    {loading && <div className={styles.empty} role="status">{cs ? "Načítám uložené záznamy…" : "Loading saved records…"}</div>}
    {!loading && tab === "runs" && <>
      {runsError && <div className={styles.empty} role="alert">{runsError}</div>}
      {!runsError && runs.length === 0 && <div className={styles.empty}>{cs ? "Historie je prázdná. Napiš první prompt nebo spusť arénu; výsledek se uloží sem." : "History is empty. Run your first prompt or arena comparison; its result will appear here."} <Link href="/ai-lab/prompt-tokens" className="link">{cs ? "Otevřít Prompt a tokeny" : "Open Prompt & Tokens"}</Link></div>}
      <div className={styles.recordList}>{filteredRuns.map((run) => <RunEntry key={run.id} run={run} locale={locale} />)}</div>
      <ModelGuess runs={runs} locale={locale} />
    </>}
    {!loading && tab === "episodes" && <>
      {episodesError && <div className={styles.empty} role="alert">{episodesError}</div>}
      {!episodesError && episodes.length === 0 && <div className={styles.empty}>{cs ? "Zatím tu není žádná herní epizoda. Spusť Flappy AI a výsledek se uloží sem." : "No game episodes yet. Run Flappy AI and its result will appear here."} <Link href="/ai-lab/flappy" className="link">Flappy AI</Link></div>}
      <div className={styles.recordList}>{episodes.map((episode) => <EpisodeEntry key={episode.id} episode={episodeDetails[episode.id] ?? episode} locale={locale} onOpen={() => void loadEpisode(episode.id)} />)}</div>
    </>}
  </div>;
}

function ModelGuess({ runs, locale }: { runs: ExperimentRecord[]; locale: "en" | "cs" }) {
  const cs = locale === "cs";
  const [index, setIndex] = useState(0);
  const [guess, setGuess] = useState<string | null>(null);
  const puzzles = runs.flatMap((run) => {
    if (run.kind !== "arena" || run.status !== "completed") return [];
    const results = (run.results ?? []).filter((item) => item.status === "completed" && !!item.output);
    const byCase = new Map<string, ExperimentResult[]>();
    for (const result of results) byCase.set(result.case_id ?? "one", [...(byCase.get(result.case_id ?? "one") ?? []), result]);
    return [...byCase.values()].filter((items) => items.length >= 2 && items[0].model_key !== items[1].model_key)
      .map((items) => ({ answers: [items[0].output!, items[1].output!], correct: items[0].model_key,
        other: items[1].model_key, choices: [items[0].model_key, items[1].model_key] }));
  });
  const puzzle = puzzles[index % puzzles.length];
  return <section className={improvementStyles.panel}><h2>{cs ? "Hádanka: který model odpověděl?" : "Guess which model answered"}</h2>{puzzle ? <><p>{cs ? "Přečtěte dvě anonymní odpovědi. Tipněte, který model napsal A; obě jména se odhalí až po tipu." : "Read two anonymous answers. Guess which model wrote A; both names appear only after your guess."}</p><div className={improvementStyles.grid}>{puzzle.answers.map((answer, answerIndex) => <div className={improvementStyles.card} key={answerIndex}><strong>{answerIndex === 0 ? "A" : "B"}</strong><p>{answer}</p></div>)}</div><p>{cs ? "Který model napsal A?" : "Which model wrote A?"}</p><div className={improvementStyles.row}>{puzzle.choices.map((choice) => <button key={choice} disabled={guess !== null} onClick={() => setGuess(choice)}>{choice}</button>)}</div>{guess && <p role="status">{guess === puzzle.correct ? (cs ? "Správně!" : "Correct!") : (cs ? "Tentokrát ne." : "Not this time.")} A = {puzzle.correct}; B = {puzzle.other}.</p>}<div className={improvementStyles.row}><button onClick={() => { setIndex((value) => value + 1); setGuess(null); }} disabled={puzzles.length < 2}>{cs ? "Další hádanka" : "Next puzzle"}</button></div></> : <p>{cs ? "Nejprve spusťte arénu se dvěma modely, aby vznikly anonymní odpovědi." : "Run an arena comparison with two models first."}</p>}</section>;
}

function RunEntry({ run, locale }: { run: ExperimentRecord; locale: "en" | "cs" }) {
  const cs = locale === "cs";
  const spec = run.spec ?? {};
  const results = Array.isArray(run.results) ? run.results : [];
  const messages = Array.isArray(spec.messages) ? spec.messages.filter((item): item is { role: string; content: string } => Boolean(item) && typeof item === "object" && typeof item.role === "string" && typeof item.content === "string") : [];
  const prompt = typeof spec.prompt === "string" ? spec.prompt : typeof spec.input === "object" && spec.input && "prompt" in spec.input ? String((spec.input as { prompt: unknown }).prompt) : messages.filter((item) => item.role === "user").map((item) => item.content).join("\n") || null;
  const system = typeof spec.system_prompt === "string" ? spec.system_prompt : messages.filter((item) => item.role === "system").map((item) => item.content).join("\n");
  const settings = typeof spec.settings === "object" && spec.settings ? spec.settings as Record<string, unknown> : Object.fromEntries(["temperature", "top_p", "max_tokens", "stop", "seed"].filter((key) => spec[key] !== undefined).map((key) => [key, spec[key]]));
  const modelKeys = Array.isArray(spec.model_keys) ? spec.model_keys.join(", ") : run.model ?? "—";
  const costs = results.flatMap((item) => [item.cost?.estimated_usd, ...([item.judge, item.order_check].filter((extra) => extra && typeof extra === "object").map((extra) => typeof extra?.cost === "object" && extra.cost && "estimated_usd" in extra.cost ? extra.cost.estimated_usd as number | null : undefined))]);
  const knownCost = costs.length && costs.every((item) => typeof item === "number") ? costs.reduce<number>((sum, item) => sum + (item ?? 0), 0) : run.usage?.cost_usd;
  return <details className={styles.record}><summary><strong>{run.name || run.kind || (cs ? "Běh" : "Run")}</strong><RunStatus status={run.status} /><small>{formatDate(run.created_at, locale)}</small></summary><div className={styles.recordBody}>
    <dl className={styles.recordDetails}><div><dt>{cs ? "Typ" : "Type"}</dt><dd>{run.kind ?? "prompt"}</dd></div><div><dt>{cs ? "Modely" : "Models"}</dt><dd>{modelKeys}</dd></div><div><dt>{cs ? "Vstupní tokeny" : "Input tokens"}</dt><dd>{run.usage?.input_tokens ?? "—"}</dd></div><div><dt>{cs ? "Výstupní tokeny" : "Output tokens"}</dt><dd>{run.usage?.output_tokens ?? "—"}</dd></div><div><dt>{cs ? "Odhad ceny" : "Cost estimate"}</dt><dd>{formatCost(knownCost, locale)}</dd></div></dl>
    {prompt && <section><h3>{cs ? "Zadání" : "Prompt"}</h3><p>{prompt}</p></section>}
    {system && <section><h3>{cs ? "Systémová instrukce" : "System instruction"}</h3><p>{system}</p></section>}
    {Object.keys(settings).length > 0 && <section><h3>{cs ? "Nastavení" : "Settings"}</h3><p>{Object.entries(settings).map(([key, value]) => `${key}: ${Array.isArray(value) ? value.join(", ") : String(value)}`).join(" · ")}</p></section>}
    {run.error && <section><h3>{cs ? "Chyba" : "Error"}</h3><p>{run.error}</p></section>}
    {results.length > 0 && <div className={styles.resultGrid}>{results.map((result, index) => <SavedResult key={`${result.model_key}-${result.case_id ?? index}`} result={result} locale={locale} />)}</div>}
    {!results.length && run.status === "completed" && <p>{cs ? "Tento starší záznam neobsahuje uloženou odpověď." : "This older record has no saved answer."}</p>}
    {run.metrics?.quality_winner && <p>{cs ? "Vítěz podle referenční kvality" : "Reference quality winner"}: {run.metrics.quality_winner}</p>}
  </div></details>;
}

function SavedResult({ result, locale }: { result: ExperimentResult; locale: "en" | "cs" }) {
  return <article className={styles.resultCard}><h3>{result.model_key}</h3><RunStatus status={result.status} />{result.case_id && <small> {result.case_id}</small>}{result.output ? <AnswerReveal answer={result.output} locale={locale} /> : <p>{result.error ?? "—"}</p>}<div className={styles.resultMeta}><span>{result.latency_ms ?? "—"} ms</span><span>{result.usage?.input_tokens ?? "—"} / {result.usage?.output_tokens ?? "—"} {locale === "cs" ? "tokenů" : "tokens"}</span><span>{formatCost(result.cost?.estimated_usd, locale)}</span></div>
    {result.grade && <p className={styles.inlineNote}>{locale === "cs" ? "Hodnocení" : "Grade"}: {result.grade.method ?? "—"} · {typeof result.grade.score === "number" ? `${Math.round(result.grade.score * 100)}%` : "—"}</p>}
    {result.grade?.reason && <p className={styles.inlineNote}>{result.grade.reason}</p>}
    {result.grade?.error && <p className={styles.inlineNote} role="alert">{result.grade.error}</p>}
    {result.grade?.model_key && <p className={styles.inlineNote}>{locale === "cs" ? "Model hodnotitele" : "Evaluator model"}: {result.grade.model_key}</p>}
    {result.grade?.prompt && <details className={styles.inlineNote}><summary>{locale === "cs" ? "Prompt hodnotitele" : "Evaluator prompt"}</summary><pre>{result.grade.prompt}</pre></details>}
    {result.grade?.forbidden_facts_found?.length ? <p className={styles.inlineNote}>{locale === "cs" ? "Nalezené zakázané informace" : "Forbidden facts found"}: {result.grade.forbidden_facts_found.join(", ")}</p> : null}
    {result.judge && <p className={styles.inlineNote}>{locale === "cs" ? "Názor AI soudce" : "AI judge opinion"}: {result.judge.opinion ?? "—"}</p>}
    {result.judge?.prompt && <details className={styles.inlineNote}><summary>{locale === "cs" ? "Prompt AI soudce" : "AI judge prompt"}</summary><pre>{JSON.stringify(result.judge.prompt, null, 2)}</pre></details>}
    {result.order_check && <p className={styles.inlineNote}>{locale === "cs" ? "Při obráceném pořadí podkladů" : "With evidence order reversed"}: {result.order_check.same_answer ? locale === "cs" ? "stejná odpověď" : "same answer" : locale === "cs" ? "jiná odpověď" : "different answer"}. {result.order_check.reversed_output}</p>}
  </article>;
}

function EpisodeEntry({ episode, locale, onOpen }: { episode: EpisodeRecord; locale: "en" | "cs"; onOpen: () => void }) {
  const cs = locale === "cs";
  const replay = episode.replay && typeof episode.replay === "object" ? episode.replay as { decisions?: Array<{ index?: number; action?: string; callback_ms?: number; reason?: string }> } : null;
  return <details className={styles.record} onToggle={(event) => { if (event.currentTarget.open) onOpen(); }}><summary><strong>{episode.model_key ?? episode.agent}</strong><RunStatus status={episode.status} /><small>{formatDate(episode.created_at, locale)}</small></summary><div className={styles.recordBody}>
    <dl className={styles.recordDetails}><div><dt>{cs ? "Skóre" : "Score"}</dt><dd>{episode.score ?? "—"}</dd></div><div><dt>Seed</dt><dd>{episode.seed ?? "—"}</dd></div><div><dt>{cs ? "Rozhodnutí" : "Decisions"}</dt><dd>{episode.decision_count ?? "—"}</dd></div><div><dt>{cs ? "Snímky" : "Frames"}</dt><dd>{episode.frames ?? "—"}</dd></div><div><dt>{cs ? "Odhad ceny" : "Cost estimate"}</dt><dd>{formatCost(episode.cost_usd, locale)}</dd></div></dl>
    {episode.death_reason && <p>{cs ? "Konec hry" : "Game ended"}: {episode.death_reason}</p>}{episode.error && <p role="alert">{episode.error}</p>}
    {replay?.decisions?.length ? <section><h3>{cs ? "Rozhodnutí agenta" : "Agent decisions"}</h3><div className={styles.recordDetails}>{replay.decisions.slice(0, 12).map((decision, index) => <div key={index}><dt>#{decision.index ?? index + 1}</dt><dd>{decision.action ?? "—"}{decision.callback_ms ? ` · ${Math.round(decision.callback_ms)} ms` : ""}</dd></div>)}</div>{replay.decisions.length > 12 && <p>{cs ? "Další rozhodnutí najdeš ve Flappy AI." : "See the remaining decisions in Flappy AI."}</p>}</section> : <p>{cs ? "Načítám rozhodnutí a replay…" : "Loading decisions and replay…"}</p>}
    <Link href={`/ai-lab/flappy?replay=${encodeURIComponent(episode.id)}`} className="link">{cs ? "Otevřít replay ve Flappy AI" : "Open replay in Flappy AI"}</Link>
  </div></details>;
}
