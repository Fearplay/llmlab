"""Deterministic, CPU-only Flappy Bird simulation and trainable baseline agents.

The simulation advances in fixed frames. A FLAP applies once, on the first frame
of a step; WAIT applies no impulse. All distances are pixels. There is no clock,
global random generator, provider call, or mutable state outside an engine.
"""

from __future__ import annotations

import hashlib
import inspect
import io
import json
import math
import random
import time
from collections import deque
from collections.abc import Callable, Mapping
from dataclasses import asdict, dataclass, field
from pathlib import Path
from typing import Any


@dataclass(frozen=True)
class GameConfig:
    width: int = 480
    height: int = 640
    floor_height: int = 72
    bird_x: float = 120.0
    bird_radius: float = 14.0
    gravity: float = 0.38
    flap_velocity: float = -6.6
    terminal_velocity: float = 8.0
    pipe_speed: float = 2.5
    pipe_width: float = 64.0
    pipe_spacing: float = 210.0
    gap_size: float = 174.0
    gap_margin: float = 45.0
    initial_pipe_offset: float = 40.0

    def __post_init__(self) -> None:
        if self.width <= 0 or self.height <= 0 or self.floor_height <= 0:
            raise ValueError("Game dimensions must be positive")
        if self.floor_height >= self.height:
            raise ValueError("The floor must leave a playable area")
        if self.bird_radius <= 0 or self.bird_x <= self.bird_radius:
            raise ValueError("The bird must start inside the playable area")
        if self.bird_x + self.bird_radius >= self.width:
            raise ValueError("The bird must start inside the playable area")
        if self.gravity <= 0 or self.flap_velocity >= 0 or self.terminal_velocity <= 0:
            raise ValueError("Gravity, flap velocity, and terminal velocity are invalid")
        if self.pipe_speed <= 0 or self.pipe_width <= 0 or self.pipe_spacing <= self.pipe_width:
            raise ValueError("Pipe dimensions and speed are invalid")
        if self.gap_size <= 2 * self.bird_radius:
            raise ValueError("The gap must fit the bird")
        if self.gap_size + 2 * self.gap_margin >= self.floor_y:
            raise ValueError("There is no room to vary the pipe gap")

    @property
    def floor_y(self) -> int:
        return self.height - self.floor_height

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)

    @classmethod
    def from_dict(cls, data: Mapping[str, Any]) -> GameConfig:
        return cls(**dict(data))


@dataclass
class Pipe:
    id: int
    x: float
    gap_center: float
    scored: bool = False

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)

    @classmethod
    def from_dict(cls, data: Mapping[str, Any]) -> Pipe:
        return cls(
            id=int(data["id"]),
            x=float(data["x"]),
            gap_center=float(data["gap_center"]),
            scored=bool(data.get("scored", False)),
        )


@dataclass
class GameState:
    seed: int
    config: GameConfig
    frame: int
    bird_y: float
    bird_vy: float
    pipes: list[Pipe] = field(default_factory=list)
    next_pipe_id: int = 0
    score: int = 0
    alive: bool = True
    death_reason: str | None = None

    def to_dict(self) -> dict[str, Any]:
        return {
            "seed": self.seed,
            "config": self.config.to_dict(),
            "frame": self.frame,
            "bird_y": self.bird_y,
            "bird_vy": self.bird_vy,
            "pipes": [pipe.to_dict() for pipe in self.pipes],
            "next_pipe_id": self.next_pipe_id,
            "score": self.score,
            "alive": self.alive,
            "death_reason": self.death_reason,
        }

    @classmethod
    def from_dict(cls, data: Mapping[str, Any]) -> GameState:
        return cls(
            seed=int(data["seed"]),
            config=GameConfig.from_dict(data["config"]),
            frame=int(data["frame"]),
            bird_y=float(data["bird_y"]),
            bird_vy=float(data["bird_vy"]),
            pipes=[Pipe.from_dict(pipe) for pipe in data["pipes"]],
            next_pipe_id=int(data["next_pipe_id"]),
            score=int(data["score"]),
            alive=bool(data["alive"]),
            death_reason=data.get("death_reason"),
        )


def state_to_dict(state: GameState | Mapping[str, Any]) -> dict[str, Any]:
    """Return an independent JSON-ready snapshot."""
    if isinstance(state, GameState):
        return state.to_dict()
    return GameState.from_dict(state).to_dict()


def state_from_dict(data: Mapping[str, Any]) -> GameState:
    return GameState.from_dict(data)


def _gap_center(seed: int, pipe_id: int, config: GameConfig) -> float:
    """Produce a stable gap using only the seed and pipe ID."""
    digest = hashlib.blake2b(f"{seed}:{pipe_id}".encode(), digest_size=8).digest()
    fraction = int.from_bytes(digest, "big") / (2**64 - 1)
    lowest = config.gap_size / 2 + config.gap_margin
    highest = config.floor_y - config.gap_size / 2 - config.gap_margin
    return lowest + (highest - lowest) * fraction


def _circle_hits_rect(
    cx: float, cy: float, radius: float, left: float, top: float, right: float, bottom: float
) -> bool:
    nearest_x = max(left, min(cx, right))
    nearest_y = max(top, min(cy, bottom))
    return (cx - nearest_x) ** 2 + (cy - nearest_y) ** 2 <= radius**2


class FlappyEngine:
    """A fixed-step game with serializable state and exact action replay."""

    def __init__(self, seed: int = 0, config: GameConfig | None = None) -> None:
        self.config = config or GameConfig()
        self.seed = int(seed)
        self.state = GameState(
            seed=self.seed,
            config=self.config,
            frame=0,
            bird_y=self.config.floor_y * 0.45,
            bird_vy=0.0,
        )
        self.history: list[dict[str, Any]] = []
        self._spawn_pipe(self.config.width + self.config.initial_pipe_offset)

    def _spawn_pipe(self, x: float) -> None:
        pipe_id = self.state.next_pipe_id
        self.state.pipes.append(Pipe(pipe_id, x, _gap_center(self.seed, pipe_id, self.config)))
        self.state.next_pipe_id += 1

    @classmethod
    def from_state(cls, state: GameState | Mapping[str, Any]) -> FlappyEngine:
        snapshot = state if isinstance(state, GameState) else GameState.from_dict(state)
        engine = cls(seed=snapshot.seed, config=snapshot.config)
        # Copy through serialization so callers cannot mutate the engine accidentally.
        engine.state = GameState.from_dict(snapshot.to_dict())
        return engine

    def observation(self) -> dict[str, Any]:
        state = self.state
        config = self.config
        pipe_views = [
            {
                "id": pipe.id,
                "x": pipe.x,
                "width": config.pipe_width,
                "gap_top": pipe.gap_center - config.gap_size / 2,
                "gap_bottom": pipe.gap_center + config.gap_size / 2,
                "gap_center": pipe.gap_center,
                "scored": pipe.scored,
            }
            for pipe in state.pipes
        ]
        upcoming = next(
            (pipe for pipe in pipe_views if pipe["x"] + config.pipe_width >= config.bird_x),
            None,
        )
        if upcoming is None:
            # A pipe is always spawned during play. This also handles unusual restored states.
            distance = float(config.width)
            gap_center = config.floor_y / 2
        else:
            distance = upcoming["x"] - config.bird_x
            gap_center = upcoming["gap_center"]
        features = [
            state.bird_y / config.floor_y,
            max(-1.0, min(1.0, state.bird_vy / config.terminal_velocity)),
            max(-1.0, min(1.5, distance / config.width)),
            gap_center / config.floor_y,
            (gap_center - config.gap_size / 2) / config.floor_y,
            (gap_center + config.gap_size / 2) / config.floor_y,
        ]
        return {
            "frame": state.frame,
            "score": state.score,
            "alive": state.alive,
            "death_reason": state.death_reason,
            "state": state.to_dict(),
            "width": config.width,
            "height": config.height,
            "floor_y": config.floor_y,
            "physics": {
                "gravity": config.gravity,
                "flap_velocity": config.flap_velocity,
                "terminal_velocity": config.terminal_velocity,
                "pipe_speed": config.pipe_speed,
            },
            "bird": {
                "x": config.bird_x,
                "y": state.bird_y,
                "vy": state.bird_vy,
                "radius": config.bird_radius,
            },
            "pipes": pipe_views,
            "next_pipe": upcoming,
            "distance_to_next_pipe": distance,
            "features": features,
        }

    def _advance_frame(self, flap: bool) -> list[str]:
        state = self.state
        config = self.config
        events: list[str] = []
        if flap:
            state.bird_vy = config.flap_velocity
            events.append("FLAP")
        state.bird_vy = min(config.terminal_velocity, state.bird_vy + config.gravity)
        state.bird_y += state.bird_vy
        state.frame += 1

        for pipe in state.pipes:
            pipe.x -= config.pipe_speed
        if state.pipes and state.pipes[-1].x <= config.width - config.pipe_spacing:
            self._spawn_pipe(state.pipes[-1].x + config.pipe_spacing)
        state.pipes = [pipe for pipe in state.pipes if pipe.x + config.pipe_width >= 0]

        if state.bird_y - config.bird_radius <= 0:
            state.alive = False
            state.death_reason = "ceiling"
        elif state.bird_y + config.bird_radius >= config.floor_y:
            state.alive = False
            state.death_reason = "ground"
        else:
            for pipe in state.pipes:
                top = pipe.gap_center - config.gap_size / 2
                bottom = pipe.gap_center + config.gap_size / 2
                if _circle_hits_rect(
                    config.bird_x,
                    state.bird_y,
                    config.bird_radius,
                    pipe.x,
                    0,
                    pipe.x + config.pipe_width,
                    top,
                ) or _circle_hits_rect(
                    config.bird_x,
                    state.bird_y,
                    config.bird_radius,
                    pipe.x,
                    bottom,
                    pipe.x + config.pipe_width,
                    config.floor_y,
                ):
                    state.alive = False
                    state.death_reason = "pipe"
                    break
        if not state.alive:
            events.append(f"DEATH:{state.death_reason}")
        else:
            for pipe in state.pipes:
                if not pipe.scored and pipe.x + config.pipe_width < config.bird_x:
                    pipe.scored = True
                    state.score += 1
                    events.append("SCORE")
        return events

    def step(self, action: str, frames: int = 12) -> dict[str, Any]:
        if action not in ("FLAP", "WAIT"):
            raise ValueError("action must be 'FLAP' or 'WAIT'")
        if isinstance(frames, bool) or not isinstance(frames, int) or frames <= 0:
            raise ValueError("frames must be a positive integer")
        before = self.state.to_dict()
        score_before = self.state.score
        advanced = 0
        events: list[str] = []
        if self.state.alive:
            for frame_index in range(frames):
                events.extend(self._advance_frame(action == "FLAP" and frame_index == 0))
                advanced += 1
                if not self.state.alive:
                    break
        reward = 0.01 * advanced + 10.0 * (self.state.score - score_before)
        if advanced and not self.state.alive:
            reward -= 5.0
        result = {
            "observation": self.observation(),
            "state": self.state.to_dict(),
            "reward": reward,
            "done": not self.state.alive,
            "frames_advanced": advanced,
            "events": events,
        }
        self.history.append(
            {
                "frame": before["frame"],
                "state": before,
                "observation": _observation_from_state(before),
                "action": action,
                "frames": frames,
                "result": result,
            }
        )
        return result

    def get_replay(self) -> dict[str, Any]:
        return {
            "seed": self.seed,
            "config": self.config.to_dict(),
            "steps": self.history,
            "final_state": self.state.to_dict(),
        }

    @classmethod
    def from_replay(cls, replay: Mapping[str, Any], *, verify: bool = True) -> FlappyEngine:
        engine = cls(int(replay["seed"]), GameConfig.from_dict(replay["config"]))
        for entry in replay["steps"]:
            if verify and engine.state.to_dict() != entry["state"]:
                raise ValueError("Replay diverged before a step")
            result = engine.step(entry["action"], int(entry["frames"]))
            if verify and result["state"] != entry["result"]["state"]:
                raise ValueError("Replay diverged after a step")
        if verify and engine.state.to_dict() != replay["final_state"]:
            raise ValueError("Replay final state differs")
        return engine


def _observation_from_state(state: Mapping[str, Any]) -> dict[str, Any]:
    return FlappyEngine.from_state(state).observation()


def render_png(state: GameState | Mapping[str, Any]) -> bytes:
    """Draw the same geometry reported by ``observation`` into a PNG image."""
    from PIL import Image, ImageDraw, ImageFont

    snapshot = state if isinstance(state, GameState) else GameState.from_dict(state)
    config = snapshot.config
    image = Image.new("RGB", (config.width, config.height), "#8ed6eb")
    draw = ImageDraw.Draw(image)
    floor = config.floor_y

    for pipe in snapshot.pipes:
        left = pipe.x
        right = pipe.x + config.pipe_width
        top = pipe.gap_center - config.gap_size / 2
        bottom = pipe.gap_center + config.gap_size / 2
        draw.rectangle((left, 0, right, top), fill="#2b9a49", outline="#166330", width=2)
        draw.rectangle((left, bottom, right, floor), fill="#2b9a49", outline="#166330", width=2)
        draw.rectangle(
            (left - 4, top - 14, right + 4, top), fill="#38b956", outline="#166330", width=2
        )
        draw.rectangle(
            (left - 4, bottom, right + 4, bottom + 14), fill="#38b956", outline="#166330", width=2
        )

    draw.rectangle((0, floor, config.width, config.height), fill="#d6b677")
    draw.rectangle((0, floor, config.width, floor + 13), fill="#70b852")
    x, y, radius = config.bird_x, snapshot.bird_y, config.bird_radius
    draw.ellipse(
        (x - radius, y - radius, x + radius, y + radius), fill="#ffe05d", outline="#8b5a20", width=2
    )
    draw.ellipse(
        (x + radius * 0.15, y - radius * 0.48, x + radius * 0.48, y - radius * 0.15), fill="#242424"
    )
    draw.polygon(
        [
            (x + radius * 0.65, y),
            (x + radius * 1.35, y + radius * 0.15),
            (x + radius * 0.65, y + radius * 0.35),
        ],
        fill="#f29336",
    )
    draw.text((12, 12), f"Score {snapshot.score}", fill="#15343d", font=ImageFont.load_default())
    if not snapshot.alive:
        draw.text(
            (12, 32),
            f"Game over: {snapshot.death_reason}",
            fill="#8d2121",
            font=ImageFont.load_default(),
        )
    output = io.BytesIO()
    image.save(output, format="PNG")
    return output.getvalue()


class RandomAgent:
    """A seeded random baseline; construct a new instance for each run."""

    def __init__(self, seed: int = 0, flap_probability: float = 0.25) -> None:
        if not 0 <= flap_probability <= 1:
            raise ValueError("flap_probability must be between 0 and 1")
        self.rng = random.Random(seed)
        self.flap_probability = flap_probability

    def __call__(self, observation: Mapping[str, Any]) -> str:
        return "FLAP" if self.rng.random() < self.flap_probability else "WAIT"


def random_agent(observation: Mapping[str, Any], rng: random.Random | None = None) -> str:
    """A simple random policy; pass a seeded ``rng`` for repeatable actions."""
    generator = rng if rng is not None else random
    return "FLAP" if generator.random() < 0.25 else "WAIT"


def rule_agent(observation: Mapping[str, Any]) -> str:
    """A velocity-aware, hand-written baseline for the current pipe gap."""
    bird = observation["bird"]
    upcoming = observation["next_pipe"]
    target = observation["floor_y"] * 0.45 if upcoming is None else upcoming["gap_center"]
    # Predict where the bird will be after one decision interval. This lets a
    # falling bird flap before crossing the target, without oscillating rapidly.
    projected_y = bird["y"] + bird["vy"] * 7 + observation["physics"]["gravity"] * 28
    return "FLAP" if projected_y > target + 5 else "WAIT"


async def run_episode(
    agent_callback: Callable[[dict[str, Any]], Any],
    seed: int,
    frames_per_decision: int = 12,
    max_decisions: int = 200,
    config: GameConfig | None = None,
) -> dict[str, Any]:
    """Run an agent, accepting sync or async callbacks that return an action.

    A callback may return ``'FLAP'``/``'WAIT'`` or a mapping with an ``action``
    key. Each decision records the pre-step snapshot and callback wall time.
    """
    if isinstance(max_decisions, bool) or not isinstance(max_decisions, int) or max_decisions <= 0:
        raise ValueError("max_decisions must be a positive integer")
    engine = FlappyEngine(seed, config)
    decisions: list[dict[str, Any]] = []
    for index in range(max_decisions):
        observation = engine.observation()
        state = engine.state.to_dict()
        started = time.perf_counter()
        response = agent_callback(observation)
        if inspect.isawaitable(response):
            response = await response
        callback_ms = (time.perf_counter() - started) * 1000
        action = response.get("action") if isinstance(response, Mapping) else response
        if not isinstance(action, str):
            raise ValueError("Agent action must be FLAP or WAIT")
        step_started = time.perf_counter()
        result = engine.step(action, frames_per_decision)
        step_ms = (time.perf_counter() - step_started) * 1000
        decisions.append(
            {
                "index": index,
                "frame": state["frame"],
                "state": state,
                "observation": observation,
                "action": action,
                "agent_result": json.loads(json.dumps(response, default=str)),
                "result": result,
                "callback_ms": callback_ms,
                "timings": {
                    "callback_ms": callback_ms,
                    "step_ms": step_ms,
                    "total_ms": callback_ms + step_ms,
                },
            }
        )
        if result["done"]:
            break
    return {
        "seed": int(seed),
        "config": engine.config.to_dict(),
        "score": engine.state.score,
        "frames": engine.state.frame,
        "alive": engine.state.alive,
        "death_reason": engine.state.death_reason,
        "decisions": decisions,
        "final_state": engine.state.to_dict(),
        "replay": engine.get_replay(),
    }


class _QNetwork:
    """A small NumPy MLP with explicit backpropagation and Adam updates."""

    def __init__(self, rng: Any, hidden_size: int = 32) -> None:
        import numpy as np

        self.weights = [
            rng.normal(0, math.sqrt(2 / 6), (6, hidden_size)).astype(np.float32),
            np.zeros(hidden_size, dtype=np.float32),
            rng.normal(0, math.sqrt(2 / hidden_size), (hidden_size, hidden_size)).astype(
                np.float32
            ),
            np.zeros(hidden_size, dtype=np.float32),
            rng.normal(0, math.sqrt(2 / hidden_size), (hidden_size, 2)).astype(np.float32),
            np.zeros(2, dtype=np.float32),
        ]
        self.m = [np.zeros_like(weight) for weight in self.weights]
        self.v = [np.zeros_like(weight) for weight in self.weights]
        self.updates = 0

    def predict(self, inputs: Any) -> Any:
        import numpy as np

        w1, b1, w2, b2, w3, b3 = self.weights
        hidden1 = np.maximum(inputs @ w1 + b1, 0)
        hidden2 = np.maximum(hidden1 @ w2 + b2, 0)
        return hidden2 @ w3 + b3

    def copy_from(self, other: _QNetwork) -> None:
        for dest, source in zip(self.weights, other.weights, strict=True):
            dest[...] = source

    def train_batch(self, states: Any, actions: Any, targets: Any, learning_rate: float) -> float:
        import numpy as np

        w1, b1, w2, b2, w3, b3 = self.weights
        z1 = states @ w1 + b1
        h1 = np.maximum(z1, 0)
        z2 = h1 @ w2 + b2
        h2 = np.maximum(z2, 0)
        q_values = h2 @ w3 + b3
        errors = q_values[np.arange(len(actions)), actions] - targets
        absolute = np.abs(errors)
        loss = np.mean(np.where(absolute <= 1, 0.5 * errors**2, absolute - 0.5))
        derivatives = np.where(absolute <= 1, errors, np.sign(errors)) / len(actions)
        d_q = np.zeros_like(q_values)
        d_q[np.arange(len(actions)), actions] = derivatives
        gradients: list[Any] = [None] * 6
        gradients[4] = h2.T @ d_q
        gradients[5] = d_q.sum(axis=0)
        d_h2 = (d_q @ w3.T) * (z2 > 0)
        gradients[2] = h1.T @ d_h2
        gradients[3] = d_h2.sum(axis=0)
        d_h1 = (d_h2 @ w2.T) * (z1 > 0)
        gradients[0] = states.T @ d_h1
        gradients[1] = d_h1.sum(axis=0)
        self.updates += 1
        for index, (weight, gradient) in enumerate(zip(self.weights, gradients, strict=True)):
            gradient = np.clip(gradient, -10, 10)
            self.m[index] = 0.9 * self.m[index] + 0.1 * gradient
            self.v[index] = 0.999 * self.v[index] + 0.001 * gradient**2
            corrected_m = self.m[index] / (1 - 0.9**self.updates)
            corrected_v = self.v[index] / (1 - 0.999**self.updates)
            weight -= learning_rate * corrected_m / (np.sqrt(corrected_v) + 1e-8)
        return float(loss)


class DQNTrainer:
    """Real NumPy DQN: replay buffer, target net, epsilon policy, checkpointing."""

    def __init__(
        self,
        seed: int = 0,
        config: GameConfig | None = None,
        hidden_size: int = 32,
        replay_capacity: int = 20_000,
        batch_size: int = 64,
        learning_rate: float = 0.001,
        gamma: float = 0.99,
        target_sync_steps: int = 200,
        epsilon_start: float = 1.0,
        epsilon_end: float = 0.05,
        epsilon_decay_steps: int = 10_000,
        frames_per_decision: int = 12,
    ) -> None:
        import numpy as np

        if replay_capacity <= 0 or batch_size <= 0 or target_sync_steps <= 0:
            raise ValueError("Replay, batch, and target sync sizes must be positive")
        if not 0 <= epsilon_end <= epsilon_start <= 1 or epsilon_decay_steps <= 0:
            raise ValueError("Invalid epsilon schedule")
        if not 0 <= gamma <= 1 or learning_rate <= 0:
            raise ValueError("Invalid gamma or learning rate")
        self.seed = int(seed)
        self.config = config or GameConfig()
        self.hidden_size = hidden_size
        self.replay_capacity = replay_capacity
        self.batch_size = batch_size
        self.learning_rate = learning_rate
        self.gamma = gamma
        self.target_sync_steps = target_sync_steps
        self.epsilon_start = epsilon_start
        self.epsilon_end = epsilon_end
        self.epsilon_decay_steps = epsilon_decay_steps
        self.frames_per_decision = frames_per_decision
        self.rng = np.random.default_rng(self.seed)
        self.online = _QNetwork(self.rng, hidden_size)
        self.target = _QNetwork(self.rng, hidden_size)
        self.target.copy_from(self.online)
        self.replay_buffer: deque[tuple[Any, int, float, Any, bool]] = deque(maxlen=replay_capacity)
        self.steps = 0
        self.episodes = 0
        self.losses: list[float] = []

    @property
    def epsilon(self) -> float:
        fraction = min(1.0, self.steps / self.epsilon_decay_steps)
        return self.epsilon_start + fraction * (self.epsilon_end - self.epsilon_start)

    def _features(self, observation: Mapping[str, Any]) -> Any:
        import numpy as np

        return np.asarray(observation["features"], dtype=np.float32)

    def action(self, observation: Mapping[str, Any], *, explore: bool = False) -> str:
        import numpy as np

        if explore and self.rng.random() < self.epsilon:
            index = int(self.rng.integers(0, 2))
        else:
            index = int(np.argmax(self.online.predict(self._features(observation)[None, :])))
        return ("WAIT", "FLAP")[index]

    def __call__(self, observation: Mapping[str, Any]) -> str:
        return self.action(observation, explore=False)

    def _learn(self) -> float | None:
        import numpy as np

        if len(self.replay_buffer) < self.batch_size:
            return None
        indices = self.rng.choice(len(self.replay_buffer), size=self.batch_size, replace=False)
        batch = [self.replay_buffer[int(index)] for index in indices]
        states = np.stack([item[0] for item in batch])
        actions = np.asarray([item[1] for item in batch], dtype=np.intp)
        rewards = np.asarray([item[2] for item in batch], dtype=np.float32)
        next_states = np.stack([item[3] for item in batch])
        dones = np.asarray([item[4] for item in batch], dtype=np.float32)
        targets = rewards + self.gamma * (1 - dones) * np.max(
            self.target.predict(next_states), axis=1
        )
        loss = self.online.train_batch(states, actions, targets, self.learning_rate)
        self.losses.append(loss)
        return loss

    def train(
        self,
        episodes: int,
        *,
        max_decisions: int = 200,
        on_progress: Callable[[int], None] | None = None,
    ) -> dict[str, Any]:
        if episodes <= 0 or max_decisions <= 0:
            raise ValueError("episodes and max_decisions must be positive")
        results = []
        for _ in range(episodes):
            # Episode seeds never overlap the default held-out evaluation seeds.
            episode_seed = self.seed + self.episodes
            engine = FlappyEngine(episode_seed, self.config)
            episode_reward = 0.0
            for _decision in range(max_decisions):
                observation = engine.observation()
                action = self.action(observation, explore=True)
                result = engine.step(action, self.frames_per_decision)
                self.replay_buffer.append(
                    (
                        self._features(observation),
                        1 if action == "FLAP" else 0,
                        result["reward"],
                        self._features(result["observation"]),
                        result["done"],
                    )
                )
                episode_reward += result["reward"]
                self.steps += 1
                self._learn()
                if self.steps % self.target_sync_steps == 0:
                    self.target.copy_from(self.online)
                if result["done"]:
                    break
            results.append(
                {
                    "seed": episode_seed,
                    "score": engine.state.score,
                    "frames": engine.state.frame,
                    "reward": episode_reward,
                }
            )
            self.episodes += 1
            if on_progress is not None and (len(results) % 25 == 0 or len(results) == episodes):
                on_progress(len(results))
        return {
            "episodes": results,
            "total_steps": self.steps,
            "updates": self.online.updates,
            "epsilon": self.epsilon,
            "mean_loss": sum(self.losses) / len(self.losses) if self.losses else None,
        }

    def evaluate(
        self, seeds: list[int] | None = None, *, max_decisions: int = 200
    ) -> dict[str, Any]:
        """Greedy evaluation on explicit or held-out seeds; no weights are changed."""
        evaluation_seeds = (
            seeds if seeds is not None else [self.seed + 100_000 + i for i in range(10)]
        )
        if not evaluation_seeds or max_decisions <= 0:
            raise ValueError("evaluation seeds and max_decisions must be nonempty and positive")
        results = []
        for seed in evaluation_seeds:
            engine = FlappyEngine(seed, self.config)
            for _ in range(max_decisions):
                result = engine.step(self.action(engine.observation()), self.frames_per_decision)
                if result["done"]:
                    break
            results.append(
                {"seed": seed, "score": engine.state.score, "frames": engine.state.frame}
            )
        return {
            "episodes": results,
            "mean_score": sum(item["score"] for item in results) / len(results),
            "mean_frames": sum(item["frames"] for item in results) / len(results),
        }

    def showcase(self, seed: int, *, count: int = 20, max_decisions: int = 200) -> dict[str, Any]:
        """Play independent held-out courses and return their real trajectories.

        Every bird uses the saved greedy policy. The compact trajectories drive the
        twenty-bird preview; the winner includes an exact, verifiable game replay.
        """
        if count <= 0 or max_decisions <= 0:
            raise ValueError("count and max_decisions must be positive")
        attempts: list[dict[str, Any]] = []
        best_score = -1
        winner_index = 0
        winner_replay: dict[str, Any] | None = None
        for index in range(count):
            course_seed = (seed + 100_000 + index) % 2_147_483_648
            engine = FlappyEngine(course_seed, self.config)
            trace = []
            for _ in range(max_decisions):
                observation = engine.observation()
                result = engine.step(self.action(observation), self.frames_per_decision)
                next_observation = result["observation"]
                pipe = next_observation["next_pipe"]
                trace.append({
                    "frame": next_observation["frame"],
                    "y": round(next_observation["bird"]["y"], 1),
                    "score": next_observation["score"],
                    "alive": next_observation["alive"],
                    "pipe_x": round(pipe["x"], 1) if pipe else None,
                    "gap_top": round(pipe["gap_top"], 1) if pipe else None,
                    "gap_bottom": round(pipe["gap_bottom"], 1) if pipe else None,
                })
                if result["done"]:
                    break
            attempts.append({"seed": course_seed, "score": engine.state.score, "steps": trace})
            if engine.state.score > best_score:
                best_score = engine.state.score
                winner_index = index
                winner_replay = engine.get_replay()
        assert winner_replay is not None
        FlappyEngine.from_replay(winner_replay, verify=True)
        return {
            "attempts": attempts,
            "winner_index": winner_index,
            "best_score": best_score,
            "target_score": 20,
            "target_met": best_score >= 20,
            "replay": winner_replay,
        }

    def save_checkpoint(self, path: str | Path) -> None:
        """Persist learned weights and metadata in one compressed NumPy file."""
        import numpy as np

        metadata = {
            "seed": self.seed,
            "config": self.config.to_dict(),
            "hidden_size": self.hidden_size,
            "replay_capacity": self.replay_capacity,
            "batch_size": self.batch_size,
            "learning_rate": self.learning_rate,
            "gamma": self.gamma,
            "target_sync_steps": self.target_sync_steps,
            "epsilon_start": self.epsilon_start,
            "epsilon_end": self.epsilon_end,
            "epsilon_decay_steps": self.epsilon_decay_steps,
            "frames_per_decision": self.frames_per_decision,
            "steps": self.steps,
            "episodes": self.episodes,
            "updates": self.online.updates,
            "rng_state": self.rng.bit_generator.state,
        }
        arrays = {f"online_{index}": weight for index, weight in enumerate(self.online.weights)}
        arrays.update(
            {f"target_{index}": weight for index, weight in enumerate(self.target.weights)}
        )
        arrays.update({f"online_m_{index}": moment for index, moment in enumerate(self.online.m)})
        arrays.update({f"online_v_{index}": moment for index, moment in enumerate(self.online.v)})
        if self.replay_buffer:
            arrays["replay_states"] = np.stack([item[0] for item in self.replay_buffer])
            arrays["replay_actions"] = np.asarray(
                [item[1] for item in self.replay_buffer], dtype=np.int8
            )
            arrays["replay_rewards"] = np.asarray(
                [item[2] for item in self.replay_buffer], dtype=np.float32
            )
            arrays["replay_next_states"] = np.stack([item[3] for item in self.replay_buffer])
            arrays["replay_dones"] = np.asarray(
                [item[4] for item in self.replay_buffer], dtype=np.bool_
            )
        else:
            arrays["replay_states"] = np.empty((0, 6), dtype=np.float32)
            arrays["replay_actions"] = np.empty((0,), dtype=np.int8)
            arrays["replay_rewards"] = np.empty((0,), dtype=np.float32)
            arrays["replay_next_states"] = np.empty((0, 6), dtype=np.float32)
            arrays["replay_dones"] = np.empty((0,), dtype=np.bool_)
        arrays["metadata"] = np.asarray(json.dumps(metadata))
        path = Path(path)
        path.parent.mkdir(parents=True, exist_ok=True)
        with path.open("wb") as checkpoint:
            np.savez_compressed(checkpoint, **arrays)

    @classmethod
    def load_checkpoint(cls, path: str | Path) -> DQNTrainer:
        import numpy as np

        with np.load(path, allow_pickle=False) as saved:
            metadata = json.loads(str(saved["metadata"]))
            trainer = cls(
                seed=metadata["seed"],
                config=GameConfig.from_dict(metadata["config"]),
                hidden_size=metadata["hidden_size"],
                replay_capacity=metadata["replay_capacity"],
                batch_size=metadata["batch_size"],
                learning_rate=metadata["learning_rate"],
                gamma=metadata["gamma"],
                target_sync_steps=metadata["target_sync_steps"],
                epsilon_start=metadata["epsilon_start"],
                epsilon_end=metadata["epsilon_end"],
                epsilon_decay_steps=metadata["epsilon_decay_steps"],
                frames_per_decision=metadata["frames_per_decision"],
            )
            for index in range(6):
                trainer.online.weights[index][...] = saved[f"online_{index}"]
                trainer.target.weights[index][...] = saved[f"target_{index}"]
                trainer.online.m[index][...] = saved[f"online_m_{index}"]
                trainer.online.v[index][...] = saved[f"online_v_{index}"]
            for state, action, reward, next_state, done in zip(
                saved["replay_states"],
                saved["replay_actions"],
                saved["replay_rewards"],
                saved["replay_next_states"],
                saved["replay_dones"],
                strict=True,
            ):
                trainer.replay_buffer.append(
                    (state.copy(), int(action), float(reward), next_state.copy(), bool(done))
                )
            trainer.rng.bit_generator.state = metadata["rng_state"]
            trainer.steps = metadata["steps"]
            trainer.episodes = metadata["episodes"]
            trainer.online.updates = metadata["updates"]
            return trainer


__all__ = [
    "DQNTrainer",
    "FlappyEngine",
    "GameConfig",
    "GameState",
    "Pipe",
    "RandomAgent",
    "random_agent",
    "render_png",
    "rule_agent",
    "run_episode",
    "state_from_dict",
    "state_to_dict",
]
