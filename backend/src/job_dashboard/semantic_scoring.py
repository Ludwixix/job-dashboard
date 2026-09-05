"""semantic_scoring.py.

Lightweight, zero-dependency semantic vector similarity and hybrid scoring engine.
Augments deterministic rule-based keyword scoring with sub-word/n-gram vector cosine
similarity and optional hosted embedding vector support.
"""

from __future__ import annotations

import math
import re
from collections import Counter
from collections.abc import Mapping, Sequence
from typing import Any

from .logging import get_logger
from .models import Job, ScoreResult
from .score import score_job

logger = get_logger("job_dashboard.semantic_scoring")


def cosine_similarity(
    vec_a: Mapping[str, float] | Sequence[float],
    vec_b: Mapping[str, float] | Sequence[float],
) -> float:
    """Calculate the cosine similarity between two sparse vector mappings or dense vector lists.

    Returns a normalized value between 0.0 and 1.0.
    """
    if isinstance(vec_a, Sequence) and isinstance(vec_b, Sequence):
        if len(vec_a) != len(vec_b) or not vec_a:
            return 0.0
        dot_product = sum(a * b for a, b in zip(vec_a, vec_b, strict=False))
        norm_a = math.sqrt(sum(a * a for a in vec_a))
        norm_b = math.sqrt(sum(b * b for b in vec_b))
        if norm_a <= 0.0 or norm_b <= 0.0:
            return 0.0
        sim = dot_product / (norm_a * norm_b)
        return max(0.0, min(1.0, float(sim)))

    if isinstance(vec_a, Mapping) and isinstance(vec_b, Mapping):
        common_keys = set(vec_a.keys()) & set(vec_b.keys())
        if not common_keys:
            return 0.0
        dot_product = sum(vec_a[k] * vec_b[k] for k in common_keys)
        norm_a = math.sqrt(sum(v * v for v in vec_a.values()))
        norm_b = math.sqrt(sum(v * v for v in vec_b.values()))
        if norm_a <= 0.0 or norm_b <= 0.0:
            return 0.0
        sim = dot_product / (norm_a * norm_b)
        return max(0.0, min(1.0, float(sim)))

    return 0.0


def extract_profile_semantic_corpus(profile: Mapping[str, Any]) -> str:
    """Extract a rich text corpus from a candidate profile mapping.

    Extracts headline, archetype, bio, core skills, key strengths, and target roles.
    """
    sections: list[str] = []

    # Unnest if wrapped in {"profile": {...}}
    if "profile" in profile and isinstance(profile["profile"], Mapping):
        profile = profile["profile"]

    for field_name in ("headline", "marketArchetype", "summary", "bio", "seniorityLevel"):
        val = profile.get(field_name)
        if val and isinstance(val, str):
            sections.append(val)

    # Core skills (lists or mappings)
    core_skills = profile.get("coreSkills", []) or []
    if isinstance(core_skills, list):
        sections.extend(str(s) for s in core_skills if s)

    skills_dict = profile.get("skills", {}) or {}
    if isinstance(skills_dict, Mapping):
        sections.extend(f"{k} {v}" for k, v in skills_dict.items() if k)
    elif isinstance(skills_dict, list):
        sections.extend(str(s) for s in skills_dict if s)

    tech_exp = profile.get("technical_expertise", {}) or {}
    if isinstance(tech_exp, Mapping):
        for group in tech_exp.values():
            if isinstance(group, list):
                sections.extend(str(s) for s in group if s)

    strengths = profile.get("keyStrengths", []) or []
    if isinstance(strengths, list):
        sections.extend(str(s) for s in strengths if s)

    target_titles = profile.get("targetTitles", []) or []
    if isinstance(target_titles, list):
        sections.extend(str(t) for t in target_titles if t)

    return " ".join(sections)


def tokenize_subwords(text: str) -> list[str]:
    """Tokenize text into lowercase alphanumeric words plus 3-character to 5-character n-grams.

    Captures stems and morphological variants without requiring heavy external lemmatizers.
    """
    clean = re.sub(r"[^\w\s-]", " ", text.lower())
    words = [w.strip() for w in clean.split() if len(w.strip()) >= 2]

    tokens: list[str] = list(words)
    for word in words:
        if len(word) >= 4:
            # Add character n-grams (length 3 and 4)
            for n in (3, 4):
                if len(word) >= n:
                    for i in range(len(word) - n + 1):
                        tokens.append(f"_{word[i:i+n]}_")
    return tokens


def compute_subword_tfidf_vector(text: str) -> dict[str, float]:
    """Compute normalized sub-linear term frequency representation for a text corpus."""
    tokens = tokenize_subwords(text)
    if not tokens:
        return {}

    counts = Counter(tokens)
    # Sub-linear term frequency: 1 + log(tf)
    vector: dict[str, float] = {}
    for term, count in counts.items():
        vector[term] = 1.0 + math.log(count)

    # Unit norm
    norm = math.sqrt(sum(v * v for v in vector.values()))
    if norm > 0.0:
        for term in vector:
            vector[term] /= norm

    return vector


def compute_semantic_similarity(profile: Mapping[str, Any], job: Job) -> float:
    """Compute semantic vector similarity between candidate profile and a Job posting.

    Returns float in range [0.0, 1.0].
    """
    try:
        profile_corpus = extract_profile_semantic_corpus(profile)
        job_corpus = job.text()

        if not profile_corpus.strip() or not job_corpus.strip():
            return 0.0

        vec_profile = compute_subword_tfidf_vector(profile_corpus)
        vec_job = compute_subword_tfidf_vector(job_corpus)

        return cosine_similarity(vec_profile, vec_job)
    except Exception as e:
        logger.warning(f"Error computing semantic similarity for job {job.id}: {e}")
        return 0.0


def score_job_hybrid(
    job: Job,
    profile: Mapping[str, Any],
    semantic_weight: float = 0.25,
) -> ScoreResult:
    """Calculate a hybrid score blending deterministic rule-based evaluation with vector similarity.

    Args:
        job: Job object to score.
        profile: Candidate profile mapping.
        semantic_weight: Weight allocated to semantic vector similarity (default 0.25 = 25%).
                         Deterministic rules retain 75% weight.

    Returns:
        ScoreResult with blended score, semantic_score, rule_score, and updated dimensions.
    """
    base_result = score_job(job, profile)

    try:
        # Clamp weight between 0.0 and 0.5 to prevent semantic drift over hard rule filters
        weight = max(0.0, min(0.5, float(semantic_weight)))
        if weight <= 0.0:
            return base_result

        sim = compute_semantic_similarity(profile, job)
        sim_percentage = round(sim * 100)

        # Blend rule score and semantic score
        rule_score = base_result.score
        blended_score = round((rule_score * (1.0 - weight)) + (sim_percentage * weight))
        blended_score = max(0, min(100, blended_score))

        # Update dimensions and breakdown with semantic metric
        new_dimensions = dict(base_result.dimensions)
        new_dimensions["semantic_similarity"] = sim_percentage

        new_breakdown = dict(base_result.score_breakdown)
        new_breakdown["semantic_similarity"] = sim_percentage
        new_breakdown["rule_score"] = rule_score

        # Update fit label if score category shifts
        new_fit = (
            "No skill match"
            if not base_result.matched_skills
            else "Excellent fit"
            if blended_score >= 85
            else "Strong fit"
            if blended_score >= 70
            else "Good fit"
            if blended_score >= 55
            else "Partial fit"
        )

        return ScoreResult(
            score=blended_score,
            fit=new_fit,
            dimensions=new_dimensions,
            matched_skills=base_result.matched_skills,
            missing_skills=base_result.missing_skills,
            strengths=base_result.strengths,
            risks=base_result.risks,
            confidence=base_result.confidence,
            experience_level=base_result.experience_level,
            relevance=base_result.relevance,
            score_breakdown=new_breakdown,
            semantic_score=round(sim, 4),
            rule_score=rule_score,
        )
    except Exception as e:
        logger.warning(f"Hybrid scoring fallback to deterministic result for {job.id}: {e}")
        return base_result
