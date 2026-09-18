import argparse
import json
from pathlib import Path
from typing import Any

import httpx
import yaml


def main() -> None:
    parser = argparse.ArgumentParser(prog="llmlab")
    parser.add_argument("--api", default="http://localhost:8000/api/v1")
    subparsers = parser.add_subparsers(dest="command", required=True)
    subparsers.add_parser("providers")
    run_parser = subparsers.add_parser("run")
    run_parser.add_argument("config", type=Path)
    args = parser.parse_args()
    if args.command == "providers":
        result: Any = httpx.get(f"{args.api}/providers", timeout=10).json()
    else:
        config = yaml.safe_load(args.config.read_text(encoding="utf-8"))
        if config.get("schema_version") != 1:
            raise SystemExit("Only schema_version: 1 is supported")
        result = httpx.post(f"{args.api}/runs", json=config["run"], timeout=30).json()
    print(json.dumps(result, indent=2, ensure_ascii=False))
