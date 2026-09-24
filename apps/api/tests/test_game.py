"""Flappy AI engine and API behavior on a private SQLite database."""

from pathlib import Path

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from llmlab_api import game_api, lab_api
from llmlab_api.database import get_db
from llmlab_api.game_engine import DQNTrainer, FlappyEngine, RandomAgent
from llmlab_api.game_models import GameEpisode
from llmlab_api.models import Base
from llmlab_api.settings import Settings, get_settings


def test_seeded_replay_verifies_and_detects_tampering() -> None:
    first = FlappyEngine(seed=73)
    second = FlappyEngine(seed=73)
    policy = RandomAgent(seed=73)
    while first.state.alive and first.state.frame < 180:
        action = policy(first.observation())
        first.step(action, 12)
        second.step(action, 12)
    assert first.state.to_dict() == second.state.to_dict()
    replay = first.get_replay()
    assert FlappyEngine.from_replay(replay).state.to_dict() == first.state.to_dict()
    replay["steps"][0]["action"] = "WAIT" if replay["steps"][0]["action"] == "FLAP" else "FLAP"
    with pytest.raises(ValueError):
        FlappyEngine.from_replay(replay)


def test_dqn_checkpoint_roundtrip() -> None:
    trainer = DQNTrainer(seed=5, batch_size=4)
    trainer.train(3, max_decisions=8)
    path = Path("data/test-game-policy.npz").resolve()
    try:
        trainer.save_checkpoint(path)
        restored = DQNTrainer.load_checkpoint(path)
        observation = FlappyEngine(seed=9).observation()
        assert restored.episodes == 3
        assert restored.steps == trainer.steps
        assert restored.action(observation) == trainer.action(observation)
    finally:
        path.unlink(missing_ok=True)


def test_dqn_reports_training_progress() -> None:
    trainer = DQNTrainer(seed=5, batch_size=4)
    progress: list[int] = []
    result = trainer.train(27, max_decisions=8, on_progress=progress.append)
    assert progress == [25, 27]
    assert result["updates"] > 0
    assert len(result["episodes"]) == 27


def test_dqn_showcase_replays_twenty_real_courses() -> None:
    trainer = DQNTrainer(seed=42)
    trainer.train(1000, max_decisions=200)
    showcase = trainer.showcase(42)
    scores = [attempt["score"] for attempt in showcase["attempts"]]
    assert len(scores) == 20
    assert showcase["best_score"] == max(scores)
    assert showcase["winner_index"] == scores.index(max(scores))
    assert showcase["target_met"] is True
    assert showcase["best_score"] >= 20
    assert (
        FlappyEngine.from_replay(showcase["replay"], verify=True).state.score
        == showcase["best_score"]
    )
    assert all(attempt["steps"] for attempt in showcase["attempts"])


def test_training_api_exposes_progress_and_before_after_evaluation(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    engine = create_engine(
        "sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool
    )
    Base.metadata.create_all(engine)
    sessions = sessionmaker(bind=engine, expire_on_commit=False)
    monkeypatch.setattr(game_api, "SessionLocal", sessions)
    checkpoint = Path("data/test-training-checkpoint.npz").resolve()
    monkeypatch.setattr(game_api, "_checkpoint_path", lambda _settings: checkpoint)

    def db_session():
        with sessions() as db:
            yield db

    app = FastAPI()
    app.include_router(game_api.router)
    app.dependency_overrides[get_db] = db_session
    app.dependency_overrides[get_settings] = lambda: Settings(_env_file=None)
    try:
        with TestClient(app) as client:
            created = client.post(
                "/api/v1/game/train", json={"seed": 42, "episodes": 30, "max_decisions": 20}
            )
            assert created.status_code == 202
            training_id = created.json()["id"]
            saved = client.get(f"/api/v1/game/train/{training_id}").json()
            assert saved["status"] == "completed"
            assert saved["episodes_completed"] == 30
            assert len(saved["result"]["training"]["episodes"]) == 30
            assert saved["result"]["training"]["updates"] > 0
            assert len(saved["result"]["evaluation_before"]["episodes"]) == 20
            assert len(saved["result"]["evaluation"]["episodes"]) == 20
            assert client.get("/api/v1/game/train/latest").json()["id"] == training_id
            assert client.get("/api/v1/game/checkpoint").json()["episodes"] == 30
            showcase = client.get("/api/v1/game/showcase?seed=42")
            assert showcase.status_code == 200
            assert len(showcase.json()["attempts"]) == 20
            assert showcase.json()["checkpoint_episodes"] == 30
    finally:
        checkpoint.unlink(missing_ok=True)


def test_human_game_and_rule_agent_are_saved(monkeypatch) -> None:
    engine = create_engine(
        "sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool
    )
    Base.metadata.create_all(engine)
    sessions = sessionmaker(bind=engine, expire_on_commit=False)
    monkeypatch.setattr(game_api, "SessionLocal", sessions)

    def db_session():
        with sessions() as db:
            yield db

    app = FastAPI()
    app.include_router(game_api.router)
    app.include_router(lab_api.router)
    app.dependency_overrides[get_db] = db_session
    with TestClient(app) as client:
        human = client.post("/api/v1/game/human", json={"seed": 42})
        assert human.status_code == 201
        game = human.json()
        assert game["observation"]["frame"] == 0
        duplicate = client.post(
            f"/api/v1/game/human/{game['id']}/step",
            json={"action": "FLAP", "expected_frame": 99},
        )
        assert duplicate.status_code == 409
        step = client.post(
            f"/api/v1/game/human/{game['id']}/step",
            json={"action": "WAIT", "expected_frame": 0},
        )
        assert step.status_code == 200
        assert step.json()["frames"] > 0
        finish = client.post(f"/api/v1/game/human/{game['id']}/finish")
        assert finish.status_code == 200
        replay = client.get(f"/api/v1/game/episodes/{game['id']}/replay")
        assert replay.status_code == 200
        assert replay.json()["verified"] is True

        rule = client.post(
            "/api/v1/game/episodes",
            json={"agent": "rule", "seed": 42, "max_decisions": 20},
        )
        assert rule.status_code == 202
        saved = client.get(f"/api/v1/game/episodes/{rule.json()['id']}").json()
        assert saved["status"] == "completed"
        assert saved["decision_count"] > 0
        assert saved["cost_usd"] == 0
        board = client.get("/api/v1/game/leaderboard?seed=42").json()
        assert {item["agent"] for item in board["rows"]} == {"human", "rule"}
        operations = client.get("/api/v1/operations/summary").json()
        assert operations["game_episodes"] == 2
        assert operations["runs"] == 2

        with sessions() as db:
            db.add(GameEpisode(
                id="game_invalid_replies", agent="llm", model_key="openai:example",
                mode="cloud", seed=42, status="completed", spec={},
                replay={"decisions": [
                    {"agent_result": {"invalid_output": True}},
                    {"agent_result": {"invalid_output": False}},
                ]},
            ))
            db.commit()
        history = client.get("/api/v1/game/episodes").json()["episodes"]
        assert next(item for item in history if item["id"] == "game_invalid_replies")[
            "invalid_decisions"
        ] == 1
