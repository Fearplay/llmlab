"""Initial immutable artifacts, runs, and reviews."""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from pgvector.sqlalchemy import Vector

revision: str = "0001"
down_revision: str | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    if op.get_bind().dialect.name == "postgresql":
        op.execute("CREATE EXTENSION IF NOT EXISTS vector")
    op.create_table(
        "runs",
        sa.Column("id", sa.String(40), primary_key=True),
        sa.Column("name", sa.String(180), nullable=False),
        sa.Column("status", sa.String(30), nullable=False),
        sa.Column("mode", sa.String(20), nullable=False),
        sa.Column("provider", sa.String(80), nullable=False),
        sa.Column("model", sa.String(160), nullable=False),
        sa.Column("dataset_version", sa.String(100), nullable=False),
        sa.Column("prompt_version", sa.String(100), nullable=False),
        sa.Column("evaluator_versions", sa.JSON(), nullable=False),
        sa.Column("config_hash", sa.String(64), nullable=False),
        sa.Column("git_sha", sa.String(64), nullable=False),
        sa.Column("progress", sa.Integer(), nullable=False),
        sa.Column("usage", sa.JSON(), nullable=False),
        sa.Column("error", sa.Text()),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("completed_at", sa.DateTime(timezone=True)),
    )
    op.create_index("ix_runs_status", "runs", ["status"])
    op.create_table(
        "versioned_artifacts",
        sa.Column("id", sa.String(40), primary_key=True),
        sa.Column("kind", sa.String(30), nullable=False),
        sa.Column("name", sa.String(180), nullable=False),
        sa.Column("version", sa.Integer(), nullable=False),
        sa.Column("content_hash", sa.String(64), nullable=False, unique=True),
        sa.Column("content", sa.JSON(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_versioned_artifacts_kind", "versioned_artifacts", ["kind"])
    op.create_table(
        "human_reviews",
        sa.Column("id", sa.String(40), primary_key=True),
        sa.Column("run_id", sa.String(40), nullable=False),
        sa.Column("case_id", sa.String(80), nullable=False),
        sa.Column("verdict", sa.String(30), nullable=False),
        sa.Column("comment", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_human_reviews_run_id", "human_reviews", ["run_id"])
    op.create_index("ix_human_reviews_case_id", "human_reviews", ["case_id"])
    op.create_table(
        "embedding_chunks",
        sa.Column("id", sa.String(40), primary_key=True),
        sa.Column("collection", sa.String(120), nullable=False),
        sa.Column("source", sa.String(500), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("embedding", Vector(1536), nullable=False),
        sa.Column("metadata_json", sa.JSON(), nullable=False),
    )
    op.create_index("ix_embedding_chunks_collection", "embedding_chunks", ["collection"])


def downgrade() -> None:
    op.drop_table("embedding_chunks")
    op.drop_table("human_reviews")
    op.drop_table("versioned_artifacts")
    op.drop_table("runs")
