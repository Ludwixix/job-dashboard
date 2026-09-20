/**
 * multiIndustryParserConfig.js
 * Multi-industry taxonomy and lexicon configuration mapping skills, titles,
 * and detection keywords across key employment sectors.
 */

export const MULTI_INDUSTRY_PARSER_CONFIG = {
  'Healthcare & Medical': {
    titles: [
      'Clinical Nurse Specialist', 'Registered Nurse', 'Nurse Unit Manager',
      'Associate Nurse Unit Manager', 'Clinical Care Coordinator', 'Triage Nurse',
      'Enrolled Nurse', 'Nurse Practitioner', 'Physiotherapist', 'Hospital Administrator',
      'Healthcare Coordinator', 'Aged Care Nurse'
    ],
    skills: [
      'AHPRA Registered Nurse', 'Acute Patient Assessment', 'Emergency Triage',
      'Clinical Governance', 'Medication Administration', 'EMR / Cerner',
      'Wound Care', 'Infection Control', 'Cannulation', 'BLS / ALS',
      'Care Planning', 'Patient Advocacy', 'Palliative Care', 'IV Cannulation'
    ],
    keywords: ['nurse', 'nursing', 'ahpra', 'triage', 'hospital', 'clinical', 'patient', 'medical', 'ward', 'icu', 'medication', 'allied health', 'physiotherapy', 'aged care', 'healthcare', 'health service', 'epworth', 'emergency triage']
  },
  'Technology & IT': {
    titles: [
      'Senior Systems Engineer', 'Cloud Infrastructure Engineer', 'DevOps Engineer',
      'Full Stack Developer', 'Software Engineer', 'Senior Software Engineer',
      'Backend Developer', 'Frontend Developer', 'Lead Software Engineer',
      'Systems Administrator', 'Solutions Architect',
      'Platform Engineer', 'Site Reliability Engineer', 'IT Operations Lead'
    ],
    skills: [
      'Microsoft 365', 'Azure', 'AWS', 'Kubernetes', 'Docker',
      'PowerShell', 'Active Directory', 'Windows Server', 'Linux',
      'Python', 'CI/CD', 'Terraform', 'PostgreSQL', 'Networking', 'Firewalls', 'Security',
      'React', 'Node.js', 'TypeScript', 'JavaScript', 'REST APIs', 'Git'
    ],
    keywords: ['software', 'cloud', 'developer', 'devops', 'azure', 'aws', 'systems engineer', 'infrastructure', 'm365', 'powershell', 'active directory', 'network', 'linux', 'kubernetes', 'full stack', 'software engineer', 'react', 'node', 'typescript', 'backend', 'frontend']
  },
  'Finance & Accounting': {
    titles: [
      'Senior Financial Accountant', 'Management Accountant', 'Finance Manager',
      'Commercial Analyst', 'Financial Controller', 'Tax Accountant', 'FP&A Manager',
      'Bookkeeper', 'Payroll Officer', 'Credit Risk Analyst', 'Internal Auditor'
    ],
    skills: [
      'CPA / CA Qualified', 'Financial Modeling', 'FP&A & Budgeting',
      'Variance Analysis', 'SAP ERP', 'Xero', 'BAS / GST', 'Tax Compliance',
      'Balance Sheet Reconciliation', 'Statutory Reporting', 'Internal Controls',
      'General Ledger', 'Accounts Payable', 'Accounts Receivable'
    ],
    keywords: ['accountant', 'accounting', 'cpa', 'ca qualified', 'chartered accountant', 'financial', 'finance', 'ledger', 'payroll', 'tax', 'bas', 'audit', 'bookkeeper', 'cfo', 'balance sheet', 'reconciliation']
  },
  'Construction & Trades': {
    titles: [
      'Site Supervisor', 'Construction Project Manager', 'Site Manager',
      'Site Foreman', 'Contracts Administrator', 'Estimator', 'Civil Project Manager',
      'Building Inspector', 'Fitout Supervisor'
    ],
    skills: [
      'White Card (CPCCWHS1001)', 'SafeWork WHS', 'SWMS Documentation',
      'Site Supervision', 'Subcontractor Management', 'Procore', 'Trade Coordination',
      'Quality Assurance', 'Defect Management', 'First Aid', 'Contract Administration'
    ],
    keywords: ['construction', 'builder', 'site supervisor', 'foreman', 'trades', 'carpenter', 'electrician', 'plumber', 'white card', 'swms', 'whs', 'ohs', 'procore', 'estimator', 'quantity surveyor', 'building']
  },
  'Education': {
    titles: [
      'Secondary School Teacher', 'Primary School Teacher', 'Learning & Development Specialist',
      'Curriculum Lead', 'Instructional Designer', 'Academic Coordinator',
      'Early Childhood Educator', 'Education Consultant'
    ],
    skills: [
      'Curriculum Design', 'Instructional Design', 'LMS Administration',
      'Adult Learning Theory', 'Workshop Facilitation', 'VIT Registration',
      'Classroom Management', 'Student Assessment'
    ],
    keywords: ['teacher', 'teaching', 'educator', 'curriculum', 'school', 'classroom', 'student', 'instructional designer', 'tafe', 'vit', 'pedagogy']
  },
  'Legal': {
    titles: [
      'Senior Legal Counsel', 'Corporate Lawyer', 'Compliance Manager',
      'Contracts Specialist', 'Solicitor', 'Paralegal', 'Legal Operations Lead'
    ],
    skills: [
      'Contract Drafting & Negotiation', 'Regulatory Compliance', 'Commercial Law',
      'Corporate Governance', 'Privacy Act', 'Legal Risk Assessment'
    ],
    keywords: ['solicitor', 'lawyer', 'counsel', 'legal', 'paralegal', 'litigation', 'compliance', 'contracts', 'conveyancer', 'juris']
  },
  'HR & People': {
    titles: [
      'People & Culture Manager', 'HR Business Partner', 'Talent Acquisition Lead',
      'HR Operations Specialist', 'Employee Relations Lead', 'Recruitment Consultant'
    ],
    skills: [
      'Talent Acquisition', 'HR Strategy', 'Employee Relations',
      'Fair Work Act', 'HRIS (Workday/BambooHR)', 'Performance Management',
      'Culture & Engagement', 'Onboarding'
    ],
    keywords: ['human resources', 'talent acquisition', 'recruiter', 'recruitment', 'people & culture', 'hris', 'employee relations', 'fair work', 'hr business partner']
  },
  'Marketing & Sales': {
    titles: [
      'Digital Marketing Manager', 'Growth Lead', 'Account Executive',
      'Brand Strategist', 'Performance Marketing Manager', 'Campaign Manager',
      'SEO Specialist', 'Business Development Manager'
    ],
    skills: [
      'Performance Marketing', 'Google Ads / Meta Ads', 'SEO / SEM Strategy',
      'HubSpot / Marketo', 'Growth Funnel Optimization', 'Google Analytics 4',
      'Content Marketing', 'Email Marketing'
    ],
    keywords: ['marketing', 'seo', 'sem', 'campaign', 'sales', 'crm', 'hubspot', 'social media', 'growth', 'brand', 'advertising', 'copywriting']
  },
  'Technology & IT': {
    titles: [
      'Senior Systems Engineer', 'Cloud Infrastructure Engineer', 'DevOps Engineer',
      'Full Stack Developer', 'Systems Administrator', 'Solutions Architect',
      'Platform Engineer', 'Site Reliability Engineer', 'IT Operations Lead'
    ],
    skills: [
      'Microsoft 365', 'Azure', 'AWS', 'Kubernetes', 'Docker',
      'PowerShell', 'Active Directory', 'Windows Server', 'Linux',
      'Python', 'CI/CD', 'Terraform', 'PostgreSQL', 'Networking', 'Firewalls', 'Security'
    ],
    keywords: ['software', 'cloud', 'developer', 'devops', 'azure', 'aws', 'systems engineer', 'infrastructure', 'm365', 'powershell', 'active directory', 'network', 'linux', 'kubernetes', 'full stack']
  }
};

// Aliases for short-form industry labels
MULTI_INDUSTRY_PARSER_CONFIG['Healthcare'] = MULTI_INDUSTRY_PARSER_CONFIG['Healthcare & Medical'];
MULTI_INDUSTRY_PARSER_CONFIG['Technology'] = MULTI_INDUSTRY_PARSER_CONFIG['Technology & IT'];
MULTI_INDUSTRY_PARSER_CONFIG['Finance'] = MULTI_INDUSTRY_PARSER_CONFIG['Finance & Accounting'];
MULTI_INDUSTRY_PARSER_CONFIG['Trades'] = MULTI_INDUSTRY_PARSER_CONFIG['Construction & Trades'];
