from pathlib import Path


def _read_reference(path: Path) -> str:
    if path.suffix.lower() != ".pdf":
        return path.read_text(encoding="utf-8").strip()
    try:
        from pypdf import PdfReader
        return "\n".join(page.extract_text() or "" for page in PdfReader(str(path)).pages).strip()
    except (ImportError, OSError, ValueError):
        return ""


def load_prompt_context(source_dir: str | Path, guidelines_dir: str | Path, max_chars: int = 50000, examples_dir: str | Path | None = None) -> str:
    """Load verified résumé sources and writing guidance into one labelled context."""
    sections: list[str] = []
    roots = (Path(guidelines_dir), Path(examples_dir) if examples_dir else None, Path(source_dir))
    for root in roots:
        if root is None or not root.exists():
            continue
        paths = sorted(path for path in root.rglob("*") if path.suffix.lower() in {".md", ".txt", ".markdown", ".pdf"})
        if root == Path(source_dir):
            canonical = [path for path in paths if path.name.lower() == "master resume.md"]
            # The master resume is the authoritative career record. Supporting
            # resumes are retained as context but cannot override it.
            paths = canonical + [path for path in paths if path not in canonical]
        for path in paths:
            text = _read_reference(path)
            if text:
                label = "Source of truth" if root == Path(source_dir) else root.name
                sections.append(f"\n--- {label}/{path.relative_to(root)} ---\n{text}")
    context = "\n".join(sections)
    return ("GENERATION RULE: Use every file in Source of truth/ as the factual data set for the candidate's career. "
        "Use every file in Guidelines/ and its Examples/ as instructions and references for constructing the resume "
        "and cover letter: formatting, structure, tone, wording, tailoring, and presentation. "
        "Guidelines control presentation; Source of truth controls facts. Never invent a fact.\n"
        + context)[:max_chars]
