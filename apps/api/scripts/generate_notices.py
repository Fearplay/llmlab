"""Bundle the exact license and NOTICE files from the installed API environment."""

from __future__ import annotations

import argparse
from importlib.metadata import distributions
from pathlib import Path


def supplemental_root() -> Path:
    source = Path(__file__).resolve()
    return next(
        parent / "licenses"
        for parent in source.parents
        if (parent / "licenses" / "GPL-3.0.txt").is_file()
    )


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
    has_psycopg_binary = False
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
                if file.name.lower().startswith(
                    (
                        "license",
                        "licence",
                        "copying",
                        "copyright",
                        "notice",
                        "ofl",
                        "third-party",
                        "third_party",
                    )
                )
            ),
            key=str,
        )
        if not files:
            raise RuntimeError(f"No installed license file for {name}=={dist.version}")
        has_lgpl |= "LGPL-3.0" in license_name
        if name.lower().replace("_", "-") == "psycopg-binary":
            if dist.version != "3.3.5":
                raise RuntimeError("Update the psycopg-binary native notices for this version")
            has_psycopg_binary = True
        packages.append((name, dist.version, license_name, dist, files))

    for name, version, license_name, dist, files in sorted(
        packages, key=lambda item: item[0].lower()
    ):
        sections.append(f"\n{'=' * 76}\n{name}=={version} — {license_name}\n{'=' * 76}")
        for url in dist.metadata.get_all("Project-URL", []):
            sections.append(f"Project URL: {url}")
        if homepage := dist.metadata.get("Home-page"):
            sections.append(f"Homepage: {homepage}")
        if author := dist.metadata.get("Author-email") or dist.metadata.get("Author"):
            sections.append(f"Package author: {author}")
        for file in files:
            contents = Path(dist.locate_file(file)).read_text(encoding="utf-8", errors="replace")
            sections.append(f"\n--- {file} ---\n{contents.rstrip()}\n")

    if has_lgpl:
        # The API Docker build context contains scripts/licenses; the repository
        # also has copies at its root.
        license_root = supplemental_root()
        for filename in ("LGPL-3.0.txt", "GPL-3.0.txt"):
            contents = (license_root / filename).read_text(encoding="utf-8").rstrip()
            sections.append(f"\n--- {filename} ---\n{contents}\n")

    if has_psycopg_binary:
        license_root = supplemental_root()
        sections.append(
            "\nPsycopg-binary native dependency supplements\n"
            "The binary distribution bundles the PostgreSQL libpq client and OpenSSL.\n"
            "Their upstream copyright and license texts are reproduced below.\n"
            "Snapshots: PostgreSQL 18.4 and OpenSSL 3.6.3 (Windows x64 audit).\n"
            "Native versions and additional libraries vary between wheels/platforms.\n"
            "Psycopg source/build recipes: https://github.com/psycopg/psycopg/tree/3.3.5\n"
            "PostgreSQL source: https://www.postgresql.org/ftp/source/\n"
            "OpenSSL source: https://github.com/openssl/openssl\n"
        )
        for filename in (
            "postgresql-18.4-COPYRIGHT.txt",
            "openssl-3.6.3-copyright-header.txt",
            "openssl-3.6.3-LICENSE.txt",
        ):
            contents = (license_root / filename).read_text(encoding="utf-8").rstrip()
            sections.append(f"\n--- {filename} ---\n{contents}\n")

    args.output.write_text("\n".join(sections) + "\n", encoding="utf-8")
    print(f"Wrote {len(packages)} Python package notices to {args.output}")


if __name__ == "__main__":
    main()
