"""Inbound Sourcing Optimization & LinkedIn Boolean Indexing Engine.

Fulfills Phase 21 specifications from docs/Resume_Optimization.md:
- Recruiter Boolean Query Simulator (AND, OR, NOT, Quotes, Parentheses).
- Inbound Visibility Audit (Headline & About index analysis).
- Recruiter Boolean Query Generator (Synthesizes realistic queries used on LinkedIn Recruiter).
- Boolean-Optimized Headline & Keyword-Rich About Index Synthesizers.
"""

import re
from typing import Any, Dict, List, Optional, Set, Tuple


STOP_WORDS = {
    "a", "an", "the", "in", "on", "at", "for", "with", "by", "of", "to", "and", "or", "from"
}

VAGUE_BUZZWORDS = [
    "guru", "ninja", "rockstar", "wizard", "enthusiast", "visionary",
    "passionate", "evangelist", "game changer", "synergy", "dynamic",
    "go-getter", "self-starter", "thought leader"
]

SYNONYM_MAP = {
    "engineer": ["developer", "specialist", "architect", "programmer"],
    "cloud": ["infrastructure", "devops", "platform", "systems"],
    "systems": ["infrastructure", "sysadmin", "it operations", "administrator"],
    "administrator": ["engineer", "specialist", "coordinator"],
    "manager": ["lead", "head", "director", "coordinator"],
    "data": ["analytics", "bi", "machine learning", "database"],
    "nurse": ["registered nurse", "clinical nurse", "rn", "healthcare"],
    "accountant": ["financial analyst", "bookkeeper", "cpa", "finance officer"],
    "carpenter": ["builder", "tradesperson", "site supervisor", "construction"],
}


def _tokenize_boolean_query(query: str) -> List[Tuple[str, str]]:
    """Tokenize a Boolean query into a list of (type, value) tuples."""
    tokens: List[Tuple[str, str]] = []
    i = 0
    n = len(query)

    while i < n:
        c = query[i]

        if c.isspace():
            i += 1
            continue

        if c == '(':
            tokens.append(('LPAREN', '('))
            i += 1
        elif c == ')':
            tokens.append(('RPAREN', ')'))
            i += 1
        elif c == '"':
            # Quoted string
            i += 1
            start = i
            while i < n and query[i] != '"':
                i += 1
            val = query[start:i].strip()
            if val:
                tokens.append(('TERM', val))
            if i < n and query[i] == '"':
                i += 1
        else:
            # Word or operator
            start = i
            while i < n and not query[i].isspace() and query[i] not in '()"':
                i += 1
            word = query[start:i]
            upper_word = word.upper()
            if upper_word in ('AND', 'OR', 'NOT'):
                tokens.append((upper_word, upper_word))
            else:
                tokens.append(('TERM', word))

    return tokens


class BooleanEvaluator:
    """Evaluates Boolean search expressions against document text."""

    def __init__(self, query: str, text: str):
        self.raw_query = query
        self.text = text
        self.text_lower = f" {text.lower()} "
        self.has_curly_quotes = '“' in query or '”' in query or '‘' in query or '’' in query

        # Normalize curly quotes
        norm_query = (
            query.replace('“', '"')
            .replace('”', '"')
            .replace('‘', "'")
            .replace('’', "'")
        )
        self.tokens = _tokenize_boolean_query(norm_query)
        self.pos = 0
        self.matched_terms: Set[str] = set()
        self.missing_terms: Set[str] = set()

    def _peek(self) -> Optional[Tuple[str, str]]:
        if self.pos < len(self.tokens):
            return self.tokens[self.pos]
        return None

    def _consume(self) -> Optional[Tuple[str, str]]:
        tok = self._peek()
        if tok:
            self.pos += 1
        return tok

    def _check_term(self, term: str) -> bool:
        term_clean = term.strip().lower()
        if not term_clean:
            return True

        # Check exact phrase or word boundary
        if " " in term_clean:
            matches = term_clean in self.text_lower
        else:
            pattern = rf"\b{re.escape(term_clean)}\b"
            matches = bool(re.search(pattern, self.text_lower))

        if matches:
            self.matched_terms.add(term)
        else:
            self.missing_terms.add(term)
        return matches

    def parse_expr(self) -> bool:
        return self._parse_or()

    def _parse_or(self) -> bool:
        left = self._parse_and()
        while True:
            tok = self._peek()
            if tok and tok[0] == 'OR':
                self._consume()
                right = self._parse_and()
                left = left or right
            else:
                break
        return left

    def _parse_and(self) -> bool:
        left = self._parse_not()
        while True:
            tok = self._peek()
            if tok and tok[0] == 'AND':
                self._consume()
                right = self._parse_not()
                left = left and right
            elif tok and tok[0] not in ('OR', 'RPAREN'):
                # Implicit AND between consecutive terms without explicit operator
                right = self._parse_not()
                left = left and right
            else:
                break
        return left

    def _parse_not(self) -> bool:
        tok = self._peek()
        if tok and tok[0] == 'NOT':
            self._consume()
            right = self._parse_primary()
            return not right
        return self._parse_primary()

    def _parse_primary(self) -> bool:
        tok = self._peek()
        if not tok:
            return True

        if tok[0] == 'LPAREN':
            self._consume()
            res = self._parse_or()
            close_tok = self._peek()
            if close_tok and close_tok[0] == 'RPAREN':
                self._consume()
            return res

        if tok[0] == 'TERM':
            self._consume()
            return self._check_term(tok[1])

        # Fallback for unexpected operator
        self._consume()
        return True


def evaluate_boolean_query(query: str, text: str) -> Dict[str, Any]:
    """Evaluates a recruiter Boolean query against text."""
    evaluator = BooleanEvaluator(query, text)
    is_match = evaluator.parse_expr()

    return {
        "is_match": is_match,
        "matched_terms": sorted(list(evaluator.matched_terms)),
        "missing_terms": sorted(list(evaluator.missing_terms)),
        "has_curly_quotes_warning": evaluator.has_curly_quotes,
        "token_count": len(evaluator.tokens),
    }


def generate_recruiter_boolean_queries(
    title: str,
    skills: Optional[List[str]] = None,
    industry: str = "Technology"
) -> List[Dict[str, str]]:
    """Synthesizes realistic high-converting recruiter Boolean search queries for a role."""
    clean_title = (title or "Systems Engineer").strip()
    skill_list = [s.strip() for s in (skills or ["Cloud", "Infrastructure", "Automation", "Security"]) if s.strip()]
    
    if len(skill_list) < 4:
        skill_list.extend(["Systems", "Architecture", "Operations", "Compliance"][:4 - len(skill_list)])

    s1, s2, s3, s4 = skill_list[0], skill_list[1], skill_list[2], skill_list[3]

    # Find synonyms for title words
    title_words = [w.lower() for w in re.findall(r"\b[A-Za-z]+\b", clean_title)]
    synonyms: Set[str] = set()
    for w in title_words:
        if w in SYNONYM_MAP:
            synonyms.update(SYNONYM_MAP[w])

    synonym_title = ""
    if synonyms:
        syn_word = list(synonyms)[0].title()
        synonym_title = clean_title.lower().replace(title_words[0], syn_word.lower()).title()
    else:
        synonym_title = f"Senior {clean_title}"

    queries = [
        {
            "strategy": "Exact Target Title & Core Stack",
            "description": "Used by corporate in-house recruiters for exact headline targeting.",
            "query": f'"{clean_title}" AND ({s1} OR {s2}) AND ({s3} OR {s4})'
        },
        {
            "strategy": "Broad Title Synonyms & Seniority",
            "description": "Used by agency headhunters searching across title variations.",
            "query": f'("{clean_title}" OR "{synonym_title}") AND ({s1} OR {s2})'
        },
        {
            "strategy": "Methodology & Architecture Deep Dive",
            "description": "Pinpoints hands-on senior practitioners with delivery leadership.",
            "query": f'("{clean_title}") AND (Architecture OR Deployment OR Implementation OR Optimization) AND ({s1})'
        },
        {
            "strategy": "Negative-Filtered Senior Talent Pool",
            "description": "Prunes junior candidates, entry-level, interns, and academic profiles.",
            "query": f'("{clean_title}" OR "{synonym_title}") AND ({s1}) NOT (Junior OR Intern OR Graduate OR "Entry Level")'
        },
        {
            "strategy": "Enterprise Scale & Australian Clearance Moat",
            "description": "High-yield filter for Australian enterprise & sovereign government mandates.",
            "query": f'("{clean_title}") AND ({s1} OR {s2}) AND (Enterprise OR "Large Scale" OR Baseline OR NV1 OR "Australian Citizen")'
        }
    ]

    return queries


def generate_boolean_optimized_headlines(
    target_title: str,
    core_skills: Optional[List[str]] = None,
    industry: str = "Technology"
) -> List[str]:
    """Generates 3 Boolean-friendly LinkedIn Headlines designed for LinkedIn Recruiter indexing."""
    title = (target_title or "Senior Systems Engineer").strip()
    skills = [s.strip() for s in (core_skills or ["Azure", "Terraform", "PowerShell", "Intune"]) if s.strip()]
    if len(skills) < 4:
        skills.extend(["Systems", "Cloud", "Automation", "Security"][:4 - len(skills)])

    # Format 1: Exact Title | Core Tech Stack | Standard Certification / Security
    h1 = f"{title} | {', '.join(skills[:3])} | ACSC Essential 8 & Infrastructure Automation"

    # Format 2: Dual-Title Sourcing Index | Methodologies
    title_words = [w.lower() for w in re.findall(r"\b[A-Za-z]+\b", title)]
    alt_role = "Cloud & Systems Specialist"
    if "engineer" in title_words:
        alt_role = title.replace("Engineer", "Specialist").replace("engineer", "Specialist")
    elif "manager" in title_words:
        alt_role = title.replace("Manager", "Lead").replace("manager", "Lead")

    h2 = f"{title} | {alt_role} | {skills[0]} & {skills[1]} Architecture | DevSecOps"

    # Format 3: Scale & Operational Moat
    h3 = f"{title} | Enterprise Systems (5,000+ Endpoints) | {skills[0]}, {skills[2]} | Baseline Clearance"

    return [h1[:220], h2[:220], h3[:220]]


def generate_keyword_about_index(
    target_title: str,
    core_skills: Optional[List[str]] = None,
    scale_metrics: str = "5,000+ Endpoints, 99.9% Uptime"
) -> str:
    """Generates a structured, keyword-rich 'About' section for LinkedIn Recruiter indexing."""
    title = (target_title or "Senior Systems & Cloud Engineer").strip()
    skills = [s.strip() for s in (core_skills or ["Azure", "Terraform", "PowerShell", "Intune", "M365", "ACSC Essential 8"]) if s.strip()]

    stack_str = " • ".join(skills)
    
    return f"""Experienced {title} with a proven track record architecting, automating, and securing enterprise infrastructure environments. Specializing in high-availability systems, cloud modernization, and zero-downtime operations ({scale_metrics}).

─── CORE COMPETENCIES (Recruiter Index) ───
• Architecture & Design: Cloud Infrastructure, Hybrid Identity, Enterprise Systems
• Automation & DevOps: CI/CD Pipelines, Infrastructure-as-Code, Scripting & Orchestration
• Governance & Security: ACSC Essential 8, ISO 27001, Endpoint Hardening, SLA Management

─── TECHNICAL ECOSYSTEM ───
{stack_str}

─── TARGET ROLES & SYNONYMS ───
{title} | Cloud Infrastructure Engineer | Systems Administrator | Technical Specialist | Enterprise Architect

Open to discussing senior enterprise engineering, cloud transformation, and architecture initiatives across Australia."""


def audit_linkedin_indexability(
    headline: str,
    about: str,
    target_role: str,
    core_skills: Optional[List[str]] = None
) -> Dict[str, Any]:
    """Audits candidate LinkedIn headline and about text for recruiter Boolean search visibility."""
    headline_clean = (headline or "").strip()
    about_clean = (about or "").strip()
    target = (target_role or "").strip().lower()
    skills = [s.strip().lower() for s in (core_skills or []) if s.strip()]

    score = 100
    recommendations: List[str] = []
    strengths: List[str] = []

    # 1. Headline Audit (Max 50 points)
    if not headline_clean:
        score -= 45
        recommendations.append("Add a structured LinkedIn headline containing your exact target job title.")
    else:
        # Check literal target title in headline
        if target and target in headline_clean.lower():
            strengths.append(f"Headline contains literal target role title: '{target_role}'.")
        else:
            score -= 25
            recommendations.append(f"Include the exact literal title '{target_role}' in your headline. Recruiters search exact titles in LinkedIn Recruiter.")

        # Check delimiter structure
        if any(sep in headline_clean for sep in ["|", "•", "—", "/"]):
            strengths.append("Headline uses clear visual delimiter piping for high recruiter scanability.")
        else:
            score -= 10
            recommendations.append("Use '|' or '•' dividers in your headline to clearly separate Title, Core Skills, and Value Proposition.")

        # Check for vague buzzwords
        found_buzzwords = [bw for bw in VAGUE_BUZZWORDS if bw in headline_clean.lower()]
        if found_buzzwords:
            score -= 15
            recommendations.append(f"Remove abstract buzzwords ({', '.join(found_buzzwords)}) from your headline. Replace with factual skills and exact job titles.")

    # 2. About Section Audit (Max 40 points)
    if not about_clean:
        score -= 35
        recommendations.append("Draft a structured 'About' section featuring grouped skills and searchable keywords.")
    else:
        # Check skill overlap
        matched_skills = [s for s in skills if s in about_clean.lower()]
        missing_skills = [s for s in skills if s not in about_clean.lower()]
        
        if len(matched_skills) >= max(2, len(skills) // 2):
            strengths.append(f"About section integrates {len(matched_skills)} core technical keywords.")
        else:
            score -= 15
            recommendations.append(f"Integrate missing core skills in About section: {', '.join(missing_skills[:4])}.")

        # Check for grouped keywords / structure
        if any(h in about_clean.lower() for h in ["core competencies", "technical skills", "ecosystem", "expertise", "specialties"]):
            strengths.append("About section contains structured competency headers for LinkedIn semantic clustering.")
        else:
            score -= 10
            recommendations.append("Add an explicit 'CORE COMPETENCIES' or 'TECHNICAL ECOSYSTEM' section to your About text.")

        # Check for measurable scale
        has_metrics = bool(re.search(r"\b\d+[%+kKmM]?\b|\$\d+", about_clean))
        if has_metrics:
            strengths.append("About section features quantified scale metrics.")
        else:
            score -= 10
            recommendations.append("Include quantifiable operational metrics (e.g. '5,000+ endpoints', '$2M budget', '99.9% uptime') to anchor semantic search.")

    # 3. Typography & Punctuation Traps (Max 10 points)
    combined = f"{headline_clean} {about_clean}"
    if '“' in combined or '”' in combined or '‘' in combined or '’' in combined:
        score -= 5
        recommendations.append("Replace curly typographic quotes (“ ”) with straight quotes (\"). Curly quotes corrupt Boolean queries.")

    final_score = max(15, min(100, score))

    return {
        "inbound_visibility_score": final_score,
        "strengths": strengths,
        "recommendations": recommendations,
        "headline_character_count": len(headline_clean),
        "headline_character_limit": 220,
        "about_word_count": len(about_clean.split()) if about_clean else 0,
    }
