"""Persist live experiments, datasets and uploaded documents."""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0002"
down_revision: str | None = "0001"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("runs", sa.Column("kind", sa.String(30), nullable=False, server_default="prompt"))
    op.add_column("runs", sa.Column("spec", sa.JSON(), nullable=False, server_default="{}"))
    op.add_column("runs", sa.Column("results", sa.JSON(), nullable=False, server_default="[]"))
    op.add_column("runs", sa.Column("metrics", sa.JSON(), nullable=False, server_default="{}"))
    op.add_column("runs", sa.Column("trace", sa.JSON(), nullable=False, server_default="[]"))
    op.create_index("ix_runs_kind", "runs", ["kind"])
    op.create_table(
        "datasets",
        sa.Column("id", sa.String(40), primary_key=True),
        sa.Column("name", sa.String(180), nullable=False),
        sa.Column("version", sa.Integer(), nullable=False),
        sa.Column("cases", sa.JSON(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_table(
        "user_documents",
        sa.Column("id", sa.String(40), primary_key=True),
        sa.Column("name", sa.String(260), nullable=False),
        sa.Column("media_type", sa.String(100), nullable=False),
        sa.Column("text", sa.Text(), nullable=False),
        sa.Column("metadata_json", sa.JSON(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    if op.get_bind().dialect.name == "postgresql":
        op.execute(
            "ALTER TABLE embedding_chunks ALTER COLUMN embedding TYPE json "
            "USING embedding::text::json"
        )


def downgrade() -> None:
    op.drop_table("user_documents")
    op.drop_table("datasets")
    op.drop_index("ix_runs_kind", table_name="runs")
    for name in ("trace", "metrics", "results", "spec", "kind"):
        op.drop_column("runs", name)
