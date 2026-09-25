"""Bundle the exact license and NOTICE files from the installed API environment."""

from __future__ import annotations

import argparse
from importlib.metadata import distributions
from pathlib import Path


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", required=True, type=Path)
    args = parser.parse_args()

    sections = [
        "LLMLab API installed dependency notices",
        "Generated from this Python environment; optional extras and platforms vary by build.",
        "The LLMLab source code is licensed separately under the project LICENSE file.",
    ]
    packages = []
    has_lgpl = False
    for dist in distributions():
        name = dist.metadata.get("Name", "")
        if name.lower().replace("_", "-") == "llmlab-api":
            continue
        license_name = (
            dist.metadata.get("License-Expression") or dist.metadata.get("License") or "See text"
        )
        files = sorted(
            (
                file
                for file in (dist.files or [])
                if file.name.lower().startswith(("license", "licence", "copying", "notice", "ofl"))
            ),
            key=str,
        )
        if not files:
            raise RuntimeError(f"No installed license file for {name}=={dist.version}")
        has_lgpl |= "LGPL-3.0" in license_name
        packages.append((name, dist.version, license_name, dist, files))

    for name, version, license_name, dist, files in sorted(
        packages, key=lambda item: item[0].lower()
    ):
        sections.append(f"\n{'=' * 76}\n{name}=={version} — {license_name}\n{'=' * 76}")
        for file in files:
            contents = Path(dist.locate_file(file)).read_text(encoding="utf-8", errors="replace")
            sections.append(f"\n--- {file} ---\n{contents.rstrip()}\n")

    if has_lgpl:
        source = Path(__file__).resolve()
        # The API Docker build context contains scripts/licenses; the repository
        # also has copies at its root.
        license_root = next(
            parent / "licenses"
            for parent in source.parents
            if (parent / "licenses" / "GPL-3.0.txt").is_file()
        )
        for filename in ("LGPL-3.0.txt", "GPL-3.0.txt"):
            contents = (license_root / filename).read_text(encoding="utf-8").rstrip()
            sections.append(f"\n--- {filename} ---\n{contents}\n")

    args.output.write_text("\n".join(sections) + "\n", encoding="utf-8")
    print(f"Wrote {len(packages)} Python package notices to {args.output}")


if __name__ == "__main__":
    main()
