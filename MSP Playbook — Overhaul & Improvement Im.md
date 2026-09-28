MSP Playbook — Overhaul & Improvement Implementation Plan
Site Overview
mspplaybook.reviews is an Australian IT industry intelligence platform covering:

325+ editorial articles across 8 categories (career, contracts, industry, security, etc.)
94 MSP profiles with employee ratings, sentiment, and financial snapshots ("The Ledger")
7 interactive browser-only tools (Red Flag Scanner, Contract Grader, Health Score, Cost Calculator, Stack Profitability, Procurement Scorecard, On-Call Impact)
Salary transparency board — anonymous community submissions
Weekly newsletter + LinkedIn/Twitter presence
The site's positioning: independent, evidence-backed, dual-audience (IT workers protecting themselves + operators building better MSPs).

Critical Problems Identified
CAUTION

These are the highest-priority issues blocking growth and trust.

MSP profiles are thin shells. The #1 rated MSP (KMT) shows empty "Worker Pros / Worker Cons" sections, no real data, stale confidence indicators ("Legacy record — source refresh needed"), and placeholder sentiment tags. 94 profiles indexed but most appear data-sparse.
Directory is non-functional for filtering. The directory page renders "No profiles match those filters" when the page loads — a critical JS failure or SSG bug that shows zero results by default.
Review submission loop is broken. Users can "Submit a Review" but reviews don't visibly appear on MSP profiles — no user-generated content surface visible on the KMT profile despite "60 reviews" being cited.
The Red Flag Scanner has no visible output area. The page loads a textarea and a disclaimer, but there's no AI or logic powering a visible result — unclear if it works without interacting with it.
Navigation is overloaded. Primary nav has 9+ clickable items at the top level including a mega-menu of all 7 tools — cognitive load is high.
Duplicate content blocks. The homepage shows the same article twice (e.g., "AI Didn't Break Australian IT") in "featured" and "recent" sections. Footer link lists are duplicated (mobile + desktop copies in the same HTML).
Implementation Plan — 5 Phases
Phase 1 — Fix the Broken Core (Week 1–2)
Priority: Critical. Zero growth happens on a broken foundation.

1.1 Fix the Directory Filter Bug
The directory defaults to "No profiles match those filters" — a JS hydration or default-state bug.

Audit the filter component's initial state. Ensure default render shows all 94 MSPs unfiltered.
Add a working client-side filter by: location (state), size (SMB/Mid/Enterprise), rating threshold, and service type.
Add an <noscript> static fallback listing all MSPs for SEO.
1.2 Surface Reviews on MSP Profiles
The KMT profile shows "60 reviews" in the directory listing but the profile page shows no reviews.

Build a reviews display component on each MSP profile page.
If reviews are in a backend/CMS but not rendered, wire them through.
Add a review submission form directly on each MSP profile page (not just a site-wide link).
Display: reviewer role/level, tenure, star ratings per dimension, plain-text review.
1.3 Populate MSP Profile Data
Define a minimum viable MSP profile schema: description, location(s), size, services, certifications, culture tags, known red flags, Glassdoor/Indeed sentiment summary.
Prioritise top 20 MSPs by traffic/interest with richer profiles.
Add a "data confidence" badge system: 🔴 Sparse / 🟡 Estimated / 🟢 Verified instead of the vague "Legacy record" text.
1.4 Verify Tool Functionality
Test all 7 tools in a real browser (Red Flag Scanner, Contract Grader, Health Score, etc.).
Confirm the AI/logic layer works end-to-end and outputs are visible.
Add a loading indicator and sample output to each tool landing page so users know what to expect before interacting.
Phase 2 — Navigation & UX Overhaul (Week 2–3)
Priority: High. The nav is the site's front door and it's overwhelming.

2.1 Restructure Primary Navigation
Current: Guide | The Ledger | Compare | Directory | Scanner | Cost Model | Scorecard | Grader | View all

Proposed (5 top-level items):


The Ledger (MSP ratings & profiles)
Tools (mega-menu: all 7 tools)
Analysis (325 articles by category)
Salary Data (transparency board + guide)
For Operators (operator growth playbook)
2.2 Homepage Restructure
Current homepage: hero → featured articles → operator section → learning path → recent articles → top MSPs → tools grid → newsletter → salary CTA → "at a glance" → more recent articles.

This is unfocused. Proposed structure:

Hero — single clear value prop with 3 CTA paths: "Find an MSP", "Check a Contract", "See Salary Data"
The Ledger — top 5 rated MSPs with link to full directory
7 Tools — card grid (currently buried below the fold)
Latest Investigations — top 3 original editorial pieces
Learning Path — for new visitors
Salary Board teaser — anonymous submission CTA
Newsletter signup — single, not repeated
2.3 Fix Duplicate Content Blocks
Remove the second "Newest must-reads" block (lines 293-303 in the homepage) that duplicates "Latest" from earlier.
Remove duplicate footer link columns (single semantic footer, CSS-responsive, no DOM duplication).
Phase 3 — Data Depth & Community Trust (Week 3–5)
Priority: High. Thin data is the biggest trust gap.

3.1 Salary Transparency Board — Make It Real
Display anonymised salary submissions in a sortable table: role, company, state, salary band, submission date.
Add: percentile bands, YoY trend if data volume allows.
Show submission count and last submission date prominently ("Last updated: 3 hours ago" style).
3.2 MSP Comparison Tool
/compare exists but its quality is unknown. Ensure:

Side-by-side comparison of 2–4 MSPs across: rating, size, services, known red flags, salary estimates, culture tags.
Shareable URL (query params) so comparisons can be linked/tweeted.
3.3 Community-Sourced Red Flag Library
Allow users to submit anonymised contract clauses they found problematic.
Build a public "Worst Clauses" library categorised by type (IP assignment, non-compete, unpaid overtime, etc.).
Feed these into the Red Flag Scanner's detection ruleset.
3.4 MSP Rating Submission Flow
Structured rating form: Overall, Culture, Pay Fairness, Career Growth, WLB, Management, Would Recommend.
Free-text "One thing to know before joining" field.
Anonymous but with role/level/tenure context for credibility.
Email verification to prevent brigading (no email stored publicly).
Phase 4 — SEO & Distribution (Week 4–6)
Priority: High. 325 articles is a huge SEO asset being under-exploited.

4.1 Article Schema Markup
Add Article, FAQPage, and HowTo schema to relevant pages. MSP profiles should get LocalBusiness schema with aggregateRating.

4.2 Internal Linking Overhaul
Every article should link to ≥3 related articles and ≥1 tool.
Every tool should link to 2–3 articles that explain the problem it solves.
Every MSP profile should link to relevant contract/salary articles.
4.3 Programmatic SEO for MSP Profiles
Ensure each of the 94 MSP profiles has a unique, keyword-rich <title> and <meta description> using dynamic data: [MSP Name] Reviews, Salary & Red Flags | The MSP Playbook.
Add FAQ sections to high-traffic MSP profiles (KMT, Macquarie, Kinetic IT) answering "Is [MSP] a good place to work?", "What's [MSP]'s salary range?", etc.
4.4 Category Landing Pages
/category/contracts-legal, /category/career etc. should be proper landing pages with a category intro, featured articles, and tool recommendations — not just article lists.
4.5 Canonical Articles for High-Intent Keywords
Target missing high-intent Australian IT keywords:

"MSP salary Australia 2026" (salary guide already exists — optimise it)
"Is [Company] a good employer" pages for each of the 94 MSPs
"MSP contract checklist Australia" (contract red flags article — optimise)
Phase 5 — Monetisation & Sustainability (Week 6–8)
Priority: Medium. Sustainability without compromising editorial independence.

IMPORTANT

All monetisation must be clearly disclosed and never alter editorial scores or ratings.

5.1 "Featured Employer" Programme (MSP-side)
MSPs can pay to have a verified, richer profile with a "Featured" badge.
Clearly disclosed as commercial. Does NOT affect editorial score.
Includes: job listings integration, a branded "Why Work Here" section, direct candidate contact form.
5.2 Job Board Integration
Integrate Seek/LinkedIn job listings per MSP profile page (affiliate or direct).
"Current openings at [MSP]" section at the bottom of each profile.
Potential revenue: affiliate commission per click/application.
5.3 Recruiter/Operator Reports
Gated PDF reports: "The Australian MSP Salary Report Q3 2026" — $49–$99 for operators/recruiters.
"MSP Competitive Intelligence Brief" — company-level analysis for HR/procurement teams.
Built from the site's existing editorial data, no new research needed.
5.4 Newsletter Sponsorship
Weekly newsletter to X subscribers — offer single sponsor slot per issue.
Must be relevant (HR tools, recruitment platforms, IT training providers).
Clearly labelled "Sponsored".
Open Questions
IMPORTANT

Decisions needed before Phase 3 and Phase 5 begin.

What platform/CMS does the site run on? (Appears to be a static site generator — Jekyll, Eleventy, or similar). This determines how profiles, reviews, and real-time salary data can be stored and served.
Is there a backend/database for review storage? The salary board and MSP reviews need persistence — is this currently handled, or are submissions going to a Google Form/Airtable?
Is the Red Flag Scanner AI-powered server-side, or purely client-side pattern matching? This affects how it can be improved and what it costs to run at scale.
What's the current monthly traffic and top landing pages? This determines which Phase 4 SEO bets have the highest leverage.
What's the business model goal? Pure editorial/brand, lead-gen, SaaS-adjacent, or advertising? This shapes how aggressively Phase 5 is pursued.
Phased Delivery Summary
Phase	Focus	Duration	Impact
1	Fix broken core (directory, profiles, tools)	1–2 weeks	Critical — unblocks trust
2	Navigation & homepage UX	1–2 weeks	High — improves conversion
3	Data depth & community	2–3 weeks	High — builds moat
4	SEO & distribution	2–3 weeks	High — compounds over time
5	Monetisation	2–3 weeks	Medium — enables sustainability
