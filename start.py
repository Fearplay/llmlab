"""Start the local LLMLab API and web app with a persistent SQLite database.

Ollama is a separate service. LLMLab discovers models from its running server;
this launcher never starts or installs models on the user's behalf.
"""

from __future__ import annotations

import os
import shutil
import subprocess
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path


ROOT = Path(__file__).resolve().parent
API = ROOT / "apps" / "api"
WEB = ROOT / "apps" / "web"
DATA = ROOT / ".local-data"
API_PYTHON = API / ".venv" / ("Scripts/python.exe" if os.name == "nt" else "bin/python")


def command(name: str) -> str:
    executable = shutil.which(name)
    if executable is None:
        raise SystemExit(f"Chybí {name}. Nainstaluj jej a znovu spusť python start.py.")
    return executable


def ensure_dependencies() -> None:
    if not API_PYTHON.is_file():
        print("Instaluji Python závislosti…", flush=True)
    subprocess.run(
        [command("uv"), "sync", "--locked", "--inexact", "--project", str(API),
         "--cache-dir", str(ROOT / ".uv-cache")],
        cwd=ROOT,
        check=True,
    )
    # Keep optional extras that the user deliberately installed before startup.
    if not (WEB / "node_modules" / "next").exists():
        print("Instaluji webové závislosti…", flush=True)
        subprocess.run([command("pnpm"), "install", "--frozen-lockfile"], cwd=ROOT, check=True)


def ready(url: str, process: subprocess.Popen[bytes], seconds: int) -> bool:
    deadline = time.monotonic() + seconds
    while time.monotonic() < deadline:
        if process.poll() is not None:
            return False
        try:
            with urllib.request.urlopen(url, timeout=2) as response:
                if 200 <= response.status < 400:
                    return True
        except (OSError, urllib.error.URLError):
            pass
        time.sleep(0.5)
    return False


def stop(process: subprocess.Popen[bytes]) -> None:
    if process.poll() is not None:
        return
    process.terminate()
    try:
        process.wait(timeout=8)
    except subprocess.TimeoutExpired:
        process.kill()
        process.wait(timeout=4)


def main() -> int:
    DATA.mkdir(exist_ok=True)
    ensure_dependencies()
    env = os.environ.copy()
    env["DATABASE_URL"] = f"sqlite:///{(DATA / 'lab.sqlite3').as_posix()}"
    env["API_URL"] = "http://127.0.0.1:8000"
    env.setdefault("OLLAMA_BASE_URL", "http://127.0.0.1:11434")
    env["PYTHONPATH"] = str(API)
    api = subprocess.Popen(
        [str(API_PYTHON), "-m", "uvicorn", "llmlab_api.main:app", "--host", "127.0.0.1", "--port", "8000"],
        cwd=ROOT,
        env=env,
    )
    web: subprocess.Popen[bytes] | None = None
    try:
        if not ready("http://127.0.0.1:8000/health/ready", api, 45):
            print("API se nespustilo. Podrobnosti jsou ve výpisu výše.", file=sys.stderr)
            return 1
        web = subprocess.Popen(
            [command("pnpm"), "--dir", str(WEB), "dev", "--hostname", "127.0.0.1"],
            cwd=ROOT,
            env=env,
        )
        if not ready("http://127.0.0.1:3000", web, 90):
            print("Web se nespustil. Podrobnosti jsou ve výpisu výše.", file=sys.stderr)
            return 1
        print("\nLLMLab: http://127.0.0.1:3000", flush=True)
        print("API: http://127.0.0.1:8000/docs", flush=True)
        print("Ollama musí běžet samostatně. Ukončení: Ctrl+C.\n", flush=True)
        while api.poll() is None and web.poll() is None:
            time.sleep(0.5)
        return 1
    except KeyboardInterrupt:
        return 0
    finally:
        if web is not None:
            stop(web)
        stop(api)


if __name__ == "__main__":
    raise SystemExit(main())
