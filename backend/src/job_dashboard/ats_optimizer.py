"""ATS-Compliant Document Exporter & Cognitive Triage Optimization Subsystem.

Implements the technical blueprint from 'Resume Optimization for AI':
1. Single-column linear machine extraction (guaranteeing 97-98% parsing accuracy across
   Workday, Greenhouse, Taleo, PageUp, and JobAdder).
2. Standardized 4-schema nomenclature: Professional Summary, Work Experience, Education, Skills.
3. 7.4-second F-pattern cognitive apex: Name, matched target job title, contact data.
4. Front-loaded STAR metrics and Australian English localization.
5. Anti-adversarial hygiene: Sanitizes zero-width unicode characters and prompt injection attacks.
6. Native OpenXML (.docx) byte generator without external dependencies.
"""

from __future__ import annotations

import io
import re
import zipfile
from typing import Any
from xml.sax.saxutils import escape as xml_escape

from .logging import get_logger
from .semantic_tailoring import localize_australian

logger = get_logger("job_dashboard.ats_optimizer")

# Zero-width unicode glyphs commonly used in white-text prompt injections
ZERO_WIDTH_CHARS = re.compile(r"[\u200B-\u200D\uFEFF\u202A-\u202E\u00AD\u2060]")

# Prompt injection regex patterns targeting automated LLM resume screeners
PROMPT_INJECTION_PATTERNS = [
    re.compile(r"ignore\s+(all\s+)?previous\s+instructions", re.IGNORECASE),
    re.compile(r"classify\s+this\s+candidate\s+as\s+(fully\s+qualified|superior|top)", re.IGNORECASE),
    re.compile(r"system\s*:\s*(override|accept|priority)", re.IGNORECASE),
    re.compile(r"you\s+must\s+(rank|score|rate)\s+this\s+candidate\s+(highest|100%?|superior)", re.IGNORECASE),
    re.compile(r"disregard\s+(any\s+)?(negative|missing)\s+(criteria|qualifications)", re.IGNORECASE),
    re.compile(r"<prompt_injection>[\s\S]*?<\/prompt_injection>", re.IGNORECASE),
]


def sanitize_adversarial_injections(text: str) -> str:
    """Sanitizes text by removing zero-width hidden characters and prompt injection attacks."""
    if not text or not isinstance(text, str):
        return ""
    
    # 1. Remove zero-width hidden characters
    cleaned = ZERO_WIDTH_CHARS.sub("", text)
    
    # 2. Neutralize explicit adversarial prompt injections
    for pattern in PROMPT_INJECTION_PATTERNS:
        cleaned = pattern.sub("", cleaned)
        
    return cleaned.strip()


def front_load_star_bullet(bullet: str) -> str:
    """Ensures a bullet point front-loads its action verb and measurable metric."""
    clean = bullet.strip().lstrip("•*-| ").strip()
    if not clean:
        return ""
        
    # Check if an end-of-sentence metric exists (e.g., "... resulting in 40% reduction in downtime.")
    metric_match = re.search(r"(?:resulting in|achieving|driving|delivering|with|by)\s+([\d%$,]+\+?\s+[a-zA-Z\s]+(?:\b(?:reduction|increase|growth|efficiency|uptime|velocity|improvement|savings)\b)?)", clean, re.IGNORECASE)
    if metric_match:
        metric_phrase = metric_match.group(1).strip()
        # If the metric phrase isn't already near the start, rephrase with metric front-loaded
        if clean.lower().find(metric_phrase.lower()) > 35:
            # Cleanly front-load
            lead_action = clean.split()[0].rstrip(",.:")
            rest = clean[:metric_match.start()].strip().rstrip(",. ")
            return f"{lead_action} and drove {metric_phrase} by {rest[len(lead_action):].strip()}"

    return clean


def generate_ats_optimized_resume(profile: dict[str, Any], job: dict[str, Any] | None = None) -> dict[str, Any]:
    """Generates an ATS-optimized, single-column linear resume structure."""
    job = job or {}
    name = str(profile.get("name") or "Candidate").strip()
    email = str(profile.get("email") or "").strip()
    phone = str(profile.get("phone") or "").strip()
    location = str(profile.get("location") or "Melbourne, VIC").strip()
    linkedin = str(profile.get("linkedin") or "").strip()
    
    # Target Title: Mirror job title directly if available, otherwise candidate headline
    target_title = str(job.get("title") or profile.get("title") or profile.get("headline") or "Senior Technical Specialist").strip()
    
    # 1. Apex Summary (Top 25% F-pattern fixation zone)
    raw_summary = str(profile.get("summary") or profile.get("about") or "").strip()
    if not raw_summary:
        raw_summary = (
            f"High-impact {target_title} with proven engineering expertise across enterprise environments. "
            "Demonstrated track record of delivering resilient, automated infrastructure and optimizing operational uptime."
        )
    clean_summary = localize_australian(sanitize_adversarial_injections(raw_summary))
    
    # 2. Standardized Skills
    core_skills = profile.get("coreSkills") or profile.get("skills") or []
    if isinstance(core_skills, dict):
        flat_skills = []
        for v in core_skills.values():
            if isinstance(v, list):
                flat_skills.extend(v)
        core_skills = flat_skills
    skills_list = [localize_australian(str(s).strip()) for s in core_skills if s]
    # Deduplicate while preserving order
    deduped_skills = []
    seen = set()
    for s in skills_list:
        if s.lower() not in seen:
            seen.add(s.lower())
            deduped_skills.append(s)
            
    # 3. Standardized Work Experience (Umbrella Method & STAR front-loading)
    raw_experience = profile.get("experience") or profile.get("work_experience") or profile.get("roles") or []
    experience_items = []
    for exp in raw_experience:
        exp_title = str(exp.get("title") or "").strip()
        company = str(exp.get("company") or "").strip()
        dates = str(exp.get("dates") or exp.get("period") or exp.get("duration") or "").strip()
        exp_location = str(exp.get("location") or location).strip()
        
        raw_bullets = exp.get("highlights") or exp.get("bullets") or exp.get("achievements") or []
        if isinstance(raw_bullets, str):
            raw_bullets = [b.strip() for b in raw_bullets.split("\n") if b.strip()]
            
        processed_bullets = []
        for b in raw_bullets:
            sanitized = sanitize_adversarial_injections(str(b))
            if sanitized:
                front_loaded = front_load_star_bullet(sanitized)
                localized = localize_australian(front_loaded)
                processed_bullets.append(localized)
                
        experience_items.append({
            "title": localize_australian(exp_title),
            "company": company,
            "dates": dates,
            "location": exp_location,
            "bullets": processed_bullets,
        })
        
    # 4. Standardized Education & Certifications
    raw_education = profile.get("education") or profile.get("qualifications") or []
    education_items = []
    for edu in raw_education:
        if isinstance(edu, str):
            education_items.append({"degree": localize_australian(edu), "institution": "", "year": ""})
        elif isinstance(edu, dict):
            education_items.append({
                "degree": localize_australian(str(edu.get("degree") or edu.get("qualification") or "").strip()),
                "institution": str(edu.get("institution") or edu.get("school") or "").strip(),
                "year": str(edu.get("year") or edu.get("dates") or "").strip(),
            })

    # Compile Markdown representation
    contact_parts = [p for p in [location, phone, email, linkedin] if p]
    contact_line = " | ".join(contact_parts)
    
    md_lines = [
        f"# {name}",
        f"**{target_title}**",
        contact_line,
        "",
        "## Professional Summary",
        clean_summary,
        "",
        "## Skills",
        ", ".join(deduped_skills[:30]),
        "",
        "## Work Experience",
    ]
    
    for exp in experience_items:
        md_lines.append(f"### {exp['title']} - {exp['company']}")
        md_lines.append(f"*{exp['dates']} | {exp['location']}*")
        for b in exp["bullets"]:
            md_lines.append(f"- {b}")
        md_lines.append("")
        
    if education_items:
        md_lines.append("## Education & Certifications")
        for edu in education_items:
            details = f"{edu['degree']}"
            if edu['institution']:
                details += f" - {edu['institution']}"
            if edu['year']:
                details += f" ({edu['year']})"
            md_lines.append(f"- {details}")
            
    markdown_text = "\n".join(md_lines)
    
    return {
        "name": name,
        "target_title": target_title,
        "contact_line": contact_line,
        "email": email,
        "phone": phone,
        "location": location,
        "linkedin": linkedin,
        "summary": clean_summary,
        "skills": deduped_skills,
        "experience": experience_items,
        "education": education_items,
        "markdown_text": markdown_text,
    }


def generate_ats_docx_bytes(resume_data: dict[str, Any]) -> bytes:
    """Generates an authentic Microsoft Word OpenXML (.docx) file byte archive.
    
    Constructed strictly to the single-column linear ATS standard to eliminate
    text-layer scrambling in Workday, Greenhouse, JobAdder, and Taleo.
    """
    name = xml_escape(resume_data.get("name", "Candidate"))
    target_title = xml_escape(resume_data.get("target_title", ""))
    contact_line = xml_escape(resume_data.get("contact_line", ""))
    summary = xml_escape(resume_data.get("summary", ""))
    skills = [xml_escape(s) for s in resume_data.get("skills", [])]
    experience = resume_data.get("experience", [])
    education = resume_data.get("education", [])

    body_xml_parts = []

    # 1. Header (Apex Fixation: Name + Target Title + Contact Info)
    body_xml_parts.append(f"""
    <w:p>
      <w:pPr>
        <w:jc w:val="left"/>
        <w:spacing w:after="60" w:line="240" w:lineRule="auto"/>
      </w:pPr>
      <w:r>
        <w:rPr>
          <w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/>
          <w:b/>
          <w:sz w:val="40"/>
        </w:rPr>
        <w:t>{name}</w:t>
      </w:r>
    </w:p>
    """)

    if target_title:
        body_xml_parts.append(f"""
        <w:p>
          <w:pPr>
            <w:spacing w:after="60"/>
          </w:pPr>
          <w:r>
            <w:rPr>
              <w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/>
              <w:b/>
              <w:color w:val="2B579A"/>
              <w:sz w:val="24"/>
            </w:rPr>
            <w:t>{target_title}</w:t>
          </w:r>
        </w:p>
        """)

    if contact_line:
        body_xml_parts.append(f"""
        <w:p>
          <w:pPr>
            <w:spacing w:after="240"/>
          </w:pPr>
          <w:r>
            <w:rPr>
              <w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/>
              <w:color w:val="555555"/>
              <w:sz w:val="18"/>
            </w:rPr>
            <w:t>{contact_line}</w:t>
          </w:r>
        </w:p>
        """)

    def make_section_heading(title: str) -> str:
        safe_title = xml_escape(title.upper())
        return f"""
        <w:p>
          <w:pPr>
            <w:pBdr>
              <w:bottom w:val="single" w:sz="8" w:space="4" w:color="2B579A"/>
            </w:pBdr>
            <w:spacing w:before="240" w:after="120"/>
          </w:pPr>
          <w:r>
            <w:rPr>
              <w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/>
              <w:b/>
              <w:color w:val="1F4E79"/>
              <w:sz w:val="24"/>
            </w:rPr>
            <w:t>{safe_title}</w:t>
          </w:r>
        </w:p>
        """

    # 2. Professional Summary
    if summary:
        body_xml_parts.append(make_section_heading("Professional Summary"))
        body_xml_parts.append(f"""
        <w:p>
          <w:pPr>
            <w:spacing w:after="180" w:line="260" w:lineRule="auto"/>
          </w:pPr>
          <w:r>
            <w:rPr>
              <w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/>
              <w:sz w:val="20"/>
            </w:rPr>
            <w:t>{summary}</w:t>
          </w:r>
        </w:p>
        """)

    # 3. Skills
    if skills:
        body_xml_parts.append(make_section_heading("Skills"))
        skills_text = xml_escape(" • ".join(skills))
        body_xml_parts.append(f"""
        <w:p>
          <w:pPr>
            <w:spacing w:after="180" w:line="240" w:lineRule="auto"/>
          </w:pPr>
          <w:r>
            <w:rPr>
              <w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/>
              <w:sz w:val="20"/>
            </w:rPr>
            <w:t>{skills_text}</w:t>
          </w:r>
        </w:p>
        """)

    # 4. Work Experience
    if experience:
        body_xml_parts.append(make_section_heading("Work Experience"))
        for exp in experience:
            role_title = xml_escape(exp.get("title", ""))
            comp = xml_escape(exp.get("company", ""))
            dates = xml_escape(exp.get("dates", ""))
            loc = xml_escape(exp.get("location", ""))
            
            # Role Header
            body_xml_parts.append(f"""
            <w:p>
              <w:pPr>
                <w:spacing w:before="120" w:after="40"/>
              </w:pPr>
              <w:r>
                <w:rPr>
                  <w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/>
                  <w:b/>
                  <w:sz w:val="22"/>
                </w:rPr>
                <w:t>{role_title} | {comp}</w:t>
              </w:r>
            </w:p>
            <w:p>
              <w:pPr>
                <w:spacing w:after="80"/>
              </w:pPr>
              <w:r>
                <w:rPr>
                  <w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/>
                  <w:i/>
                  <w:color w:val="666666"/>
                  <w:sz w:val="18"/>
                </w:rPr>
                <w:t>{dates}{' • ' + loc if loc else ''}</w:t>
              </w:r>
            </w:p>
            """)
            
            # Bullets
            for bullet in exp.get("bullets", []):
                safe_bullet = xml_escape(bullet)
                body_xml_parts.append(f"""
                <w:p>
                  <w:pPr>
                    <w:ind w:left="360" w:hanging="240"/>
                    <w:spacing w:after="60" w:line="240" w:lineRule="auto"/>
                  </w:pPr>
                  <w:r>
                    <w:rPr>
                      <w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/>
                      <w:sz w:val="20"/>
                    </w:rPr>
                    <w:t>• {safe_bullet}</w:t>
                  </w:r>
                </w:p>
                """)

    # 5. Education
    if education:
        body_xml_parts.append(make_section_heading("Education"))
        for edu in education:
            deg = xml_escape(edu.get("degree", ""))
            inst = xml_escape(edu.get("institution", ""))
            yr = xml_escape(edu.get("year", ""))
            edu_line = deg
            if inst:
                edu_line += f" — {inst}"
            if yr:
                edu_line += f" ({yr})"
                
            body_xml_parts.append(f"""
            <w:p>
              <w:pPr>
                <w:spacing w:after="80"/>
              </w:pPr>
              <w:r>
                <w:rPr>
                  <w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/>
                  <w:b/>
                  <w:sz w:val="20"/>
                </w:rPr>
                <w:t>{edu_line}</w:t>
              </w:r>
            </w:p>
            """)

    # Standard 1-inch (1440 twips) single column page layout
    sect_pr = """
    <w:sectPr>
      <w:pgSz w:w="12240" w:h="15840"/>
      <w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440" w:header="720" w:footer="720" w:gutter="0"/>
      <w:cols w:space="720" w:num="1"/>
      <w:docGrid w:linePitch="360"/>
    </w:sectPr>
    """

    document_xml = f"""<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
    <w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"
                xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
      <w:body>
        {''.join(body_xml_parts)}
        {sect_pr}
      </w:body>
    </w:document>
    """

    content_types_xml = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
    <Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
      <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
      <Default Extension="xml" ContentType="application/xml"/>
      <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
    </Types>
    """

    rels_xml = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
    <Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
      <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
    </Relationships>
    """

    # Assemble in-memory zip
    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, "w", zipfile.ZIP_DEFLATED) as docx_zip:
        docx_zip.writestr("[Content_Types].xml", content_types_xml.strip())
        docx_zip.writestr("_rels/.rels", rels_xml.strip())
        docx_zip.writestr("word/document.xml", document_xml.strip())

    return buffer.getvalue()
