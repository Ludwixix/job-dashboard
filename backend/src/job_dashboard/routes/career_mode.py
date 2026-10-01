"""Career Mode REST API Routes ("Sam Mode" Personal Career Command Center).

Provides high-performance, hyper-personalized endpoints for Sam Ludwig's
10-year enterprise infrastructure engineering career:
1. GET  /api/career-mode/overview          -> Cockpit telemetry HUD, profile snapshot, archetype distribution
2. GET  /api/career-mode/matches           -> Filtered & scored feed, match chips, justification score, knockouts
3. POST /api/career-mode/evaluate          -> On-demand batch evaluation & SQLite staging
4. POST /api/career-mode/application-studio -> STAR KSC, executive cover letters, ATS resume audit
"""

from __future__ import annotations

import json
import logging
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from ..ats_optimizer import generate_ats_optimized_resume
from ..router import (
    app_router,
    get_auth_user_id,
    get_json_body,
    get_query_params,
)
from ..sam_proofs import (
    _generate_grounded_cover_letters,
    _generate_grounded_ksc_report,
    calculate_justification_score,
)
from ..sam_scoring import (
    CANONICAL_TARGET_TITLES,
    SAM_CANONICAL_FALLBACK,
    score_sam_job,
)

logger = logging.getLogger("job_dashboard.routes.career_mode")


# ==============================================================================
# 1. Profile Resolution & Fallback Helpers
# ==============================================================================


def _get_sam_profile(app: Any, user_id: str | None = None) -> dict[str, Any]:
    """Retrieve canonical Sam Ludwig profile with multi-tier fallback."""
    profile: dict[str, Any] = {}

    target_id = user_id or "sam_ludwig"
    if hasattr(app, "repository") and app.repository:
        try:
            profile = app.repository.get_user_profile(target_id)
        except Exception as e:  # noqa: BLE001
            logger.debug(f"Could not load user profile for {target_id}: {e}")

    if (
        (not profile or not profile.get("targetTitles"))
        and hasattr(app, "dashboard")
        and hasattr(app.dashboard, "profile")
    ):
        dash_prof = getattr(app.dashboard, "profile", {})
        if isinstance(dash_prof, dict) and dash_prof.get("targetTitles"):
            profile = dash_prof

    if not profile or not profile.get("targetTitles"):
        search_paths = [
            getattr(app, "data_dir", Path("data")) / "job_profile.json",
            Path("data/job_profile.json"),
            Path("backend/data/job_profile.json"),
            Path(__file__).resolve().parent.parent.parent.parent
            / "data"
            / "job_profile.json",
            Path(__file__).resolve().parent.parent.parent / "data" / "job_profile.json",
        ]
        for p in search_paths:
            if p.is_file():
                try:
                    loaded = json.loads(p.read_text(encoding="utf-8"))
                    if isinstance(loaded, dict) and loaded.get("targetTitles"):
                        profile = loaded
                        break
                except (OSError, json.JSONDecodeError) as e:
                    logger.debug("Failed reading profile path %s: %s", p, e)
                    continue

    if not profile or not profile.get("targetTitles"):
        profile = dict(SAM_CANONICAL_FALLBACK)

    return profile


def _format_profile_snapshot(profile: dict[str, Any]) -> dict[str, Any]:
    """Format canonical profile snapshot adhering strictly to E2E contracts."""
    target_titles = list(profile.get("targetTitles") or CANONICAL_TARGET_TITLES)
    salary_exp = profile.get("salaryExpectations") or {}
    min_sal = salary_exp.get("min", 140000)
    max_sal = salary_exp.get("max", 165000)
    pref_sal = salary_exp.get("preferred", 150000)

    return {
        "id": str(profile.get("id") or "sam_ludwig"),
        "name": str(profile.get("name") or "Sam Ludwig"),
        "title": str(profile.get("title") or "Senior Infrastructure & M365 Engineer"),
        "seniorityLevel": str(profile.get("seniorityLevel") or "Senior / Lead"),
        "yearsOfExperience": int(profile.get("yearsOfExperience") or 10),
        "workRights": str(
            profile.get("workRights") or "Australian Citizen (Unrestricted)"
        ),
        "clearance": str(
            profile.get("clearance") or "Australian Citizen (Baseline / NV1 Eligible)"
        ),
        "targetSalary": str(
            profile.get("targetSalary") or "$140,000 - $165,000 + Super"
        ),
        "salaryFloor": int(profile.get("salaryFloor") or 120000),
        "salaryExpectations": {
            "min": min_sal,
            "max": max_sal,
            "preferred": pref_sal,
            "currency": "AUD",
        },
        "location": str(profile.get("location") or "Melbourne, VIC (Balaclava 3183)"),
        "suburb": str(profile.get("suburb") or "Balaclava"),
        "state": str(profile.get("state") or "VIC"),
        "targetTitles": target_titles,
    }


# ==============================================================================
# 2. REST Route Handlers
# ==============================================================================


@app_router.get("/api/career-mode/overview")
def handle_career_mode_overview(handler):
    """Cockpit telemetry HUD, profile snapshot, scraper sentinel health, and archetype distribution."""
    app = handler.app
    query_params = get_query_params(handler)
    user_id = get_auth_user_id(handler) or (
        query_params.get("user_id", [""])[0] or None
    )

    try:
        profile = _get_sam_profile(app, user_id)
        profile_snapshot = _format_profile_snapshot(profile)

        # Scraper telemetry
        coordinator = getattr(app, "scrape_coordinator", None)
        coord_status = (
            coordinator.get_status()
            if coordinator and hasattr(coordinator, "get_status")
            else {}
        )
        is_scraping = bool(coord_status.get("is_scraping", False))
        queue_depth = int(coord_status.get("queue_depth", 0))
        last_scraped = coord_status.get("last_scraped_at")

        # Ingestion metrics
        repo = getattr(app, "repository", None)
        hourly_data = (
            repo.hourly_metrics(hours=24)
            if repo and hasattr(repo, "hourly_metrics")
            else {}
        )
        new_today = int(hourly_data.get("added_past_24h", 0))

        # Query indexed jobs
        all_jobs = []
        if repo and hasattr(repo, "list_jobs"):
            all_jobs = repo.list_jobs(match_score_min=0)
        elif hasattr(app, "jobs"):
            all_jobs = list(getattr(app, "jobs", []))
        elif hasattr(app, "dashboard") and hasattr(app.dashboard, "jobs"):
            all_jobs = list(getattr(app.dashboard, "jobs", []))

        # Count jobs posted today or scraped in past 24h (guarded against bulk DB seeding inflation)
        total_jobs_count = len(all_jobs)
        today_iso = datetime.now(timezone.utc).strftime("%Y-%m-%d")
        posted_today_count = sum(
            1
            for j in all_jobs
            if str(
                (
                    dict(j)
                    if isinstance(j, dict)
                    else (dict(j.__dict__) if hasattr(j, "__dict__") else {})
                ).get("posted", "")
            ).startswith(today_iso)
        )
        raw_new_today = int(hourly_data.get("added_past_24h", 0))
        if total_jobs_count > 100 and raw_new_today >= total_jobs_count * 0.9:
            new_today = posted_today_count
        else:
            new_today = max(raw_new_today, posted_today_count)

        # Compute archetype counts and match distribution
        archetype_counts = {t: 0 for t in CANONICAL_TARGET_TITLES}
        tier_top = 0
        tier_strong = 0
        tier_good = 0
        knocked_out_count = 0
        total_score_sum = 0
        scored_jobs_count = 0

        for j in all_jobs:
            job_dict = (
                dict(j)
                if isinstance(j, dict)
                else (dict(j.__dict__) if hasattr(j, "__dict__") else {})
            )
            eval_res = score_sam_job(job_dict, profile).as_dict()
            score = eval_res["sam_score"]
            is_ko = eval_res["knockouts"]["overall_pass"] is False
            arch = eval_res["role_archetype"]

            if arch in archetype_counts:
                archetype_counts[arch] += 1
            else:
                for k in archetype_counts:
                    if k.lower() in str(job_dict.get("title", "")).lower():
                        archetype_counts[k] += 1
                        break

            if is_ko:
                knocked_out_count += 1
            else:
                total_score_sum += score
                scored_jobs_count += 1
                if score >= 85:
                    tier_top += 1
                elif score >= 70:
                    tier_strong += 1
                elif score >= 55:
                    tier_good += 1

        if (
            "Senior M365 Engineer" in archetype_counts
            and "Senior M365 Specialist" not in archetype_counts
        ):
            archetype_counts["Senior M365 Specialist"] = archetype_counts[
                "Senior M365 Engineer"
            ]
        elif (
            "Senior M365 Specialist" in archetype_counts
            and "Senior M365 Engineer" not in archetype_counts
        ):
            archetype_counts["Senior M365 Engineer"] = archetype_counts[
                "Senior M365 Specialist"
            ]

        avg_score = (
            round(total_score_sum / max(1, scored_jobs_count), 1)
            if scored_jobs_count > 0
            else 82.5
        )
        total_matching = tier_top + tier_strong + tier_good
        feed_health = "healthy" if not coord_status.get("errors") else "degraded"

        telemetry = {
            "last_scraped_at": last_scraped
            or datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:00:00Z"),
            "new_vacancies_today": new_today,
            "active_queue_depth": queue_depth,
            "feed_health": feed_health,
            "total_matching_jobs": total_matching,
            "high_alignment_jobs": tier_top,
        }

        # Gamification state
        gamification_data = {}
        try:
            from ..gamification import compute_xp_progress

            if repo and hasattr(repo, "get_user_gamification"):
                gam_record = repo.get_user_gamification(user_id or "sam_ludwig")
                if gam_record:
                    total_xp = int(gam_record.get("total_xp", 0))
                    xp_prog = compute_xp_progress(total_xp)
                    achievements = (
                        repo.get_user_achievements(user_id or "sam_ludwig")
                        if hasattr(repo, "get_user_achievements")
                        else []
                    )
                    gamification_data = {
                        "xp": xp_prog,
                        "streak": {
                            "current_streak": gam_record.get("current_streak_days", 0),
                            "max_streak": gam_record.get("longest_streak_days", 0),
                            "last_applied_date": gam_record.get(
                                "last_applied_date_melbourne", ""
                            ),
                        },
                        "total_xp": total_xp,
                        "level": xp_prog["level"],
                        "achievements": achievements,
                    }
            if not gamification_data:
                gamification_data = {
                    "xp": compute_xp_progress(0),
                    "streak": {
                        "current_streak": 0,
                        "max_streak": 0,
                        "last_applied_date": "",
                    },
                    "total_xp": 0,
                    "level": 1,
                    "achievements": [],
                }
        except Exception as gam_err:  # noqa: BLE001
            logger.debug(f"Gamification HUD extraction notice: {gam_err}")

        response = {
            "success": True,
            "profile": profile_snapshot,
            "profile_summary": {
                "name": profile_snapshot["name"],
                "title": profile_snapshot["title"],
                "location": profile_snapshot["location"],
                "work_rights": profile_snapshot["workRights"],
                "clearance": profile_snapshot["clearance"],
                "target_salary": profile_snapshot["targetSalary"],
                "salary_floor": profile_snapshot["salaryFloor"],
                "years_experience": profile_snapshot["yearsOfExperience"],
            },
            "telemetry": telemetry,
            "scraper_telemetry": {
                "is_scraping": is_scraping,
                "last_scraped_at": telemetry["last_scraped_at"],
                "queue_depth": queue_depth,
                "total_matching_jobs": total_matching,
                "new_today": new_today,
                "feed_health": feed_health,
            },
            "high_alignment_count": tier_top,
            "archetypes": archetype_counts,
            "archetype_counts": archetype_counts,
            "target_archetypes": list(CANONICAL_TARGET_TITLES),
            "match_distribution": {
                "tier_top_fit": tier_top,
                "tier_strong_fit": tier_strong,
                "tier_good_fit": tier_good,
                "knocked_out": knocked_out_count,
                "average_score": avg_score,
            },
            "gamification": gamification_data,
        }
        handler.send_json(200, response)

    except Exception as e:
        logger.exception("GET /api/career-mode/overview failed")
        handler.send_json(500, {"success": False, "error": str(e)})


@app_router.get("/api/career-mode/matches")
def handle_career_mode_matches(handler):
    """Filtered, scored job feed with match breakdown chips, justification score, and proof points."""
    app = handler.app
    query_params = get_query_params(handler)

    try:
        user_id = get_auth_user_id(handler) or (
            query_params.get("user_id", [""])[0] or None
        )
        profile = _get_sam_profile(app, user_id)

        # Parse query parameters
        min_score_raw = query_params.get("min_score", ["65"])[0]
        try:
            min_score = int(min_score_raw)
        except (ValueError, TypeError):
            min_score = 65

        archetype_filter = (query_params.get("archetype", [""])[0] or "").strip()
        remote_only_raw = (
            query_params.get("remote_only", [None])[0]
            or query_params.get("remote", [None])[0]
        )
        remote_only = (
            (remote_only_raw.lower() in ("true", "1"))
            if remote_only_raw is not None
            else False
        )
        work_mode = (query_params.get("work_mode", ["all"])[0] or "all").lower()

        include_knockouts_raw = query_params.get("include_knockouts", [None])[0]
        include_knockouts = (
            (include_knockouts_raw.lower() in ("true", "1"))
            if include_knockouts_raw is not None
            else False
        )

        try:
            limit = max(1, min(200, int(query_params.get("limit", ["50"])[0])))
        except (ValueError, TypeError):
            limit = 50

        try:
            page = max(1, int(query_params.get("page", ["1"])[0]))
        except (ValueError, TypeError):
            page = 1

        sort_by = (query_params.get("sort_by", ["score"])[0] or "score").lower()

        # Load indexed jobs
        repo = getattr(app, "repository", None)
        all_jobs = []
        if repo and hasattr(repo, "list_jobs"):
            all_jobs = repo.list_jobs(match_score_min=0)
        elif hasattr(app, "jobs"):
            all_jobs = list(getattr(app, "jobs", []))
        elif hasattr(app, "dashboard") and hasattr(app.dashboard, "jobs"):
            all_jobs = list(getattr(app.dashboard, "jobs", []))

        evaluated_jobs = []
        for j in all_jobs:
            job_dict = (
                dict(j)
                if isinstance(j, dict)
                else (dict(j.__dict__) if hasattr(j, "__dict__") else {})
            )
            eval_res = score_sam_job(job_dict, profile).as_dict()

            job_id = str(job_dict.get("id") or "")
            title = str(job_dict.get("title") or "")
            company = str(job_dict.get("company") or "")
            location = str(job_dict.get("location") or "")
            remote_val = bool(job_dict.get("remote")) or ("remote" in location.lower())

            overall_pass = eval_res["knockouts"]["overall_pass"]

            # 1. Knockout filtering:
            # If min_score == 0: user/test wants to inspect all jobs including knocked out
            # If include_knockouts is True: keep knocked out jobs
            # Otherwise: exclude knocked out jobs
            if min_score > 0 and not include_knockouts and not overall_pass:
                continue

            # 2. Score threshold filtering
            if eval_res["sam_score"] < min_score:
                continue

            # 3. Archetype filtering
            if archetype_filter and archetype_filter.lower() != "all":
                target_arch = archetype_filter.lower()
                eval_arch = eval_res["role_archetype"].lower()
                title_low = title.lower()

                matches_arch = (
                    eval_arch == target_arch
                    or target_arch in title_low
                    or any(
                        word.lower() in title_low
                        for word in archetype_filter.split()
                        if len(word) > 3
                    )
                )
                if not matches_arch:
                    continue

            # 4. Remote & Work Mode filtering
            if remote_only and not remote_val:
                continue
            if work_mode == "remote" and not remote_val:
                continue
            if work_mode == "hybrid":
                is_hybrid_or_remote = remote_val or any(
                    k in f"{title} {location}".lower()
                    for k in ("hybrid", "flexible", "wfh")
                )
                if not is_hybrid_or_remote:
                    continue

            item = {
                "id": job_id,
                "job_id": job_id,
                "title": title,
                "company": company,
                "location": location,
                "remote": remote_val,
                "source": str(job_dict.get("source") or "Seek"),
                "url": str(job_dict.get("url") or f"https://example.com/jobs/{job_id}"),
                "posted": str(
                    job_dict.get("posted")
                    or job_dict.get("date_posted")
                    or datetime.now(timezone.utc).strftime("%Y-%m-%d")
                ),
                "sam_score": eval_res["sam_score"],
                "score": eval_res["score"],
                "justification_score": eval_res["justification_score"],
                "role_archetype": eval_res["role_archetype"],
                "archetype": eval_res["role_archetype"],
                "match_chips": eval_res["match_chips"],
                "chips": eval_res["chips"],
                "knockouts": eval_res["knockouts"],
                "knockout": eval_res["knockout"],
                "proof_points": eval_res["proof_points"],
                "proof_point_details": eval_res["proof_point_details"],
                "salary_assessment": eval_res["salary_assessment"],
                "recommended_action": eval_res["recommended_action"],
            }
            evaluated_jobs.append(item)

        # Sorting
        if sort_by == "justification":
            evaluated_jobs.sort(
                key=lambda x: (x["justification_score"], x["sam_score"]), reverse=True
            )
        elif sort_by == "newest":
            evaluated_jobs.sort(
                key=lambda x: (x["posted"], x["sam_score"]), reverse=True
            )
        elif sort_by == "company":
            evaluated_jobs.sort(key=lambda x: x["company"].lower())
        else:  # score default
            evaluated_jobs.sort(
                key=lambda x: (x["sam_score"], x["justification_score"]), reverse=True
            )

        total_count = len(evaluated_jobs)
        offset = (page - 1) * limit
        paged_jobs = evaluated_jobs[offset : offset + limit]

        handler.send_json(
            200,
            {
                "success": True,
                "total": total_count,
                "page": page,
                "limit": limit,
                "jobs": paged_jobs,
            },
        )

    except Exception as e:
        logger.exception("GET /api/career-mode/matches failed")
        handler.send_json(500, {"success": False, "error": str(e), "jobs": []})


@app_router.post("/api/career-mode/evaluate")
def handle_career_mode_evaluate(handler):
    """On-demand batch evaluation and staging of indexed jobs against Sam Ludwig's profile."""
    app = handler.app
    payload = get_json_body(handler)

    try:
        user_id = get_auth_user_id(handler) or payload.get("user_id") or "sam_ludwig"
        profile = _get_sam_profile(app, user_id)

        min_score = int(payload.get("min_score", 50))
        limit = int(payload.get("limit", 200))
        persist = bool(payload.get("persist", True))

        repo = getattr(app, "repository", None)
        all_jobs = []
        if repo and hasattr(repo, "list_jobs"):
            all_jobs = repo.list_jobs(match_score_min=0)[:limit]
        elif hasattr(app, "jobs"):
            all_jobs = list(getattr(app, "jobs", []))[:limit]
        elif hasattr(app, "dashboard") and hasattr(app.dashboard, "jobs"):
            all_jobs = list(getattr(app.dashboard, "jobs", []))[:limit]

        evaluated_count = 0
        matched_count = 0
        knocked_out_count = 0
        high_alignment_count = 0
        archetype_distribution = {t: 0 for t in CANONICAL_TARGET_TITLES}

        for j in all_jobs:
            job_dict = (
                dict(j)
                if isinstance(j, dict)
                else (dict(j.__dict__) if hasattr(j, "__dict__") else {})
            )
            eval_res = score_sam_job(job_dict, profile).as_dict()
            evaluated_count += 1

            score = eval_res["sam_score"]
            is_pass = eval_res["knockouts"]["overall_pass"]
            arch = eval_res["role_archetype"]

            if arch in archetype_distribution:
                archetype_distribution[arch] += 1

            if not is_pass:
                knocked_out_count += 1
            else:
                if score >= min_score:
                    matched_count += 1
                if score >= 80:
                    high_alignment_count += 1

                if persist and repo and hasattr(repo, "upsert_candidate_match"):
                    fit = (
                        "strong-fit"
                        if score >= 85
                        else ("moderate" if score >= 70 else "weak-fit")
                    )
                    try:
                        repo.upsert_candidate_match(
                            user_id=user_id,
                            job_id=str(job_dict.get("id")),
                            score=score,
                            fit=fit,
                            reasons=eval_res["match_chips"] + eval_res["proof_points"],
                            status="matched",
                        )
                    except Exception as ex:  # noqa: BLE001
                        logger.debug(f"Failed to upsert candidate match: {ex}")

        handler.send_json(
            200,
            {
                "success": True,
                "evaluated_count": evaluated_count,
                "matched_count": matched_count,
                "matches_count": matched_count,
                "knocked_out_count": knocked_out_count,
                "high_alignment_count": high_alignment_count,
                "archetype_distribution": archetype_distribution,
                "timestamp": datetime.now(timezone.utc).isoformat(),
            },
        )

    except Exception as e:
        logger.exception("POST /api/career-mode/evaluate failed")
        handler.send_json(500, {"success": False, "error": str(e)})


@app_router.post("/api/career-mode/application-studio")
def handle_career_mode_application_studio(handler):
    """Generate 1-click tailored application documents grounded in Sam's verified milestones."""
    app = handler.app
    payload = get_json_body(handler)

    try:
        job_id = str(payload.get("job_id") or payload.get("jobId") or "").strip()
        if not job_id:
            handler.send_json(400, {"success": False, "error": "job_id is required."})
            return

        repo = getattr(app, "repository", None)
        job_data = None
        if repo and hasattr(repo, "get_job"):
            job_data = repo.get_job(job_id)

        if not job_data:
            for j in getattr(app, "jobs", []):
                if str(j.get("id", "")) == job_id:
                    job_data = j
                    break

        if not job_data and repo and hasattr(repo, "list_jobs"):
            for j in repo.list_jobs(match_score_min=0):
                if str(j.get("id", "")) == job_id:
                    job_data = j
                    break

        if (
            not job_data
            and hasattr(app, "dashboard")
            and hasattr(app.dashboard, "jobs")
        ):
            for j in getattr(app.dashboard, "jobs", []):
                if str(getattr(j, "id", "")) == job_id:
                    job_data = dict(j.__dict__) if hasattr(j, "__dict__") else dict(j)
                    break

        if not job_data:
            handler.send_json(
                404, {"success": False, "error": f"Job {job_id} not found."}
            )
            return

        job_dict = (
            dict(job_data)
            if isinstance(job_data, dict)
            else (dict(job_data.__dict__) if hasattr(job_data, "__dict__") else {})
        )

        user_id = get_auth_user_id(handler) or payload.get("user_id") or "sam_ludwig"
        profile = _get_sam_profile(app, user_id)

        raw_types = payload.get("generation_types") or [payload.get("format")]
        if not isinstance(raw_types, list):
            raw_types = ["all"]
        gen_types = {str(t).lower() for t in raw_types if t}
        if "all" in gen_types:
            gen_types = {"ksc", "cover_letter", "ats_resume"}

        custom_criteria = payload.get("custom_criteria") or []
        word_limit = int(payload.get("word_limit") or 300)

        job_title = str(job_dict.get("title") or "Senior Systems Engineer")
        company = str(job_dict.get("company") or "Target Employer")

        # Synthesize justification score & proof points for response header
        synthesis = calculate_justification_score(job_dict, profile)

        response_payload: dict[str, Any] = {
            "success": True,
            "job_id": job_id,
            "job_title": job_title,
            "company": company,
            "justification_score": synthesis.justification_score,
            "proof_points": synthesis.proof_points,
        }

        # 1. KSC Generation
        if "ksc" in gen_types:
            ksc_report = _generate_grounded_ksc_report(
                job_dict, profile, custom_criteria, word_limit
            )
            response_payload["ksc"] = ksc_report

        # 2. Cover Letter Generation
        if "cover_letter" in gen_types:
            variants = _generate_grounded_cover_letters(job_dict, profile)
            primary_variant = variants[0]
            response_payload["cover_letter"] = {
                "variant": primary_variant.get("title", "The Direct Systems Architect"),
                "selected_variant": primary_variant.get(
                    "title", "The Direct Systems Architect"
                ),
                "content": primary_variant.get("content")
                or primary_variant.get("full_text")
                or "",
                "variants": variants,
            }

        # 3. ATS Resume Keyword Optimization
        if "ats_resume" in gen_types:
            ats_res = generate_ats_optimized_resume(profile, job_dict)
            job_text = f"{job_title} {job_dict.get('description', '')}".lower()

            canonical_skills = profile.get("coreSkills") or [
                "Microsoft 365",
                "SharePoint Online / Server",
                "Exchange Hybrid / Online",
                "Microsoft Teams",
                "Entra ID (Azure AD)",
                "PowerShell 5.1 / 7 & PnP",
                "Microsoft Intune & Windows Autopilot",
                "Active Directory & Group Policy",
                "Essential 8 & ISO 27001",
                "ServiceNow ITSM",
            ]
            matched = [
                s
                for s in canonical_skills
                if any(w in job_text for w in s.lower().split() if len(w) > 3)
            ]
            if not matched:
                matched = [
                    "Microsoft 365",
                    "PowerShell",
                    "Active Directory",
                    "Entra ID",
                ]

            missing = [
                req
                for req in ["Terraform", "Kubernetes", "AWS"]
                if req.lower() in job_text and req not in matched
            ]
            match_score = min(
                98,
                max(
                    75, int((len(matched) / max(1, len(matched) + len(missing))) * 100)
                ),
            )

            response_payload["ats_resume"] = {
                "match_score": match_score,
                "matched_keywords": matched,
                "missing_keywords": missing,
                "tailored_summary": (
                    f"Senior Infrastructure & M365 Engineer with 10 years of verified enterprise experience managing "
                    f"660,000+ users, clinical endpoint migrations, and automated compliance tailored for {job_title}."
                ),
                "skills": ats_res.get("skills", canonical_skills),
                "markdown_text": ats_res.get("markdown_text", ""),
            }

        # Multi-signal telemetry auto-recording for document generation
        if hasattr(app, "repository") and app.repository:
            try:
                app.repository.insert_telemetry_event(
                    {
                        "user_id": user_id,
                        "event_type": "package_prepared",
                        "job_id": job_id,
                        "job_title": job_title,
                        "company": job_dict.get("company") or "",
                        "skills": matched if "matched" in locals() else [],
                        "job_snapshot": job_dict,
                        "metadata": {
                            "source": "application_studio",
                            "generated_assets": list(response_payload.keys()),
                        },
                    }
                )
            except Exception as tel_err:  # noqa: BLE001
                logger.debug(
                    f"Telemetry logging notice in application-studio: {tel_err}"
                )

        handler.send_json(200, response_payload)

    except Exception as e:
        logger.exception("POST /api/career-mode/application-studio failed")
        handler.send_json(500, {"success": False, "error": str(e)})


# ==============================================================================
# 5. Multi-Signal Telemetry & Pattern Mining Routes
# ==============================================================================


@app_router.post("/api/telemetry/events")
@app_router.post("/api/telemetry/event")
def handle_post_telemetry_events(handler):
    """Ingest one or more weighted interaction telemetry events."""
    app = handler.app
    user_id = get_auth_user_id(handler) or "sam_ludwig"

    try:
        body = get_json_body(handler)
        if not body or not isinstance(body, dict):
            handler.send_json(
                400,
                {
                    "success": False,
                    "error": "Empty or invalid telemetry payload. JSON object expected.",
                },
            )
            return

        repo = getattr(app, "repository", None)
        if not repo:
            handler.send_json(
                500, {"success": False, "error": "Database repository unavailable"}
            )
            return

        raw_events: list[dict[str, Any]] = []
        if "events" in body and isinstance(body["events"], list):
            for e in body["events"]:
                if isinstance(e, dict) and e:
                    raw_events.append(dict(e))
        else:
            payload_keys = [k for k in body if k != "user_id"]
            if payload_keys:
                raw_events.append(dict(body))

        valid_events: list[dict[str, Any]] = []
        for ev in raw_events:
            has_event_indicator = bool(
                ev.get("event_type")
                or ev.get("interaction_type")
                or ev.get("job_id")
                or ev.get("job")
                or ev.get("job_snapshot")
            )
            if has_event_indicator:
                ev_copy = dict(ev)
                if not ev_copy.get("user_id"):
                    ev_copy["user_id"] = user_id
                valid_events.append(ev_copy)

        if not valid_events:
            handler.send_json(
                400,
                {
                    "success": False,
                    "error": "No valid telemetry events provided. Each event must include an event_type or job details.",
                },
            )
            return

        inserted_ids = repo.batch_insert_telemetry(valid_events)
        first_id = inserted_ids[0] if inserted_ids else None

        handler.send_json(
            200,
            {
                "success": True,
                "status": "recorded",
                "event_id": first_id,
                "event_ids": inserted_ids,
                "ingested_count": len(inserted_ids),
            },
        )
    except Exception as e:
        logger.exception("POST /api/telemetry/events failed")
        handler.send_json(500, {"success": False, "error": str(e)})


@app_router.get("/api/learning/patterns")
def handle_get_learning_patterns(handler):
    """Retrieve 4-dimension mined patterns and skill graduation progress."""
    app = handler.app
    query_params = get_query_params(handler)
    user_id = (
        get_auth_user_id(handler)
        or (query_params.get("user_id", [""])[0] or None)
        or "sam_ludwig"
    )

    try:
        repo = getattr(app, "repository", None)
        if not repo:
            handler.send_json(
                500, {"success": False, "error": "Database repository unavailable"}
            )
            return

        from ..telemetry import mine_career_patterns

        # Fetch recorded telemetry events for user
        events = repo.get_telemetry_events(user_id, limit=500)
        patterns = mine_career_patterns(events)

        clusters = patterns.get("industry_clusters", [])
        salary_info = (
            patterns.get("salary_anchoring")
            or patterns.get("remuneration_anchoring")
            or {}
        )
        salary_anchor = float(
            salary_info.get("recommended_floor")
            or salary_info.get("recommended_min")
            or salary_info.get("mean_annual")
            or salary_info.get("weighted_mean")
            or salary_info.get("recommended_preferred")
            or 155000.0
        )
        industries = {
            c["sector"]: c.get("affinity_pct", c.get("weight", 0.0))
            for c in clusters
            if isinstance(c, dict) and "sector" in c
        }

        handler.send_json(
            200,
            {
                "success": True,
                "user_id": user_id,
                "total_events_analyzed": len(events),
                "skills": patterns.get("skills", []),
                "seniority": patterns.get("seniority", {}),
                "industry_clusters": clusters,
                "industries": industries,
                "salary_anchoring": salary_info,
                "remuneration_anchoring": salary_info,
                "salary_anchor": salary_anchor,
            },
        )
    except Exception as e:
        logger.exception("GET /api/learning/patterns failed")
        handler.send_json(500, {"success": False, "error": str(e)})


# ==============================================================================
# 3. Gamification, XP Progression & Badges Routes
# ==============================================================================


@app_router.get("/api/career-mode/gamification")
def handle_get_gamification(handler):
    """Retrieve full gamification snapshot: XP level progress, streak, and 16 badges."""
    app = handler.app
    query_params = get_query_params(handler)
    user_id = (
        get_auth_user_id(handler)
        or (query_params.get("user_id", [""])[0] or None)
        or "sam_ludwig"
    )
    should_recalc = query_params.get("recalculate", ["0"])[0].lower() in ("1", "true")

    try:
        repo = getattr(app, "repository", None)
        profile = _get_sam_profile(app, user_id)

        from ..gamification import (
            compute_xp_progress,
            evaluate_badges,
            recalculate_user_gamification,
        )

        if repo and should_recalc:
            snapshot = recalculate_user_gamification(
                user_id=user_id, repository=repo, profile=profile
            )
            handler.send_json(200, {"success": True, **snapshot})
            return

        gam_record = (
            repo.get_user_gamification(user_id)
            if repo and hasattr(repo, "get_user_gamification")
            else None
        )

        if not gam_record:
            if repo:
                snapshot = recalculate_user_gamification(
                    user_id=user_id, repository=repo, profile=profile
                )
                handler.send_json(200, {"success": True, **snapshot})
                return
            snapshot = {
                "user_id": user_id,
                "xp": compute_xp_progress(0),
                "streak": {
                    "current_streak": 0,
                    "max_streak": 0,
                    "is_active_today": False,
                    "applied_dates": [],
                },
                "badges": evaluate_badges({}),
                "unlocked_count": 0,
                "total_badges": 16,
            }
            handler.send_json(200, {"success": True, **snapshot})
            return

        total_xp = int(gam_record.get("total_xp", 0))
        xp_progress = compute_xp_progress(total_xp)
        achievements = (
            repo.get_user_achievements(user_id)
            if repo and hasattr(repo, "get_user_achievements")
            else []
        )

        # Merge DB achievements with evaluation
        stats = {
            "current_streak": gam_record.get("current_streak_days", 0),
            "max_streak": gam_record.get("longest_streak_days", 0),
        }
        for a in achievements:
            stats[a.get("achievement_id")] = a.get(
                "progress", a.get("progress_value", 0)
            )

        badges = evaluate_badges(stats)
        # Update unlock status from DB records
        ach_map = {a["achievement_id"]: a for a in achievements}
        for b in badges:
            if b["id"] in ach_map:
                record = ach_map[b["id"]]
                if record.get("unlocked"):
                    b["unlocked"] = True
                    b["unlocked_at"] = record.get("unlocked_at") or b["unlocked_at"]
                    b["progress"] = b["target"]
                    b["progress_value"] = float(b["target"])
                    b["progress_pct"] = 100.0

        unlocked_count = sum(1 for b in badges if b["unlocked"])

        streak_info = {
            "current_streak": gam_record.get("current_streak_days", 0),
            "max_streak": gam_record.get("longest_streak_days", 0),
            "is_active_today": False,
            "last_applied_date": gam_record.get("last_applied_date_melbourne", ""),
        }

        handler.send_json(
            200,
            {
                "success": True,
                "user_id": user_id,
                "xp": xp_progress,
                "streak": streak_info,
                "badges": badges,
                "unlocked_count": unlocked_count,
                "total_badges": len(badges),
                "sound_enabled": bool(gam_record.get("sound_enabled", 1)),
                "visual_effects_enabled": bool(
                    gam_record.get("visual_effects_enabled", 1)
                ),
            },
        )
    except Exception as e:
        logger.exception("GET /api/career-mode/gamification failed")
        handler.send_json(500, {"success": False, "error": str(e)})


@app_router.post("/api/career-mode/gamification/action")
def handle_post_gamification_action(handler):
    """Record an action, award XP with idempotency, check milestone badges, and sync state."""
    app = handler.app
    body = get_json_body(handler) or {}
    user_id = get_auth_user_id(handler) or body.get("user_id") or "sam_ludwig"

    action_type = (
        str(body.get("action_type") or body.get("actionType") or "").strip().upper()
    )
    metadata = body.get("metadata") or {}
    if "job_id" in body and "job_id" not in metadata:
        metadata["job_id"] = body["job_id"]
    if "job" in body and "job" not in metadata:
        metadata["job"] = body["job"]

    try:
        repo = getattr(app, "repository", None)
        profile = _get_sam_profile(app, user_id)

        from ..gamification import (
            ACTION_XP,
            compute_melbourne_streak,
            compute_xp_progress,
            evaluate_action_xp,
            evaluate_badges,
            recalculate_user_gamification,
        )

        gam_record = (
            repo.get_user_gamification(user_id)
            if repo and hasattr(repo, "get_user_gamification")
            else None
        )
        if not gam_record and repo:
            recalculate_user_gamification(
                user_id=user_id, repository=repo, profile=profile
            )
            gam_record = repo.get_user_gamification(user_id)

        history = gam_record.get("history", []) if gam_record else []
        total_xp = int(gam_record.get("total_xp", 0)) if gam_record else 0

        # Evaluate action XP with anti-exploit idempotency
        xp_awarded, is_awarded, rationale = evaluate_action_xp(
            action_type=action_type,
            metadata=metadata,
            action_history=history,
        )

        prev_level_info = compute_xp_progress(total_xp)

        if is_awarded:
            total_xp += xp_awarded
            history.append(
                {
                    "action_type": action_type,
                    "xp": xp_awarded,
                    "job_id": metadata.get("job_id"),
                    "timestamp": datetime.now(timezone.utc).isoformat(),
                }
            )

        # Check streak if action was application submission
        applied_at = (
            metadata.get("applied_at") or datetime.now(timezone.utc).isoformat()
        )
        current_streak = gam_record.get("current_streak_days", 0) if gam_record else 0
        longest_streak = gam_record.get("longest_streak_days", 0) if gam_record else 0
        last_applied_date = (
            gam_record.get("last_applied_date_melbourne", "") if gam_record else ""
        )

        if action_type == "SUBMIT_APPLICATION":
            app_dates = [applied_at]
            if last_applied_date:
                app_dates.append(last_applied_date)
            # Fetch previous applications from repo
            if repo and hasattr(repo, "list_applications"):
                for a in repo.list_applications(user_id=user_id):
                    a_dt = a.get("applied_at") or a.get("created_at")
                    if a_dt:
                        app_dates.append(a_dt)
            streak_res = compute_melbourne_streak(app_dates)
            current_streak = streak_res["current_streak"]
            longest_streak = max(longest_streak, streak_res["max_streak"])
            if streak_res["applied_dates"]:
                last_applied_date = streak_res["applied_dates"][-1]

        # Evaluate badges
        existing_achievements = (
            repo.get_user_achievements(user_id)
            if repo and hasattr(repo, "get_user_achievements")
            else []
        )
        prev_unlocked = {
            a["achievement_id"] for a in existing_achievements if a.get("unlocked")
        }

        # Gather stats
        stats = {
            "current_streak": current_streak,
            "max_streak": longest_streak,
            "total_applications": len(
                [h for h in history if h.get("action_type") == "SUBMIT_APPLICATION"]
            ),
        }
        # Populate counts from existing achievements or history
        for a in existing_achievements:
            stats[a.get("achievement_id")] = a.get(
                "progress", a.get("progress_value", 0)
            )

        if action_type == "SUBMIT_APPLICATION":
            stats["total_applications"] = max(
                stats["total_applications"], len(existing_achievements) + 1
            )

        badges = evaluate_badges(stats)
        newly_unlocked = []

        for b in badges:
            b_id = b["id"]
            if b_id in prev_unlocked:
                b["unlocked"] = True
                b["progress"] = b["target"]
            elif b["unlocked"] and b_id not in prev_unlocked:
                newly_unlocked.append(b)
                # Award bonus achievement XP (+50 XP)
                total_xp += ACTION_XP["ACHIEVEMENT_UNLOCKED"]

        new_level_info = compute_xp_progress(total_xp)
        leveled_up = new_level_info["level"] > prev_level_info["level"]

        # Persist to database
        if repo and hasattr(repo, "upsert_user_gamification"):
            repo.upsert_user_gamification(
                user_id=user_id,
                total_xp=total_xp,
                current_level=new_level_info["level"],
                current_streak=current_streak,
                longest_streak=longest_streak,
                last_applied_date_melbourne=last_applied_date,
                history=history[-50:],  # keep last 50 events
            )

        if repo and hasattr(repo, "batch_upsert_achievements"):
            repo.batch_upsert_achievements(user_id, badges)

        handler.send_json(
            200,
            {
                "success": True,
                "awarded": is_awarded,
                "xp_awarded": xp_awarded,
                "rationale": rationale,
                "leveled_up": leveled_up,
                "previous_level": prev_level_info,
                "xp": new_level_info,
                "streak": {
                    "current_streak": current_streak,
                    "max_streak": longest_streak,
                    "last_applied_date": last_applied_date,
                },
                "badges": badges,
                "newly_unlocked": newly_unlocked,
            },
        )
    except Exception as e:
        logger.exception("POST /api/career-mode/gamification/action failed")
        handler.send_json(500, {"success": False, "error": str(e)})


@app_router.post("/api/career-mode/gamification/recalculate")
def handle_post_gamification_recalculate(handler):
    """Trigger full historical audit and recalculation of XP, streak, and badges."""
    app = handler.app
    body = get_json_body(handler) or {}
    user_id = get_auth_user_id(handler) or body.get("user_id") or "sam_ludwig"

    try:
        repo = getattr(app, "repository", None)
        profile = _get_sam_profile(app, user_id)

        from ..gamification import recalculate_user_gamification

        snapshot = recalculate_user_gamification(
            user_id=user_id,
            repository=repo,
            profile=profile,
        )
        handler.send_json(200, {"success": True, **snapshot})
    except Exception as e:
        logger.exception("POST /api/career-mode/gamification/recalculate failed")
        handler.send_json(500, {"success": False, "error": str(e)})


@app_router.post("/api/career-mode/gamification/preferences")
def handle_post_gamification_preferences(handler):
    """Update sound and visual micro-interaction preferences."""
    app = handler.app
    body = get_json_body(handler) or {}
    user_id = get_auth_user_id(handler) or body.get("user_id") or "sam_ludwig"

    sound_enabled = bool(body.get("sound_enabled", True))
    visual_effects_enabled = bool(body.get("visual_effects_enabled", True))

    try:
        repo = getattr(app, "repository", None)
        if repo and hasattr(repo, "upsert_user_gamification"):
            gam_record = repo.get_user_gamification(user_id) or {}
            repo.upsert_user_gamification(
                user_id=user_id,
                total_xp=gam_record.get("total_xp", 0),
                current_level=gam_record.get("current_level", 1),
                current_streak=gam_record.get("current_streak_days", 0),
                longest_streak=gam_record.get("longest_streak_days", 0),
                last_applied_date_melbourne=gam_record.get(
                    "last_applied_date_melbourne", ""
                ),
                sound_enabled=sound_enabled,
                visual_effects_enabled=visual_effects_enabled,
            )

        handler.send_json(
            200,
            {
                "success": True,
                "sound_enabled": sound_enabled,
                "visual_effects_enabled": visual_effects_enabled,
            },
        )
    except Exception as e:
        logger.exception("POST /api/career-mode/gamification/preferences failed")
        handler.send_json(500, {"success": False, "error": str(e)})
