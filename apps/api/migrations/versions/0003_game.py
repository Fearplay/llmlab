"""Persist Flappy AI episodes, replays and DQN training jobs."""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0003"
down_revision: str | None = "0002"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "game_episodes",
        sa.Column("id", sa.String(40), primary_key=True),
        sa.Column("agent", sa.String(24), nullable=False),
        sa.Column("model_key", sa.String(220)),
        sa.Column("mode", sa.String(20), nullable=False),
        sa.Column("seed", sa.Integer(), nullable=False),
        sa.Column("status", sa.String(20), nullable=False),
        sa.Column("score", sa.Integer(), nullable=False),
        sa.Column("frames", sa.Integer(), nullable=False),
        sa.Column("decision_count", sa.Integer(), nullable=False),
        sa.Column("input_tokens", sa.Integer(), nullable=False),
        sa.Column("output_tokens", sa.Integer(), nullable=False),
        sa.Column("cached_tokens", sa.Integer(), nullable=False),
        sa.Column("decision_latency_ms", sa.Float(), nullable=False),
        sa.Column("cost_usd", sa.Float()),
        sa.Column("death_reason", sa.String(30)),
        sa.Column("error", sa.Text()),
        sa.Column("spec", sa.JSON(), nullable=False),
        sa.Column("replay", sa.JSON(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_game_episodes_agent", "game_episodes", ["agent"])
    op.create_index("ix_game_episodes_model_key", "game_episodes", ["model_key"])
    op.create_index("ix_game_episodes_seed", "game_episodes", ["seed"])
    op.create_index("ix_game_episodes_status", "game_episodes", ["status"])
    op.create_table(
        "game_training",
        sa.Column("id", sa.String(40), primary_key=True),
        sa.Column("status", sa.String(20), nullable=False),
        sa.Column("seed", sa.Integer(), nullable=False),
        sa.Column("episodes_requested", sa.Integer(), nullable=False),
        sa.Column("episodes_completed", sa.Integer(), nullable=False),
        sa.Column("result", sa.JSON(), nullable=False),
        sa.Column("error", sa.Text()),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_game_training_status", "game_training", ["status"])


def downgrade() -> None:
    op.drop_table("game_training")
    op.drop_table("game_episodes")
