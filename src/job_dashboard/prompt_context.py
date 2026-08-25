from pathlib import Path


def load_prompt_context(source_dir: str | Path, guidelines_dir: str | Path, max_chars: int = 50000) -> str:
    """Load verified résumé sources and writing guidance into one labelled context."""
    sections: list[str] = []
    roots = (Path(guidelines_dir), Path(source_dir))
    for root in roots:
        if not root.exists():
            continue
        paths = sorted(root.rglob("*.md"))
        if root == Path(source_dir):
            canonical = [path for path in paths if path.name.lower() == "master resume.md"]
            # The master resume is the authoritative career record. Supporting
            # resumes are retained as context but cannot override it.
            paths = canonical + [path for path in paths if path not in canonical]
        for path in paths:
            text = path.read_text(encoding="utf-8").strip()
            if text:
                label = "Source of truth" if root == Path(source_dir) else root.name
                sections.append(f"\n--- {label}/{path.relative_to(root)} ---\n{text}")
    context = "\n".join(sections)
    return ("AUTHORITATIVE SOURCE RULE: Master Resume.md is the canonical source of career facts. "
        "Use other source files only to clarify formatting; never introduce a fact absent from the Master Resume.\n"
        + context)[:max_chars]
