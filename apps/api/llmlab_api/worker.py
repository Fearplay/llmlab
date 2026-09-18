import time
from datetime import UTC, datetime

from celery import Celery  # type: ignore[import-untyped]
from sqlalchemy import select

from .database import SessionLocal
from .models import Run
from .settings import get_settings

settings = get_settings()
celery_app = Celery("llmlab", broker=settings.redis_url, backend=settings.redis_url)
celery_app.conf.task_track_started = True


@celery_app.task(name="llmlab.run_fixture")  # type: ignore[untyped-decorator]
def run_fixture(run_id: str) -> None:
    with SessionLocal() as session:
        run = session.scalar(select(Run).where(Run.id == run_id))
        if run is None:
            return
        run.status = "running"
        session.commit()
    for progress in range(10, 101, 10):
        time.sleep(0.12)
        with SessionLocal() as session:
            run = session.scalar(select(Run).where(Run.id == run_id))
            if run is None:
                return
            if run.status == "cancel_requested":
                run.status = "cancelled"
                run.completed_at = datetime.now(UTC)
                session.commit()
                return
            run.progress = progress
            session.commit()
    with SessionLocal() as session:
        run = session.scalar(select(Run).where(Run.id == run_id))
        if run is None:
            return
        run.status = "completed"
        run.completed_at = datetime.now(UTC)
        run.usage = {
            "input_tokens": 28410,
            "output_tokens": 19221,
            "cached_tokens": 0,
            "cost_usd": 2.94,
        }
        session.commit()
