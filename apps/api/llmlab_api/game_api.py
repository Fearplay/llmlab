"""Flappy AI: persistent, seedable games and inspectable agent decisions."""

import asyncio
import json
import re
import uuid
from collections import defaultdict
from pathlib import Path
from typing import Any, Literal

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select, update
from sqlalchemy.orm import Session

from .contracts import ExecutionMode, GenerationRequest
from .database import SessionLocal, get_db
from .game_engine import DQNTrainer, FlappyEngine, RandomAgent, rule_agent, run_episode
from .game_models import GameEpisode, GameTraining
from .pricing import estimate_cost
from .providers import generate
from .settings import Settings, get_settings

router = APIRouter(prefix="/api/v1/game", tags=["game"])
_training_lock = asyncio.Lock()
_model_key_pattern = re.compile(
    r"^(ollama|openai|anthropic|gemini|openai_compatible):([A-Za-z0-9][A-Za-z0-9._:/-]{0,159})$"
)


def reconcile_interrupted_games() -> None:
    """Mark jobs left behind by a stopped process; never repeat paid model calls."""
    with SessionLocal() as db:
        db.execute(
            update(GameEpisode)
            .where(GameEpisode.status.in_(["queued", "running"]))
            .where(GameEpisode.agent != "human")
            .values(
                status="failed", error="Běh byl přerušen restartem aplikace. Spusťte nový pokus."
            )
        )
        db.execute(
            update(GameTraining)
            .where(GameTraining.status.in_(["queued", "running"]))
            .values(status="failed", error="Trénink byl přerušen restartem aplikace.")
        )
        db.commit()


class EpisodeCreate(BaseModel):
    agent: Literal["random", "rule", "llm", "dqn"] = "rule"
    model_key: str | None = None
    seed: int = Field(42, ge=0, le=2_147_483_647)
    frames_per_decision: int = Field(12, ge=1, le=30)
    max_decisions: int = Field(80, ge=1, le=300)


class HumanStart(BaseModel):
    seed: int = Field(42, ge=0, le=2_147_483_647)


class HumanStep(BaseModel):
    action: Literal["FLAP", "WAIT"]
    expected_frame: int = Field(ge=0)
    frames: int = Field(12, ge=1, le=30)


class TournamentCreate(BaseModel):
    model_keys: list[str] = Field(default_factory=list, max_length=8)
    seeds: list[int] = Field(default_factory=lambda: [42], min_length=1, max_length=3)
    include_baselines: bool = True
    max_decisions: int = Field(50, ge=1, le=100)


class TrainCreate(BaseModel):
    seed: int = Field(42, ge=0, le=2_147_483_647)
    episodes: int = Field(50, ge=2, le=500)
    max_decisions: int = Field(100, ge=10, le=300)


def _model_parts(model_key: str | None) -> tuple[str, str, ExecutionMode]:
    match = _model_key_pattern.fullmatch(model_key or "")
    if not match:
        raise HTTPException(422, "Vyberte dostupný generativní model ve tvaru poskytovatel:model.")
    provider, model = match.groups()
    mode = ExecutionMode.LOCAL if provider == "ollama" else ExecutionMode.CLOUD
    return provider, model, mode


def _checkpoint_path(settings: Settings) -> Path:
    if settings.database_url.startswith("sqlite:///"):
        root = Path(settings.database_url.removeprefix("sqlite:///")).parent
    else:
        root = Path(".local-data")
    if root == Path("."):
        root = Path(".local-data")
    return root / "dqn-checkpoint.npz"


def _view(row: GameEpisode, *, detail: bool = False) -> dict[str, Any]:
    result = {
        "id": row.id,
        "agent": row.agent,
        "model_key": row.model_key,
        "mode": row.mode,
        "seed": row.seed,
        "status": row.status,
        "score": row.score,
        "frames": row.frames,
        "decision_count": row.decision_count,
        "input_tokens": row.input_tokens,
        "output_tokens": row.output_tokens,
        "cached_tokens": row.cached_tokens,
        "decision_latency_ms": row.decision_latency_ms,
        "cost_usd": row.cost_usd,
        "death_reason": row.death_reason,
        "error": row.error,
        "spec": row.spec,
        "created_at": row.created_at,
    }
    if detail:
        result["replay"] = row.replay
    return result


def _get_episode(db: Session, episode_id: str) -> GameEpisode:
    row = db.get(GameEpisode, episode_id)
    if row is None:
        raise HTTPException(404, "Herní epizoda nebyla nalezena.")
    return row


def _create_episode(db: Session, spec: EpisodeCreate, *, agent: str | None = None) -> GameEpisode:
    selected_agent = agent or spec.agent
    if selected_agent == "llm":
        _model_parts(spec.model_key)
    if selected_agent == "dqn" and spec.model_key:
        raise HTTPException(422, "DQN používá vlastní checkpoint, ne externí model.")
    row = GameEpisode(
        id=f"game_{uuid.uuid4().hex[:12]}",
        agent=selected_agent,
        model_key=spec.model_key if selected_agent == "llm" else None,
        mode="local" if selected_agent != "llm" else _model_parts(spec.model_key)[2].value,
        seed=spec.seed,
        status="queued",
        spec=spec.model_dump(),
        replay={},
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


@router.get("/episodes")
def list_episodes(limit: int = 100, db: Session = Depends(get_db)) -> dict[str, Any]:
    limit = max(1, min(limit, 500))
    rows = db.scalars(select(GameEpisode).order_by(GameEpisode.created_at.desc()).limit(limit))
    return {"episodes": [_view(row) for row in rows]}


@router.post("/episodes", status_code=202)
def create_episode(
    request: EpisodeCreate,
    tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    settings: Settings = Depends(get_settings),
) -> dict[str, Any]:
    if request.agent == "llm" and request.max_decisions > 50:
        raise HTTPException(422, "LLM hra má limit 50 rozhodnutí kvůli době běhu a ceně.")
    if request.agent == "dqn" and not _checkpoint_path(settings).exists():
        raise HTTPException(409, "Nejprve natrénujte DQN a uložte checkpoint.")
    row = _create_episode(db, request)
    tasks.add_task(_run_episode_task, row.id, settings)
    return _view(row)


@router.post("/tournament", status_code=202)
def create_tournament(
    request: TournamentCreate,
    tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    settings: Settings = Depends(get_settings),
) -> dict[str, Any]:
    if not request.model_keys and not request.include_baselines:
        raise HTTPException(422, "Vyberte alespoň jeden model nebo programového agenta.")
    for key in request.model_keys:
        _model_parts(key)
    if len(set(request.model_keys)) != len(request.model_keys) or len(set(request.seeds)) != len(
        request.seeds
    ):
        raise HTTPException(422, "Modely a seedy se v turnaji nesmí opakovat.")
    if any(seed < 0 or seed > 2_147_483_647 for seed in request.seeds):
        raise HTTPException(422, "Seed musí být mezi 0 a 2147483647.")
    episodes = []
    for seed in request.seeds:
        agents = (["random", "rule"] if request.include_baselines else []) + ["llm"] * len(
            request.model_keys
        )
        for index, agent in enumerate(agents):
            key = (
                request.model_keys[index - (2 if request.include_baselines else 0)]
                if agent == "llm"
                else None
            )
            row = _create_episode(
                db,
                EpisodeCreate(
                    agent=agent, model_key=key, seed=seed, max_decisions=request.max_decisions
                ),
            )
            episodes.append(row.id)
    tasks.add_task(_run_tournament_task, episodes, settings)
    return {"episode_ids": episodes, "seeds": request.seeds, "status": "queued"}


async def _run_tournament_task(episode_ids: list[str], settings: Settings) -> None:
    for episode_id in episode_ids:
        await _run_episode_task(episode_id, settings)


async def _run_episode_task(episode_id: str, settings: Settings) -> None:
    with SessionLocal() as db:
        row = _get_episode(db, episode_id)
        row.status = "running"
        db.commit()
        spec = EpisodeCreate.model_validate(row.spec)
        agent = row.agent
        model_key = row.model_key
    try:
        if agent == "random":
            callback = RandomAgent(spec.seed)
        elif agent == "rule":
            callback = rule_agent
        elif agent == "dqn":
            callback = DQNTrainer.load_checkpoint(_checkpoint_path(settings))
        else:
            provider, model, mode = _model_parts(model_key)

            async def callback(observation: dict[str, Any]) -> dict[str, Any]:
                bird = observation["bird"]
                pipe = observation["next_pipe"]
                state = {
                    "bird_y": round(bird["y"], 1),
                    "vertical_speed": round(bird["vy"], 2),
                    "pipe_distance": round(observation["distance_to_next_pipe"], 1),
                    "gap_top": round(pipe["gap_top"], 1) if pipe else None,
                    "gap_bottom": round(pipe["gap_bottom"], 1) if pipe else None,
                    "floor_y": observation["floor_y"],
                }
                result = await generate(
                    GenerationRequest(
                        mode=mode,
                        provider=provider,
                        model=model,
                        messages=[
                            {
                                "role": "system",
                                "content": (
                                    'You control Flappy Bird. Return only JSON: {"action":"FLAP"} '
                                    'or {"action":"WAIT"}. FLAP adds upward velocity; WAIT does '
                                    "nothing. Decide from the state."
                                ),
                            },
                            {"role": "user", "content": json.dumps(state, separators=(",", ":"))},
                        ],
                        temperature=0,
                        top_p=1,
                        max_tokens=40,
                    ),
                    settings,
                )
                try:
                    answer = json.loads(result.text)
                    proposed = answer.get("action", "") if isinstance(answer, dict) else ""
                except ValueError:
                    proposed = ""
                action = proposed.upper() if isinstance(proposed, str) else ""
                valid = action in {"FLAP", "WAIT"}
                return {
                    "action": action if valid else "WAIT",
                    "invalid_output": not valid,
                    "raw_output": result.text[:500],
                    "usage": result.usage.model_dump(),
                    "latency_ms": result.latency_ms,
                }

        result = await run_episode(
            callback,
            spec.seed,
            frames_per_decision=spec.frames_per_decision,
            max_decisions=spec.max_decisions,
        )
        input_tokens = 0
        output_tokens = 0
        cached_tokens = 0
        for item in result["decisions"]:
            agent_result = item.get("agent_result")
            usage = agent_result.get("usage", {}) if isinstance(agent_result, dict) else {}
            input_tokens += int(usage.get("input_tokens", 0))
            output_tokens += int(usage.get("output_tokens", 0))
            cached_tokens += int(usage.get("cached_tokens", 0))
        latency_ms = sum(float(item.get("callback_ms", 0)) for item in result["decisions"])
        cost = 0.0
        if agent == "llm":
            cost = estimate_cost(provider, model, input_tokens, output_tokens, cached_tokens)
        with SessionLocal() as db:
            row = _get_episode(db, episode_id)
            row.status = "completed"
            row.score = result["score"]
            row.frames = result["frames"]
            row.decision_count = len(result["decisions"])
            row.input_tokens = input_tokens
            row.output_tokens = output_tokens
            row.cached_tokens = cached_tokens
            row.decision_latency_ms = latency_ms
            row.cost_usd = cost
            row.death_reason = result["death_reason"]
            row.replay = result
            db.commit()
    except Exception as exc:
        with SessionLocal() as db:
            row = _get_episode(db, episode_id)
            row.status = "failed"
            row.error = str(exc)[:500]
            db.commit()


@router.post("/human", status_code=201)
def start_human(request: HumanStart, db: Session = Depends(get_db)) -> dict[str, Any]:
    engine = FlappyEngine(request.seed)
    row = GameEpisode(
        id=f"game_{uuid.uuid4().hex[:12]}",
        agent="human",
        model_key=None,
        mode="local",
        seed=request.seed,
        status="running",
        spec={"agent": "human", "seed": request.seed},
        replay={"engine_replay": engine.get_replay(), "decisions": []},
        cost_usd=0.0,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return {**_view(row), "observation": engine.observation()}


@router.post("/human/{episode_id}/step")
def step_human(
    episode_id: str, request: HumanStep, db: Session = Depends(get_db)
) -> dict[str, Any]:
    row = _get_episode(db, episode_id)
    if row.agent != "human" or row.status != "running":
        raise HTTPException(409, "Tato lidská hra již neběží.")
    engine = FlappyEngine.from_replay(row.replay["engine_replay"])
    if engine.state.frame != request.expected_frame:
        raise HTTPException(409, "Hra se mezitím změnila. Načtěte aktuální stav.")
    observation = engine.observation()
    result = engine.step(request.action, request.frames)
    decisions = list(row.replay.get("decisions", []))
    decisions.append(
        {
            "index": len(decisions),
            "frame": observation["frame"],
            "action": request.action,
            "result": result,
        }
    )
    row.replay = {"engine_replay": engine.get_replay(), "decisions": decisions}
    row.score = engine.state.score
    row.frames = engine.state.frame
    row.decision_count = len(decisions)
    row.death_reason = engine.state.death_reason
    if result["done"]:
        row.status = "completed"
    db.commit()
    return {**_view(row), "observation": result["observation"], "events": result["events"]}


@router.post("/human/{episode_id}/finish")
def finish_human(episode_id: str, db: Session = Depends(get_db)) -> dict[str, Any]:
    row = _get_episode(db, episode_id)
    if row.agent != "human" or row.status != "running":
        raise HTTPException(409, "Tato lidská hra již neběží.")
    row.status = "completed"
    db.commit()
    return _view(row)


@router.get("/leaderboard")
def leaderboard(seed: int | None = None, db: Session = Depends(get_db)) -> dict[str, Any]:
    query = select(GameEpisode).where(GameEpisode.status == "completed")
    if seed is not None:
        query = query.where(GameEpisode.seed == seed)
    rows = db.scalars(query.order_by(GameEpisode.created_at.desc()).limit(5000))
    groups: dict[str, list[GameEpisode]] = defaultdict(list)
    for row in rows:
        key = row.model_key or row.agent
        groups[key].append(row)
    ranked = []
    for key, episodes in groups.items():
        scores = [item.score for item in episodes]
        ranked.append(
            {
                "key": key,
                "agent": episodes[0].agent,
                "model_key": episodes[0].model_key,
                "runs": len(scores),
                "best": max(scores),
                "average": sum(scores) / len(scores),
                "seeds": sorted({item.seed for item in episodes}),
                "input_tokens": sum(item.input_tokens for item in episodes),
                "output_tokens": sum(item.output_tokens for item in episodes),
                "cost_usd": (
                    sum(item.cost_usd or 0 for item in episodes)
                    if all(item.cost_usd is not None for item in episodes)
                    else None
                ),
            }
        )
    ranked.sort(key=lambda item: (-item["average"], -item["best"], item["key"]))
    return {"seed": seed, "rows": ranked}


@router.get("/episodes/{episode_id}")
def get_episode(episode_id: str, db: Session = Depends(get_db)) -> dict[str, Any]:
    return _view(_get_episode(db, episode_id), detail=True)


@router.get("/episodes/{episode_id}/replay")
def get_replay(episode_id: str, db: Session = Depends(get_db)) -> dict[str, Any]:
    row = _get_episode(db, episode_id)
    if row.status != "completed":
        raise HTTPException(409, "Replay je dostupný po dokončení hry.")
    replay = row.replay.get("engine_replay") if row.agent == "human" else row.replay.get("replay")
    if not replay:
        raise HTTPException(409, "Epizoda nemá uložený replay.")
    FlappyEngine.from_replay(replay, verify=True)
    return {"verified": True, "replay": replay, "decisions": row.replay.get("decisions", [])}


@router.post("/train", status_code=202)
def train_dqn(
    request: TrainCreate,
    tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    settings: Settings = Depends(get_settings),
) -> dict[str, Any]:
    row = GameTraining(
        id=f"train_{uuid.uuid4().hex[:12]}",
        status="queued",
        seed=request.seed,
        episodes_requested=request.episodes,
        result={"max_decisions": request.max_decisions},
    )
    db.add(row)
    db.commit()
    tasks.add_task(_train_task, row.id, settings)
    return {"id": row.id, "status": row.status}


async def _train_task(training_id: str, settings: Settings) -> None:
    async with _training_lock:
        try:
            with SessionLocal() as db:
                row = db.get(GameTraining, training_id)
                assert row is not None
                row.status = "running"
                seed, count = row.seed, row.episodes_requested
                max_decisions = int(row.result["max_decisions"])
                db.commit()
            checkpoint = _checkpoint_path(settings)
            trainer = (
                await asyncio.to_thread(DQNTrainer.load_checkpoint, checkpoint)
                if checkpoint.exists()
                else DQNTrainer(seed=seed)
            )
            if trainer.seed != seed:
                trainer = DQNTrainer(seed=seed)
            result = await asyncio.to_thread(trainer.train, count, max_decisions=max_decisions)
            temporary = checkpoint.with_name(checkpoint.name + ".tmp")
            await asyncio.to_thread(trainer.save_checkpoint, temporary)
            temporary.replace(checkpoint)
            evaluation = await asyncio.to_thread(
                trainer.evaluate,
                [seed + 100_000 + i for i in range(3)],
                max_decisions=max_decisions,
            )
            with SessionLocal() as db:
                row = db.get(GameTraining, training_id)
                assert row is not None
                row.status = "completed"
                row.episodes_completed = count
                row.result = {
                    "training": result,
                    "evaluation": evaluation,
                    "checkpoint": str(checkpoint),
                }
                db.commit()
        except Exception as exc:
            with SessionLocal() as db:
                row = db.get(GameTraining, training_id)
                if row:
                    row.status = "failed"
                    row.error = str(exc)[:500]
                    db.commit()


@router.get("/train/{training_id}")
def training_status(training_id: str, db: Session = Depends(get_db)) -> dict[str, Any]:
    row = db.get(GameTraining, training_id)
    if row is None:
        raise HTTPException(404, "Trénink nebyl nalezen.")
    return {
        "id": row.id,
        "status": row.status,
        "seed": row.seed,
        "episodes_requested": row.episodes_requested,
        "episodes_completed": row.episodes_completed,
        "result": row.result,
        "error": row.error,
    }


@router.get("/checkpoint")
def checkpoint_status(settings: Settings = Depends(get_settings)) -> dict[str, Any]:
    path = _checkpoint_path(settings)
    if not path.exists():
        return {"ready": False}
    trainer = DQNTrainer.load_checkpoint(path)
    return {
        "ready": True,
        "episodes": trainer.episodes,
        "steps": trainer.steps,
        "seed": trainer.seed,
    }
