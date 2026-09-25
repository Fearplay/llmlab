from __future__ import annotations

import hashlib
import re
from dataclasses import asdict, dataclass
from pathlib import Path

DISCLAIMER = (
    "This is a synthetic demonstration document for the fictional organisation "
    "Atlas Works. It is not a real law, contract or commercial policy."
)
_FRONT_MATTER = re.compile(r"\A---\s*\n(.*?)\n---\s*\n", re.DOTALL)
_LINK = re.compile(r"\[\[(ATLAS-[A-Z0-9-]+)\]\]")
_RULE = re.compile(r"<!--\s*rule:([a-z0-9_.-]+)=([^>]+?)\s*-->", re.IGNORECASE)


@dataclass(frozen=True)
class KnowledgeDocument:
    document_id: str
    title: str
    version: str
    effective_date: str
    language: str
    audience: str
    status: str
    synthetic: bool
    path: str
    absolute_path: Path
    body: str
    retrieval_role: str = "primary"

    def public_metadata(self) -> dict[str, str | bool]:
        data = asdict(self)
        data.pop("absolute_path")
        data.pop("body")
        return data


def repository_root() -> Path:
    return Path(__file__).resolve().parents[3]


def resolve_corpus_dir(value: str) -> Path:
    root = repository_root().resolve()
    candidate = (root / value).resolve() if not Path(value).is_absolute() else Path(value).resolve()
    if candidate != root and root not in candidate.parents:
        raise ValueError("Knowledge directory must stay inside the repository")
    return candidate


def load_documents(corpus_dir: Path) -> list[KnowledgeDocument]:
    corpus_dir = corpus_dir.resolve()
    if not corpus_dir.is_dir():
        raise ValueError(f"Knowledge directory does not exist: {corpus_dir}")
    documents: list[KnowledgeDocument] = []
    for path in sorted(corpus_dir.glob("*.md")):
        if path.name.casefold() == "readme.md" or path.is_symlink():
            continue
        resolved = path.resolve()
        if corpus_dir not in resolved.parents:
            raise ValueError(f"Knowledge path escapes corpus: {path}")
        raw = path.read_text(encoding="utf-8")
        match = _FRONT_MATTER.match(raw)
        if not match:
            raise ValueError(f"Missing YAML front matter: {path.name}")
        metadata = _parse_front_matter(match.group(1), path)
        body = raw[match.end() :].strip()
        required = {
            "document_id",
            "title",
            "version",
            "effective_date",
            "language",
            "audience",
            "status",
            "synthetic",
        }
        missing = sorted(required - metadata.keys())
        if missing:
            raise ValueError(f"Missing metadata in {path.name}: {', '.join(missing)}")
        if metadata["synthetic"].casefold() != "true":
            raise ValueError(f"Document must declare synthetic: true: {path.name}")
        if metadata["language"] != "en":
            raise ValueError(f"Atlas Works corpus must be English: {path.name}")
        retrieval_role = metadata.get("retrieval_role", "primary")
        if retrieval_role not in {"primary", "secondary"}:
            raise ValueError(f"Invalid retrieval_role in {path.name}: {retrieval_role}")
        if DISCLAIMER not in body:
            raise ValueError(f"Synthetic disclaimer is missing: {path.name}")
        documents.append(
            KnowledgeDocument(
                document_id=metadata["document_id"],
                title=metadata["title"],
                version=metadata["version"],
                effective_date=metadata["effective_date"],
                language=metadata["language"],
                audience=metadata["audience"],
                status=metadata["status"],
                synthetic=True,
                path=resolved.relative_to(repository_root()).as_posix(),
                absolute_path=resolved,
                body=body,
                retrieval_role=retrieval_role,
            )
        )
    validate_documents(documents)
    return documents


def validate_documents(documents: list[KnowledgeDocument]) -> None:
    if not documents:
        raise ValueError("Knowledge corpus is empty")
    ids = [document.document_id for document in documents]
    if len(ids) != len(set(ids)):
        duplicates = sorted({item for item in ids if ids.count(item) > 1})
        raise ValueError(f"Duplicate document IDs: {', '.join(duplicates)}")
    known = set(ids)
    rules: dict[str, str] = {}
    for document in documents:
        missing_links = sorted(set(_LINK.findall(document.body)) - known)
        if missing_links:
            raise ValueError(
                f"Broken document links in {document.path}: {', '.join(missing_links)}"
            )
        if document.status != "active":
            continue
        for key, raw_value in _RULE.findall(document.body):
            value = raw_value.strip()
            if key in rules and rules[key] != value:
                raise ValueError(f"Contradictory active rule {key}: {rules[key]} vs {value}")
            rules[key] = value


def corpus_fingerprint(
    documents: list[KnowledgeDocument], model_id: str, target_tokens: int, overlap_tokens: int
) -> str:
    digest = hashlib.sha256()
    digest.update(f"rag-index-v3|{model_id}|{target_tokens}|{overlap_tokens}".encode())
    for document in documents:
        digest.update(document.path.encode())
        digest.update(document.absolute_path.read_bytes())
    return f"sha256:{digest.hexdigest()}"


def _parse_front_matter(value: str, path: Path) -> dict[str, str]:
    result: dict[str, str] = {}
    for line in value.splitlines():
        if not line.strip() or line.lstrip().startswith("#"):
            continue
        key, separator, raw = line.partition(":")
        if not separator:
            raise ValueError(f"Invalid front matter line in {path.name}: {line}")
        result[key.strip()] = raw.strip().strip("\"'")
    return result
