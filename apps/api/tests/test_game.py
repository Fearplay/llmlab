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
from llmlab_api.models import Base


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
