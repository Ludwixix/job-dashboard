"""Morning Opportunity Digest Generator for CAREER.AGENT (Phase 5.2).

Extracts top-tier job opportunities matching custom score thresholds, calculates
market intelligence trends across recent listings, and generates formatted
payloads for Slack Block Kit, Markdown, and HTML email digests.
"""

from collections import Counter
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional


def generate_morning_digest(
    jobs: List[Dict[str, Any]],
    min_score: int = 85,
    limit: int = 5,
) -> Dict[str, Any]:
    """Filters top-scoring jobs and derives tactical market intelligence for the day.

    Args:
        jobs: List of job dictionary records from the ingestion database.
        min_score: Minimum match score threshold to qualify for the morning briefing.
        limit: Maximum number of featured opportunities to include.

    Returns:
        Structured dictionary containing statistical aggregates and featured jobs.
    """
    if not jobs:
        return {
            "generated_at": datetime.now(timezone.utc).isoformat(),
            "min_score": min_score,
            "total_qualified_matches": 0,
            "average_score": 0.0,
            "top_skills": [],
            "top_opportunities": [],
        }

    qualified: List[Dict[str, Any]] = []
    for job in jobs:
        score = job.get("score")
        if score is None:
            score = job.get("matchScore", 0)
        try:
            score_val = float(score)
        except (ValueError, TypeError):
            score_val = 0.0

        if score_val >= min_score:
            record = dict(job)
            record["score"] = score_val
            qualified.append(record)

    # Sort descending by match score
    qualified.sort(key=lambda x: x.get("score", 0), reverse=True)

    total_qualified = len(qualified)
    if total_qualified > 0:
        avg_score = round(sum(j.get("score", 0) for j in qualified) / total_qualified, 1)
    else:
        avg_score = 0.0

    # Extract high-frequency skills
    skill_counter: Counter[str] = Counter()
    for j in qualified:
        tags = j.get("tags") or []
        for tag in tags:
            if isinstance(tag, str) and tag.strip():
                skill_counter[tag.strip()] += 1

    top_skills = [skill for skill, _ in skill_counter.most_common(6)]
    featured = qualified[:limit]

    return {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "min_score": min_score,
        "total_qualified_matches": total_qualified,
        "average_score": avg_score,
        "top_skills": top_skills,
        "top_opportunities": featured,
    }


def format_slack_digest_blocks(digest_data: Dict[str, Any]) -> List[Dict[str, Any]]:
    """Formats digest aggregates into a Slack Block Kit payload.

    Args:
        digest_data: Dictionary output from generate_morning_digest.

    Returns:
        List of Slack block objects adhering to the Block Kit specification.
    """
    total = digest_data.get("total_qualified_matches", 0)
    avg_score = digest_data.get("average_score", 0.0)
    skills = ", ".join(digest_data.get("top_skills", [])) or "None identified"

    blocks: List[Dict[str, Any]] = [
        {
            "type": "header",
            "text": {
                "type": "plain_text",
                "text": "⚡ CAREER.AGENT — Morning Opportunity Intelligence",
                "emoji": True,
            },
        },
        {
            "type": "section",
            "fields": [
                {
                    "type": "mrkdwn",
                    "text": f"*🎯 Qualified Roles:* {total} (≥ {digest_data.get('min_score', 85)}%)",
                },
                {
                    "type": "mrkdwn",
                    "text": f"*📈 Average Match:* {avg_score}%",
                },
                {
                    "type": "mrkdwn",
                    "text": f"*🔥 Demand Trends:* {skills}",
                },
                {
                    "type": "mrkdwn",
                    "text": f"*⏱ Generated:* <!date^{int(datetime.now(timezone.utc).timestamp())}^{{date_num}} {{time_secs}}|Today>",
                },
            ],
        },
        {"type": "divider"},
    ]

    for job in digest_data.get("top_opportunities", []):
        title = job.get("title", "Untitled Role")
        company = job.get("company", "Confidential")
        location = job.get("location", "Australia")
        salary = job.get("salary") or "Market Competitive"
        score = job.get("score", 0)
        url = job.get("url") or job.get("job_url") or "https://job-dashboard-6xrdvjlrcq-ts.a.run.app"

        job_block: Dict[str, Any] = {
            "type": "section",
            "text": {
                "type": "mrkdwn",
                "text": f"*{title}* at *{company}*\n"
                f"📍 `{location}` | 💰 `{salary}`\n"
                f"⭐ *Score: {int(score)}% match*",
            },
        }

        if url.startswith("http"):
            job_block["accessory"] = {
                "type": "button",
                "text": {"type": "plain_text", "text": "Inspect Role", "emoji": True},
                "url": url,
                "action_id": f"view_job_{job.get('id', 'item')}",
            }

        blocks.append(job_block)

    blocks.append({"type": "divider"})
    blocks.append(
        {
            "type": "context",
            "elements": [
                {
                    "type": "mrkdwn",
                    "text": "Generated autonomously by *CAREER.AGENT Intelligence Hub*.",
                }
            ],
        }
    )

    return blocks


def format_markdown_digest(digest_data: Dict[str, Any]) -> str:
    """Formats digest aggregates into a Markdown string for email or terminal viewing.

    Args:
        digest_data: Output from generate_morning_digest.

    Returns:
        Formatted GitHub-flavored Markdown text.
    """
    total = digest_data.get("total_qualified_matches", 0)
    avg_score = digest_data.get("average_score", 0.0)
    skills = ", ".join(digest_data.get("top_skills", [])) or "None identified"

    lines = [
        "# CAREER.AGENT — High-Yield Opportunity Digest",
        "",
        f"**Summary Metrics:** {total} high-match roles identified | **Average Alignment:** {avg_score}%",
        f"**Top Market Skills:** `{skills}`",
        "",
        "---",
        "",
        "## Featured Priority Opportunities",
        "",
    ]

    for idx, job in enumerate(digest_data.get("top_opportunities", []), 1):
        title = job.get("title", "Role")
        company = job.get("company", "Confidential")
        location = job.get("location", "Australia")
        salary = job.get("salary") or "Market Package"
        score = job.get("score", 0)
        url = job.get("url") or job.get("job_url") or "#"

        lines.append(f"### {idx}. {title} — {company} ({int(score)}%)")
        lines.append(f"- **Location**: {location}")
        lines.append(f"- **Remuneration**: {salary}")
        if job.get("tags"):
            tag_str = " · ".join(str(t) for t in job.get("tags", [])[:5])
            lines.append(f"- **Tags**: `{tag_str}`")
        lines.append(f"- **Link**: [{company} Application Portal]({url})")
        lines.append("")

    lines.append("---")
    lines.append("*Delivered autonomously by CAREER.AGENT Intelligence Platform.*")
    return "\n".join(lines)


def format_html_digest(digest_data: Dict[str, Any]) -> str:
    """Formats digest aggregates into a clean HTML email document.

    Args:
        digest_data: Output from generate_morning_digest.

    Returns:
        HTML email markup with inline CSS for cross-client compatibility.
    """
    total = digest_data.get("total_qualified_matches", 0)
    avg_score = digest_data.get("average_score", 0.0)

    job_cards = []
    for job in digest_data.get("top_opportunities", []):
        title = job.get("title", "Role")
        company = job.get("company", "Confidential")
        location = job.get("location", "Australia")
        salary = job.get("salary") or "Market Package"
        score = job.get("score", 0)
        url = job.get("url") or job.get("job_url") or "#"

        job_cards.append(f"""
        <div style="background:#131722; border:1px solid #2a2e3d; border-radius:6px; padding:16px; margin-bottom:12px;">
            <div style="display:flex; justify-content:space-between; align-items:flex-start;">
                <div>
                    <h3 style="margin:0 0 4px 0; color:#f8fafc; font-size:16px;">{title}</h3>
                    <p style="margin:0; color:#38bdf8; font-weight:600; font-size:14px;">{company}</p>
                </div>
                <span style="background:#1e293b; color:#fbbf24; border:1px solid #f59e0b; padding:2px 8px; border-radius:4px; font-weight:bold; font-size:12px;">{int(score)}% MATCH</span>
            </div>
            <p style="margin:8px 0 0 0; color:#94a3b8; font-size:13px;">📍 {location} &nbsp;|&nbsp; 💰 {salary}</p>
            <div style="margin-top:12px;">
                <a href="{url}" style="background:#d97706; color:#ffffff; padding:6px 12px; border-radius:4px; text-decoration:none; font-size:12px; font-weight:bold; display:inline-block;">View Opportunity →</a>
            </div>
        </div>
        """)

    return f"""<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <title>CAREER.AGENT Morning Digest</title>
</head>
<body style="background:#0b0d13; color:#f8fafc; font-family:-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding:24px; margin:0;">
    <div style="max-width:640px; margin:0 auto; background:#0f1219; border:1px solid #1e2433; border-radius:8px; padding:24px;">
        <div style="border-bottom:1px solid #1e2433; padding-bottom:16px; margin-bottom:20px;">
            <h1 style="color:#f59e0b; margin:0 0 4px 0; font-size:20px; text-transform:uppercase; letter-spacing:0.5px;">CAREER.AGENT Intelligence</h1>
            <p style="color:#94a3b8; margin:0; font-size:13px;">Daily High-Yield Opportunity Dispatch</p>
        </div>
        <div style="display:flex; gap:16px; margin-bottom:24px; background:#161b26; padding:12px; border-radius:6px;">
            <div><span style="color:#94a3b8; font-size:11px; text-transform:uppercase;">Top Matches:</span> <strong style="color:#38bdf8;">{total}</strong></div>
            <div><span style="color:#94a3b8; font-size:11px; text-transform:uppercase;">Avg Score:</span> <strong style="color:#10b981;">{avg_score}%</strong></div>
        </div>
        <h2 style="color:#f8fafc; font-size:15px; margin:0 0 12px 0;">Priority Positions</h2>
        {''.join(job_cards)}
        <p style="margin-top:24px; font-size:11px; color:#64748b; text-align:center;">Autonomous briefing generated by CAREER.AGENT</p>
    </div>
</body>
</html>"""

