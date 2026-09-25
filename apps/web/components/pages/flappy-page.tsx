"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useApp } from "@/components/app-provider";
import { HelpLabel, InfoTip, RunStatus } from "@/components/ui";
import styles from "./flappy-page.module.css";

type Action = "FLAP" | "WAIT";
type GameStatus = "queued" | "running" | "completed" | "failed";
type GameEpisode = {
  id: string; agent: string; model_key: string | null; status: GameStatus;
  seed: number; score: number; frames: number; decision_count: number; invalid_decisions?: number;
  input_tokens: number; output_tokens: number; cost_usd: number | null;
  decision_latency_ms: number; death_reason: string | null; error: string | null;
};
type GameObservation = {
  frame: number; score: number; alive: boolean; floor_y: number; width: number; height: number;
  bird: { x: number; y: number; vy: number; radius: number };
  pipes: { id: number; x: number; width: number; gap_top: number; gap_bottom: number }[];
};
type Model = { key: string; id: string; provider: string; mode: string; available: boolean; capabilities: { generation: boolean; vision?: boolean } };
type LeaderRow = { key: string; agent: string; model_key: string | null; runs: number; best: number; average: number; input_tokens: number; output_tokens: number; cost_usd: number | null };
type Replay = { steps: { observation: GameObservation; action: Action; result: { observation: GameObservation } }[]; final_state: Record<string, unknown> };
type ShowcaseStep = { frame: number; y: number; score: number; alive: boolean; pipe_x: number | null; gap_top: number | null; gap_bottom: number | null };
type Showcase = { attempts: { seed: number; score: number; steps: ShowcaseStep[] }[]; winner_index: number; best_score: number; target_score: number; target_met: boolean; replay: Replay; checkpoint_episodes: number };
type TrainingRun = {
  id: string; status: GameStatus; seed: number; episodes_requested: number; episodes_completed: number; error: string | null;
  result?: {
    training?: { episodes: { score: number; frames: number }[]; total_steps: number; updates: number; epsilon: number; mean_loss: number | null };
    evaluation_before?: { mean_score: number };
    evaluation?: { mean_score: number; episodes: { score: number }[] };
  };
};

function BirdPreview({ attempt, index, stepIndex, winner, cs }: { attempt: Showcase["attempts"][number]; index: number; stepIndex: number; winner: boolean; cs: boolean }) {
  const step = attempt.steps[Math.min(stepIndex, attempt.steps.length - 1)];
  const pipeX = step?.pipe_x == null ? 160 : step.pipe_x / 3;
  const gapTop = step?.gap_top == null ? 35 : step.gap_top / 5.68;
  const gapBottom = step?.gap_bottom == null ? 65 : step.gap_bottom / 5.68;
  return <div className={`${styles.birdCard} ${winner ? styles.birdWinner : ""}`}>
    <div className={styles.birdCardHead}><strong>#{index + 1}</strong><span>{cs ? "skóre" : "score"} {step?.score ?? 0}</span></div>
    <svg viewBox="0 0 160 100" role="img" aria-label={`${cs ? "Pták" : "Bird"} ${index + 1}, ${cs ? "skóre" : "score"} ${step?.score ?? 0}`}>
      <rect width="160" height="100" fill="var(--blue-soft)" />
      <rect x={pipeX} width="21" height={Math.max(0, gapTop)} fill="var(--blue)" />
      <rect x={pipeX} y={gapBottom} width="21" height={Math.max(0, 100 - gapBottom)} fill="var(--blue)" />
      <circle cx="39" cy={Math.max(4, Math.min(96, (step?.y ?? 256) / 5.68))} r="5" fill={step?.alive === false ? "var(--ink-faint)" : "#e99b43"} />
    </svg>
    <small>{winner ? cs ? "Nejlepší pokus" : "Best attempt" : step?.alive === false ? cs ? "Konec hry" : "Game over" : `seed ${attempt.seed}`}</small>
  </div>;
}

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`/api/v1/game${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    const detail = body?.detail;
    throw new Error(typeof detail === "string" ? detail : `HTTP ${response.status}`);
  }
  return body as T;
}

function GameBoard({ observation }: { observation: GameObservation | null }) {
  const view = observation;
  return <div className={styles.boardShell}>
    <svg className={styles.board} viewBox="0 0 480 640" role="img" aria-label="Flappy AI game board">
      <defs>
        <pattern id="flappy-grid" width="32" height="32" patternUnits="userSpaceOnUse"><path d="M 32 0 L 0 0 0 32" fill="none" stroke="#c9d7ef" strokeWidth="1" /></pattern>
        <clipPath id="game-clip"><rect width="480" height="640" /></clipPath>
      </defs>
      <rect width="480" height="640" fill="#e8eeff" />
      <rect width="480" height="640" fill="url(#flappy-grid)" opacity=".45" />
      <g clipPath="url(#game-clip)">{view?.pipes.map((pipe) => <g key={pipe.id}>
        <rect x={pipe.x} y={0} width={pipe.width} height={pipe.gap_top} fill="#275efe" />
        <rect x={pipe.x - 5} y={pipe.gap_top - 16} width={pipe.width + 10} height={16} fill="#1946cb" />
        <rect x={pipe.x} y={pipe.gap_bottom} width={pipe.width} height={view.floor_y - pipe.gap_bottom} fill="#275efe" />
        <rect x={pipe.x - 5} y={pipe.gap_bottom} width={pipe.width + 10} height={16} fill="#1946cb" />
      </g>)}</g>
      <rect x="0" y={view?.floor_y ?? 568} width="480" height="72" fill="#18222d" />
      <line x1="0" x2="480" y1={view?.floor_y ?? 568} y2={view?.floor_y ?? 568} stroke="#275efe" strokeWidth="6" />
      {view ? <g>
        <circle cx={view.bird.x} cy={view.bird.y} r={view.bird.radius + 4} fill="#fbfaf6" />
        <circle cx={view.bird.x} cy={view.bird.y} r={view.bird.radius} fill="#f0ad65" />
        <circle cx={view.bird.x + 5} cy={view.bird.y - 5} r="2.8" fill="#171a1d" />
        <path d={`M ${view.bird.x + 13} ${view.bird.y} l 13 5 -13 4 Z`} fill="#b75c12" />
      </g> : <g><circle cx="120" cy="256" r="20" fill="#f0ad65" /><text x="240" y="315" fill="#18222d" textAnchor="middle" fontSize="17" fontFamily="IBM Plex Sans">Flappy AI</text></g>}
      <text x="20" y="42" fill="#18222d" fontSize="28" fontWeight="700" fontFamily="IBM Plex Mono">{view?.score ?? 0}</text>
      {view && !view.alive && <g><rect x="68" y="252" width="344" height="114" fill="#18222d" /><text x="240" y="300" textAnchor="middle" fill="#fff" fontSize="26" fontWeight="700" fontFamily="IBM Plex Sans">Konec hry</text><text x="240" y="336" textAnchor="middle" fill="#a8beff" fontSize="16" fontFamily="IBM Plex Mono">Skóre {view.score}</text></g>}
    </svg>
    <div className={styles.boardCaption}><span>Seed {view ? "aktivní" : "—"}</span><span>{view ? `Snímek ${view.frame}` : "Připravte první hru"}</span></div>
  </div>;
}

export function FlappyPage({ initialReplayId = null }: { initialReplayId?: string | null }) {
  const { locale } = useApp();
  const cs = locale === "cs";
  const [models, setModels] = useState<Model[]>([]);
  const [modelSearch, setModelSearch] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [seed, setSeed] = useState(42);
  const [episodes, setEpisodes] = useState<GameEpisode[]>([]);
  const [leaders, setLeaders] = useState<LeaderRow[]>([]);
  const [observation, setObservation] = useState<GameObservation | null>(null);
  const [humanId, setHumanId] = useState<string | null>(null);
  const [live, setLive] = useState(false);
  const [trainingId, setTrainingId] = useState<string | null>(null);
  const [trainingStatus, setTrainingStatus] = useState("");
  const [training, setTraining] = useState<TrainingRun | null>(null);
  const [trainEpisodes, setTrainEpisodes] = useState(1000);
  const [checkpointReady, setCheckpointReady] = useState(false);
  const [checkpointEpisodes, setCheckpointEpisodes] = useState(0);
  const [replay, setReplay] = useState<Replay | null>(null);
  const [replayIndex, setReplayIndex] = useState(0);
  const [playingReplay, setPlayingReplay] = useState(false);
  const [showcase, setShowcase] = useState<Showcase | null>(null);
  const [showcaseLoading, setShowcaseLoading] = useState(false);
  const [autoReplayId, setAutoReplayId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const flapPending = useRef(false);
  const requestPending = useRef(false);
  const observationRef = useRef<GameObservation | null>(null);
  const showcaseRequest = useRef(0);

  const loadShowcase = useCallback(async (courseSeed: number) => {
    const request = ++showcaseRequest.current;
    setShowcaseLoading(true);
    try {
      const result = await api<Showcase>(`/showcase?seed=${courseSeed}`);
      if (request !== showcaseRequest.current) return;
      setShowcase(result);
      setReplay(result.replay);
      setReplayIndex(0);
      setPlayingReplay(true);
      setError("");
    } catch (cause) {
      if (request === showcaseRequest.current) setError((cause as Error).message);
    } finally {
      if (request === showcaseRequest.current) setShowcaseLoading(false);
    }
  }, []);

  const clearShowcase = () => {
    showcaseRequest.current += 1;
    setShowcase(null);
    setShowcaseLoading(false);
  };

  const refresh = useCallback(async () => {
    try {
      const [history, board] = await Promise.all([
        api<{ episodes: GameEpisode[] }>("/episodes"),
        api<{ rows: LeaderRow[] }>(`/leaderboard?seed=${seed}`),
      ]);
      setEpisodes(history.episodes);
      setLeaders(board.rows);
    } catch (cause) { setError((cause as Error).message); }
  }, [seed]);

  useEffect(() => {
    void Promise.resolve().then(refresh);
    fetch("/api/v1/models").then((response) => response.json()).then((body) => {
      const available = Array.isArray(body.models) ? body.models as Model[] : [];
      setModels(available.filter((model) => model.capabilities?.generation && model.available));
    }).catch(() => setModels([]));
    void api<{ ready: boolean; episodes?: number }>("/checkpoint").then((body) => { setCheckpointReady(body.ready); setCheckpointEpisodes(body.episodes ?? 0); }).catch(() => {});
  }, [refresh]);

  useEffect(() => {
    void api<TrainingRun | null>("/train/latest").then((item) => {
      if (!item) return;
      setTraining(item);
      setTrainingStatus(item.error || item.status);
      if (item.status === "queued" || item.status === "running") setTrainingId(item.id);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (checkpointReady && !initialReplayId) queueMicrotask(() => void loadShowcase(seed));
  }, [checkpointReady, seed, loadShowcase, initialReplayId]);

  useEffect(() => {
    if (!initialReplayId) return;
    void Promise.all([
      api<{ seed: number }>(`/episodes/${encodeURIComponent(initialReplayId)}`),
      api<{ verified: boolean; replay: Replay }>(`/episodes/${encodeURIComponent(initialReplayId)}/replay`),
    ]).then(([episode, result]) => {
      setSeed(episode.seed);
      setReplay(result.replay);
      setReplayIndex(0);
    }).catch((cause) => setError((cause as Error).message));
  }, [initialReplayId]);

  useEffect(() => {
    if (!episodes.some((episode) => episode.status === "running" || episode.status === "queued") && !trainingId) return;
    const timer = window.setInterval(() => {
      void refresh();
      if (trainingId) void api<TrainingRun>(`/train/${trainingId}`).then((item) => {
        setTraining(item);
        setTrainingStatus(item.error || item.status);
        if (item.status === "completed") {
          setTrainingId(null);
          void api<{ ready: boolean; episodes?: number }>("/checkpoint").then((checkpoint) => {
            setCheckpointReady(checkpoint.ready);
            setCheckpointEpisodes(checkpoint.episodes ?? 0);
            if (checkpoint.ready && checkpointReady) void loadShowcase(seed);
          }).catch(() => {});
        } else if (item.status === "failed") setTrainingId(null);
      }).catch((cause) => setError((cause as Error).message));
    }, 1300);
    return () => window.clearInterval(timer);
  }, [episodes, trainingId, refresh, loadShowcase, seed, checkpointReady]);

  useEffect(() => {
    if (!autoReplayId) return;
    const episode = episodes.find((item) => item.id === autoReplayId);
    if (!episode || episode.status === "queued" || episode.status === "running") return;
    queueMicrotask(() => setAutoReplayId(null));
    if (episode.status !== "completed") return;
    void api<{ verified: boolean; replay: Replay }>(`/episodes/${episode.id}/replay`)
      .then((result) => { setReplay(result.replay); setReplayIndex(0); setPlayingReplay(true); })
      .catch((cause) => setError((cause as Error).message));
  }, [episodes, autoReplayId]);

  useEffect(() => { observationRef.current = observation; }, [observation]);

  useEffect(() => {
    if (!live || !humanId) return;
    const timer = window.setInterval(async () => {
      const current = observationRef.current;
      if (!current || requestPending.current) return;
      requestPending.current = true;
      const action: Action = flapPending.current ? "FLAP" : "WAIT";
      flapPending.current = false;
      try {
        const result = await api<GameEpisode & { observation: GameObservation }>(`/human/${humanId}/step`, {
          method: "POST", body: JSON.stringify({ action, frames: 12, expected_frame: current.frame }),
        });
        setObservation(result.observation);
        if (result.status === "completed") { setLive(false); void refresh(); }
      } catch (cause) { setLive(false); setError((cause as Error).message); }
      finally { requestPending.current = false; }
    }, 245);
    return () => window.clearInterval(timer);
  }, [live, humanId, refresh]);

  useEffect(() => {
    if (!live) return;
    const handleKey = (event: KeyboardEvent) => {
      if (event.code === "Space" && !(event.target instanceof HTMLInputElement)) {
        event.preventDefault(); flapPending.current = true;
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [live]);

  useEffect(() => {
    if (!playingReplay || !replay) return;
    const timer = window.setInterval(() => setReplayIndex((index) => {
      if (index >= replay.steps.length - 1) { setPlayingReplay(false); return index; }
      return index + 1;
    }), 140);
    return () => window.clearInterval(timer);
  }, [playingReplay, replay]);

  const displayObservation = replay
    ? replay.steps[replayIndex]?.result.observation ?? replay.steps[0]?.observation ?? observation
    : observation;
  const matchingModels = useMemo(() => models.filter((model) => `${model.provider} ${model.id}`.toLowerCase().includes(modelSearch.toLowerCase())), [models, modelSearch]);
  const activeCount = episodes.filter((episode) => episode.status === "queued" || episode.status === "running").length;
  const knownCosts = episodes.filter((episode) => episode.cost_usd != null).reduce((total, episode) => total + (episode.cost_usd ?? 0), 0);
  const unknownCosts = episodes.filter((episode) => episode.agent === "llm" && episode.status === "completed" && episode.cost_usd == null).length;

  const startHuman = async () => {
    setError(""); setBusy(true); setReplay(null); clearShowcase();
    try {
      const result = await api<GameEpisode & { observation: GameObservation }>("/human", {
        method: "POST", body: JSON.stringify({ seed }),
      });
      setHumanId(result.id); setObservation(result.observation); setLive(true);
    } catch (cause) { setError((cause as Error).message); }
    finally { setBusy(false); }
  };
  const finishHuman = async () => {
    setLive(false);
    if (humanId) {
      try { await api(`/human/${humanId}/finish`, { method: "POST" }); await refresh(); }
      catch (cause) { setError((cause as Error).message); }
    }
  };
  const startAgent = async (agent: "random" | "rule" | "dqn") => {
    setError(""); setBusy(true); setReplay(null); setPlayingReplay(false); clearShowcase();
    try {
      const created = await api<{ id: string }>("/episodes", { method: "POST", body: JSON.stringify({ agent, seed, max_decisions: 200 }) });
      setAutoReplayId(created.id);
      await refresh();
    } catch (cause) { setError((cause as Error).message); }
    finally { setBusy(false); }
  };
  const startTournament = async () => {
    setError(""); setBusy(true);
    try {
      await api("/tournament", { method: "POST", body: JSON.stringify({ model_keys: selected, seeds: [seed], include_baselines: true, max_decisions: 50 }) });
      await refresh();
    } catch (cause) { setError((cause as Error).message); }
    finally { setBusy(false); }
  };
  const trainDqn = async () => {
    setError(""); setBusy(true);
    try {
      const result = await api<{ id: string; status: GameStatus }>("/train", { method: "POST", body: JSON.stringify({ seed, episodes: trainEpisodes, max_decisions: 200 }) });
      setTrainingId(result.id); setTrainingStatus(result.status);
      setTraining({ ...result, seed, episodes_requested: trainEpisodes, episodes_completed: 0, error: null });
    } catch (cause) { setError((cause as Error).message); }
    finally { setBusy(false); }
  };
  const loadReplay = async (episode: GameEpisode) => {
    setError(""); setLive(false); setPlayingReplay(false); clearShowcase();
    try {
      const result = await api<{ verified: boolean; replay: Replay }>(`/episodes/${episode.id}/replay`);
      setReplay(result.replay); setReplayIndex(0);
    } catch (cause) { setError((cause as Error).message); }
  };
  const toggleModel = (key: string) => setSelected((items) => items.includes(key) ? items.filter((item) => item !== key) : [...items, key].slice(0, 8));

  return <div className={styles.page}>
    <header className={styles.header}><div><h1>Flappy AI</h1><p>{cs ? "Otestujte člověka, pravidla i skutečné modely na stejné trati. Každé rozhodnutí lze přehrát." : "Test a human, rules and real models on the same course. Every decision can be replayed."}</p></div><div className={styles.headerStats}><strong>{leaders[0]?.best ?? "—"}</strong><div className={styles.statLabel}><span>{cs ? "nejvyšší skóre při tomto seedu" : "highest score on this seed"}</span><InfoTip label={cs ? "Jak se počítá skóre" : "How scoring works"} helpKey="flappy.score" context="metric" /></div></div></header>
    {error && <div className={styles.error} role="alert">{error}</div>}
    <div className={styles.layout}>
      <section className={styles.playArea} aria-label={cs ? "Herní plocha" : "Game area"}>
        <GameBoard observation={displayObservation} />
        <div className={styles.liveControls}>
          <div><strong>{showcase ? cs ? "Nejlepší z 20 pokusů DQN" : "Best of 20 DQN attempts" : replay ? cs ? "Ověřený replay" : "Verified replay" : live ? cs ? "Hrajete vy" : "You are playing" : cs ? "Připraveno" : "Ready"}</strong><span>{replay ? `${replayIndex + 1} / ${replay.steps.length}` : live ? cs ? "Mezerník nebo tlačítko Máchnout" : "Space or Flap button" : cs ? "Zvolte typ hráče" : "Choose a player"}</span></div>
          {live && <button className={styles.flapButton} onPointerDown={() => { flapPending.current = true; }}>↑ {cs ? "Máchnout" : "Flap"}</button>}
        </div>
        {replay && <div className={styles.replayControl}><button onClick={() => setPlayingReplay((value) => !value)}>{playingReplay ? cs ? "Pozastavit" : "Pause" : cs ? "Přehrát" : "Play"}</button><input aria-label={cs ? "Snímek replaye" : "Replay step"} type="range" min="0" max={Math.max(0, replay.steps.length - 1)} value={replayIndex} onChange={(event) => setReplayIndex(Number(event.target.value))} /><span>{replay.steps[replayIndex]?.action ?? "—"}</span></div>}
      </section>
      <div className={styles.controls}>
        <section className={styles.controlSection}><h2>{cs ? "Spusťte hru" : "Start a game"}</h2><p>{cs ? "Seed určuje rozložení překážek. Stejné číslo znamená stejnou trať." : "The seed fixes the obstacle layout. The same number means the same course."}</p><label className={styles.seedLabel}><HelpLabel label={cs ? "Seed tratě" : "Course seed"} helpKey="flappy.seed" /><input type="number" min="0" max="2147483647" value={seed} onChange={(event) => setSeed(Math.max(0, Math.min(2147483647, Number(event.target.value) || 0)))} /></label><div className={styles.buttonGrid}><button className={styles.primaryButton} disabled={busy || live} onClick={startHuman}>{cs ? "Hrát sám" : "Play yourself"}</button><button disabled={busy} onClick={() => void startAgent("random")}>{cs ? "Náhodný agent" : "Random agent"}</button><button disabled={busy} onClick={() => void startAgent("rule")}>{cs ? "Pravidlový agent" : "Rule agent"}</button><button disabled={busy || !checkpointReady} onClick={() => void startAgent("dqn")}>DQN {checkpointReady ? "" : cs ? "· nejdřív trénovat" : "· train first"}</button></div>{live && <button className={styles.textButton} onClick={finishHuman}>{cs ? "Ukončit a uložit hru" : "Finish and save game"}</button>}</section>
        <section className={styles.controlSection}><h2 className={styles.helpHeading}>{cs ? "Modelový turnaj" : "Model tournament"}<InfoTip label={cs ? "Učí se jazykový model?" : "Does the language model learn?"} helpKey="flappy.llmLearning" context="section" /></h2><p>{cs ? "Vyberte modely. Každý dostane stejný seed a nejvýš 50 rozhodnutí. Volání cloudových modelů může být placené." : "Select models. Each gets the same seed and at most 50 decisions. Cloud calls may incur charges."}</p><div className={styles.searchHelp}><HelpLabel label={cs ? "Hledat model" : "Search models"} helpKey="field.modelSelection" /></div><input className={styles.search} value={modelSearch} onChange={(event) => setModelSearch(event.target.value)} placeholder={cs ? "Hledat model…" : "Search models…"} aria-label={cs ? "Hledat model" : "Search model"} /><div className={styles.modelList}>{matchingModels.length ? matchingModels.map((model) => <label key={model.key}><input type="checkbox" checked={selected.includes(model.key)} onChange={() => toggleModel(model.key)} /><span><strong>{model.id}</strong><small>{model.provider} · {model.mode}</small></span></label>) : <p>{cs ? "Žádný dostupný generativní model. Spusťte Ollamu nebo nastavte API klíč." : "No generation model available. Start Ollama or configure an API key."}</p>}</div><button className={styles.primaryButton} disabled={busy || activeCount > 0} onClick={startTournament}>{cs ? `Spustit turnaj (${selected.length} modelů + 2 základní)` : `Run tournament (${selected.length} models + 2 baselines)`}</button>{activeCount > 0 && <p className={styles.running}>{cs ? `Běží ${activeCount} epizod…` : `${activeCount} episodes running…`}</p>}</section>
        <section className={styles.controlSection}>
          <h2 className={styles.helpHeading}>{cs ? "Naučit DQN" : "Train DQN"}<InfoTip label={cs ? "Co dělá DQN" : "What DQN does"} helpKey="flappy.dqn" context="section" /></h2>
          <p>{cs ? "DQN se učí z vlastních her. Po tréninku přehrajeme 20 nových tratí; cíl je alespoň 20 trubek. Výsledek závisí na naučené síti." : "DQN learns from its own games. After training, we replay 20 new courses; the target is at least 20 pipes. The result depends on the trained network."}</p>
          <label className={styles.seedLabel}><HelpLabel label={cs ? "Počet epizod" : "Episodes"} helpKey="flappy.episodes" /><input type="number" min="100" max="2000" step="100" value={trainEpisodes} onChange={(event) => setTrainEpisodes(Math.max(100, Math.min(2000, Number(event.target.value) || 100)))} /></label>
          <button disabled={busy || !!trainingId} onClick={trainDqn}>{cs ? `Trénovat ${trainEpisodes} epizod` : `Train ${trainEpisodes} episodes`}</button>
          {checkpointReady && <button className={styles.showcaseButton} disabled={showcaseLoading || busy} onClick={() => void loadShowcase(seed)}>{showcaseLoading ? cs ? "Připravuji přehrávání…" : "Preparing replay…" : cs ? "Přehrát 20 pokusů" : "Replay 20 attempts"}</button>}
          {checkpointReady && <p className={styles.checkpointNote}>{cs ? `Uložený model: ${checkpointEpisodes} epizod. Můžete trénovat dál nebo spustit DQN.` : `Saved model: ${checkpointEpisodes} episodes. Continue training or run DQN.`}</p>}
          {training && <div className={styles.trainingProgress} role="status"><span>{training.error || (cs ? `${training.episodes_completed} / ${training.episodes_requested} epizod` : `${training.episodes_completed} / ${training.episodes_requested} episodes`)}</span><progress max={training.episodes_requested} value={training.episodes_completed} /></div>}
          {!training && trainingStatus && <span className={styles.running}>{trainingStatus}</span>}
        </section>
      </div>
    </div>
    {showcase && <section className={styles.showcase} aria-label={cs ? "Dvacet pokusů DQN" : "Twenty DQN attempts"}>
      <div className={styles.showcaseHeading}><div><h2>{cs ? "20 ptáků, 20 nových tratí" : "20 birds, 20 new courses"}</h2><p>{cs ? `Všichni používají stejný uložený DQN po ${showcase.checkpoint_episodes} epizodách. Každá dlaždice přehrává skutečný pokus na vlastní trati.` : `All use the same saved DQN after ${showcase.checkpoint_episodes} episodes. Each tile replays a real attempt on its own course.`}</p></div><strong className={showcase.target_met ? styles.targetMet : styles.targetMissed}>{showcase.best_score} / {showcase.target_score}</strong></div>
      <p className={styles.showcaseResult}>{showcase.target_met ? cs ? `Cíl splněn: pták #${showcase.winner_index + 1} proletěl alespoň 20 trubek.` : `Target reached: bird #${showcase.winner_index + 1} passed at least 20 pipes.` : cs ? `Zatím nejlepší skóre ${showcase.best_score}. Pokračujte v tréninku a pokusy spusťte znovu.` : `Best score so far is ${showcase.best_score}. Continue training and replay the attempts.`}</p>
      <div className={styles.birdGrid}>{showcase.attempts.map((attempt, index) => <BirdPreview key={attempt.seed} attempt={attempt} index={index} stepIndex={replayIndex} winner={index === showcase.winner_index} cs={cs} />)}</div>
    </section>}
    <section className={styles.results}><div className={styles.sectionHeading}><div><h2>{cs ? "Žebříček" : "Leaderboard"}</h2><p>{cs ? `Stejná trať: seed ${seed}. Průměr vzniká z dokončených epizod každého hráče.` : `Same course: seed ${seed}. Average uses completed episodes for each player.`}</p></div><button onClick={() => void refresh()}>{cs ? "Obnovit" : "Refresh"}</button></div>{leaders.length ? <div className={styles.tableScroll}><table><thead><tr><th>{cs ? "Hráč" : "Player"}</th><th>{cs ? "Nejlepší" : "Best"}</th><th>{cs ? "Průměr" : "Average"}</th><th>{cs ? "Běhy" : "Runs"}</th></tr></thead><tbody>{leaders.map((row, index) => <tr key={row.key}><td><span className={styles.rank}>{index + 1}</span>{row.model_key || row.agent}</td><td>{row.best}</td><td>{row.average.toFixed(1)}</td><td>{row.runs}</td></tr>)}</tbody></table></div> : <p className={styles.empty}>{cs ? "Zatím žádné skóre pro tento seed. Spusťte první hru nebo turnaj." : "No scores for this seed yet. Start a game or tournament."}</p>}</section>
    {leaders.length > 0 && <section className={styles.results}><div className={styles.sectionHeading}><div><h2>{cs ? "Srovnání průměrného skóre" : "Average score comparison"}</h2><p>{cs ? "Každý pruh ukazuje průměr dokončených her na vybrané trati." : "Each bar shows the average completed game score on the selected course."}</p></div></div><div className={styles.scoreBars}>{leaders.map((row) => <div className={styles.scoreBar} key={row.key}><span title={row.model_key || row.agent}>{row.model_key || row.agent}</span><div><i style={{ width: `${Math.max(2, row.average / Math.max(1, ...leaders.map((item) => item.average)) * 100)}%` }} /></div><strong>{row.average.toFixed(1)}</strong></div>)}</div></section>}
    <section className={styles.results}><div className={styles.sectionHeading}><div><h2>{cs ? "Poslední epizody" : "Recent episodes"}</h2><p>{cs ? "Otevřete replay a sledujte uložené akce po krocích." : "Open a replay to inspect the saved actions step by step."}</p></div></div>{episodes.length ? <div className={styles.history}>{episodes.slice(0, 20).map((episode) => <button key={episode.id} disabled={episode.status !== "completed"} onClick={() => void loadReplay(episode)}><span><strong>{episode.model_key || episode.agent}</strong><small>seed {episode.seed} · {episode.decision_count} {cs ? "rozhodnutí" : "decisions"}</small>{(episode.invalid_decisions ?? 0) > 0 && <small className={styles.invalid}>{episode.invalid_decisions} {cs ? "neplatné odpovědi modelu" : "invalid model replies"}</small>}</span><span><RunStatus status={episode.status} />{episode.status === "completed" ? `${cs ? "Skóre" : "Score"} ${episode.score}` : episode.error || ""}</span><span>{episode.status === "completed" ? cs ? "Přehrát" : "Replay" : "—"}</span></button>)}</div> : <p className={styles.empty}>{cs ? "Historie je prázdná. První hra se tu uloží automaticky." : "History is empty. Your first game will be saved here automatically."}</p>}</section>
    <section className={styles.results}><div className={styles.sectionHeading}><div><h2>{cs ? "Cena provozu" : "Operating cost"}</h2><p>{cs ? "API náklady dokončených her v načtené historii. Místní hra a DQN nevolají placený model." : "API costs for completed games in the loaded history. Local play and DQN make no paid model calls."}</p></div></div><div className={styles.costSummary}><strong>${knownCosts.toFixed(4)}</strong><span>{cs ? `${episodes.length} načtených epizod · ${episodes.reduce((total, item) => total + item.input_tokens + item.output_tokens, 0)} tokenů` : `${episodes.length} loaded episodes · ${episodes.reduce((total, item) => total + item.input_tokens + item.output_tokens, 0)} tokens`}</span></div>{unknownCosts > 0 && <p className={styles.costNote}>{cs ? `U ${unknownCosts} epizod poskytovatel nevrátil cenu; celkový součet je neúplný.` : `${unknownCosts} episodes have unknown provider cost; the total is incomplete.`}</p>}</section>
  </div>;
}
