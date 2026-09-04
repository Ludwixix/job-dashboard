/**
 * multiIndustryJobData.js
 * Comprehensive multi-industry job opportunities across Healthcare, Finance, Marketing,
 * Construction, HR, Legal, Education, Trades, and Technology.
 */

export const MULTI_INDUSTRY_JOBS = [
  // ── HEALTHCARE & MEDICAL ──────────────────────────────────────────
  {
    id: 'health_01',
    company: 'The Royal Melbourne Hospital',
    title: 'Clinical Nurse Specialist — Acute Care / Emergency',
    location: 'Parkville, VIC 3052',
    date: new Date(Date.now() - 1000 * 60 * 60 * 12).toISOString().split('T')[0],
    salary: '$96,000 – $108,000 + Super + Salary Packaging',
    source: 'Careers Victoria / RMH',
    stream: 'Healthcare & Medical',
    industry: 'Healthcare & Medical',
    remote: false,
    portalLink: 'https://www.thermh.org.au/careers',
    notes: 'AHPRA Registered Nurse with acute care or ED experience. Rotating roster, generous salary packaging, supportive clinical leadership team. Central Parkville location near public transport.',
    why: 'Direct hospital role with structured clinical advancement and salary packaging benefits.'
  },
  {
    id: 'health_02',
    company: 'Epworth Healthcare',
    title: 'Associate Nurse Unit Manager (ANUM) — Surgical Ward',
    location: 'Richmond, VIC 3121',
    date: new Date(Date.now() - 1000 * 60 * 60 * 36).toISOString().split('T')[0],
    salary: '$105,000 – $118,000 + Super',
    source: 'SEEK Healthcare',
    stream: 'Healthcare & Medical',
    industry: 'Healthcare & Medical',
    remote: false,
    portalLink: 'https://www.epworth.org.au/careers',
    notes: 'Lead clinical shifts, mentor graduate nurses, coordinate multidisciplinary patient discharges. Requires AHPRA registration and surgical nursing background.',
    why: 'Premier private hospital network with excellent nurse-to-patient ratios.'
  },
  {
    id: 'health_03',
    company: 'Alfred Health',
    title: 'Physiotherapist / Allied Health Specialist',
    location: 'Prahran, VIC 3181',
    date: new Date(Date.now() - 1000 * 60 * 60 * 48).toISOString().split('T')[0],
    salary: '$88,000 – $99,000 + Super',
    source: 'Alfred Careers',
    stream: 'Healthcare & Medical',
    industry: 'Healthcare & Medical',
    remote: false,
    portalLink: 'https://www.alfredhealth.org.au/careers',
    notes: 'Inpatient rehabilitation and musculoskeletal care. Multidisciplinary team collaboration, ongoing professional development budget.',
    why: 'Leading trauma and rehabilitation centre in Melbourne inner-south.'
  },

  // ── FINANCE, ACCOUNTING & BANKING ─────────────────────────────────
  {
    id: 'fin_01',
    company: 'Macquarie Group',
    title: 'Senior Financial Analyst — FP&A & Corporate Advisory',
    location: 'Melbourne CBD, VIC 3000',
    date: new Date(Date.now() - 1000 * 60 * 60 * 8).toISOString().split('T')[0],
    salary: '$125,000 – $145,000 + Bonus + Super',
    source: 'LinkedIn Direct',
    stream: 'Finance & Accounting',
    industry: 'Finance & Accounting',
    remote: true,
    portalLink: 'https://www.macquarie.com/au/en/careers.html',
    notes: 'CPA/CA qualified with 4+ years in financial modeling, variance analysis, budgeting, and stakeholder presentations. Hybrid 3 days in CBD office.',
    why: 'Tier-1 investment bank with competitive bonus scheme and career progression.'
  },
  {
    id: 'fin_02',
    company: 'MYOB',
    title: 'Senior Management Accountant',
    location: 'Cremorne, VIC 3121',
    date: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString().split('T')[0],
    salary: '$110,000 – $125,000 + Super',
    source: 'SEEK Finance',
    stream: 'Finance & Accounting',
    industry: 'Finance & Accounting',
    remote: true,
    portalLink: 'https://www.myob.com/au/about/careers',
    notes: 'Lead month-end reporting, business unit financial forecasting, tax compliance, and automated accounting workflows. CA/CPA required.',
    why: 'Leading Australian SaaS fintech company with flexible hybrid culture.'
  },
  {
    id: 'fin_03',
    company: 'ANZ Banking Group',
    title: 'Commercial Credit Risk Analyst',
    location: 'Docklands, VIC 3008',
    date: new Date(Date.now() - 1000 * 60 * 60 * 72).toISOString().split('T')[0],
    salary: '$115,000 – $130,000 + Super',
    source: 'ANZ Careers',
    stream: 'Finance & Accounting',
    industry: 'Finance & Accounting',
    remote: true,
    portalLink: 'https://www.anz.com.au/careers/',
    notes: 'Evaluate credit underwriting for middle-market corporate portfolios. Balance sheet analysis, debt covenants, risk modeling.',
    why: 'Major Australian banking institution with comprehensive staff benefits.'
  },

  // ── SALES, MARKETING & GROWTH ─────────────────────────────────────
  {
    id: 'mkt_01',
    company: 'REA Group',
    title: 'Senior Digital Marketing & Growth Manager',
    location: 'Richmond, VIC 3121',
    date: new Date(Date.now() - 1000 * 60 * 60 * 14).toISOString().split('T')[0],
    salary: '$130,000 – $145,000 + STI + Super',
    source: 'LinkedIn Jobs',
    stream: 'Marketing & Sales',
    industry: 'Marketing & Sales',
    remote: true,
    portalLink: 'https://www.rea-group.com/careers/',
    notes: 'Drive performance marketing across paid search, social, SEO, and omnichannel campaigns. Proven track record scaling acquisition ROI and managing $1M+ digital ad budgets.',
    why: 'Market-leading digital property portal with high-energy growth culture.'
  },
  {
    id: 'mkt_02',
    company: 'Canva',
    title: 'Content & Brand Strategy Lead',
    location: 'Melbourne, VIC (Remote Friendly)',
    date: new Date(Date.now() - 1000 * 60 * 60 * 28).toISOString().split('T')[0],
    salary: '$135,000 – $155,000 + Equity + Super',
    source: 'Canva Careers',
    stream: 'Marketing & Sales',
    industry: 'Marketing & Sales',
    remote: true,
    portalLink: 'https://www.canva.com/careers/',
    notes: 'Oversee editorial direction, multi-channel product marketing campaigns, and global brand storytelling. Experience in high-growth tech or creative agencies.',
    why: 'Global design unicorn offering equity grants and top-tier work-life balance.'
  },
  {
    id: 'mkt_03',
    company: 'HubSpot Australia',
    title: 'Enterprise Account Executive (ANZ)',
    location: 'Melbourne CBD, VIC 3000',
    date: new Date(Date.now() - 1000 * 60 * 60 * 50).toISOString().split('T')[0],
    salary: '$120,000 Base / $240,000 OTE + Super',
    source: 'HubSpot Careers',
    stream: 'Marketing & Sales',
    industry: 'Marketing & Sales',
    remote: true,
    portalLink: 'https://www.hubspot.com/careers',
    notes: 'Manage end-to-end sales cycles with mid-market and enterprise accounts across Australia and NZ. Strong track record exceeding SaaS quotas.',
    why: 'Uncapped commission structure with world-class CRM platform training.'
  },

  // ── CONSTRUCTION, ENGINEERING & TRADES ────────────────────────────
  {
    id: 'con_01',
    company: 'Lendlease',
    title: 'Senior Construction Project Manager — Commercial Builds',
    location: 'Melbourne CBD, VIC 3000',
    date: new Date(Date.now() - 1000 * 60 * 60 * 18).toISOString().split('T')[0],
    salary: '$160,000 – $190,000 + Super + Vehicle Allowance',
    source: 'SEEK Construction',
    stream: 'Construction & Trades',
    industry: 'Construction & Trades',
    remote: false,
    portalLink: 'https://www.lendlease.com/au/careers/',
    notes: 'Lead delivery of major tier-1 commercial developments ($50M+). Oversee site safety, subcontractor procurement, budget milestones, and client stakeholder relations.',
    why: 'Global tier-1 builder with iconic landmark infrastructure projects in Victoria.'
  },
  {
    id: 'con_02',
    company: 'Multiplex Australasia',
    title: 'Site Engineer / Project Engineer — Structural & Civil',
    location: 'Southbank, VIC 3006',
    date: new Date(Date.now() - 1000 * 60 * 60 * 40).toISOString().split('T')[0],
    salary: '$110,000 – $130,000 + Super',
    source: 'Multiplex Careers',
    stream: 'Construction & Trades',
    industry: 'Construction & Trades',
    remote: false,
    portalLink: 'https://www.multiplex.global/careers/',
    notes: 'Degree in Civil/Structural Engineering or Construction Management. Site QA, RFIs, scheduling, subcontractor coordination on high-rise residential project.',
    why: 'Direct hands-on delivery with leading international contractor.'
  },
  {
    id: 'con_03',
    company: 'Metro Trains Melbourne',
    title: 'Licensed Electrical Supervisor / Rail Systems',
    location: 'Melbourne CBD / St Albans Depot, VIC',
    date: new Date(Date.now() - 1000 * 60 * 60 * 60).toISOString().split('T')[0],
    salary: '$115,000 – $135,000 + Overtime + Super',
    source: 'Metro Trains Careers',
    stream: 'Construction & Trades',
    industry: 'Construction & Trades',
    remote: false,
    portalLink: 'https://www.metrotrains.com.au/careers/',
    notes: 'A-Grade Electrician license with supervisory experience in industrial, substation, or transport infrastructure. Excellent enterprise agreement benefits.',
    why: 'Long-term government franchise contract with substantial overtime potential.'
  },

  // ── HUMAN RESOURCES & PEOPLE OPERATIONS ───────────────────────────
  {
    id: 'hr_01',
    company: 'BHP',
    title: 'Senior People & Culture Business Partner (HRBP)',
    location: 'Melbourne CBD, VIC 3000',
    date: new Date(Date.now() - 1000 * 60 * 60 * 20).toISOString().split('T')[0],
    salary: '$140,000 – $160,000 + STI + Super',
    source: 'BHP Careers',
    stream: 'HR & Operations',
    industry: 'HR & Operations',
    remote: true,
    portalLink: 'https://www.bhp.com/careers',
    notes: 'Partner with executive business unit leaders on workforce planning, talent development, employee relations, Fair Work compliance, and organizational design.',
    why: 'ASX top-5 resources leader with industry-leading parental leave and flexible work.'
  },
  {
    id: 'hr_02',
    company: 'Coles Group',
    title: 'Talent Acquisition Lead — Corporate & Digital',
    location: 'Hawthorn East, VIC 3123',
    date: new Date(Date.now() - 1000 * 60 * 60 * 32).toISOString().split('T')[0],
    salary: '$115,000 – $130,000 + Super + Staff Discounts',
    source: 'SEEK HR',
    stream: 'HR & Operations',
    industry: 'HR & Operations',
    remote: true,
    portalLink: 'https://www.colescareers.com.au/',
    notes: 'Lead end-to-end recruitment for corporate headquarters and technology functions. Candidate sourcing, stakeholder management, recruitment metrics.',
    why: 'Iconic Australian retailer with supportive culture and generous employee perks.'
  },

  // ── LEGAL, GOVERNANCE & COMPLIANCE ────────────────────────────────
  {
    id: 'leg_01',
    company: 'Herbert Smith Freehills',
    title: 'Senior Legal Counsel — Corporate & Commercial',
    location: 'Melbourne CBD, VIC 3000',
    date: new Date(Date.now() - 1000 * 60 * 60 * 22).toISOString().split('T')[0],
    salary: '$160,000 – $190,000 + Bonus + Super',
    source: 'LinkedIn Legal',
    stream: 'Legal & Governance',
    industry: 'Legal & Governance',
    remote: true,
    portalLink: 'https://www.herbertsmithfreehills.com/careers',
    notes: 'Admitted Australian legal practitioner with 4+ years PQE. Drafting enterprise commercial contracts, M&A due diligence, regulatory advice.',
    why: 'Top-tier global law firm known for complex corporate deals.'
  },

  // ── EDUCATION & TRAINING ──────────────────────────────────────────
  {
    id: 'edu_01',
    company: 'The University of Melbourne',
    title: 'Learning & Development Specialist / Academic Lead',
    location: 'Parkville, VIC 3052',
    date: new Date(Date.now() - 1000 * 60 * 60 * 30).toISOString().split('T')[0],
    salary: '$108,000 – $122,000 + 17% Superannuation',
    source: 'UniMelb Careers',
    stream: 'Education & Training',
    industry: 'Education & Training',
    remote: true,
    portalLink: 'https://about.unimelb.edu.au/careers',
    notes: 'Design curriculum programs, digital learning workflows, and faculty pedagogical training. Generous 17% employer superannuation.',
    why: 'Australia’s #1 ranked university offering 17% super and flexible academic campus.'
  }
];
