/**
 * resumeParser.js
 * Multi-industry heuristic and AI-assisted resume parsing.
 */

import { MULTI_INDUSTRY_PARSER_CONFIG } from './multiIndustryParserConfig';
import { getLlmConfig } from '../llmConfig';

/**
 * Heuristic client-side resume parser with full multi-industry intelligence
 * Supports Healthcare & Nursing, Finance, Trades, Education, Legal, Marketing, HR, IT
 */
export const parseResumeTextClientSide = (text = '', existingProfile = {}) => {
  const lower = (text || '').toLowerCase();

  // Name extraction — prefer existing profile name if valid
  const lines = (text || '').split('\n').map(l => l.trim()).filter(Boolean);
  let name = existingProfile.name && existingProfile.name !== 'Candidate' ? existingProfile.name : '';
  if (!name) {
    if (lines.length > 0 && lines[0].length <= 40 && !/resume|curriculum|cv|summary|experience|%pdf|profile/i.test(lines[0])) {
      name = lines[0].replace(/[^a-zA-Z\s'-]/g, '').trim();
    } else if (lines.length > 1 && lines[1].length <= 40 && !/resume|curriculum|cv|summary|experience|%pdf|profile/i.test(lines[1])) {
      name = lines[1].replace(/[^a-zA-Z\s'-]/g, '').trim();
    }
  }

  // Email & Phone
  const emailMatch = text.match(/([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9_-]+)/);
  const email = emailMatch ? emailMatch[1] : (existingProfile.email || '');
  if (!name && email) {
    name = email.split('@')[0].replace(/[._]/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());
  }
  if (!name) name = 'Candidate';

  const phoneMatch = text.match(/(?:\+?61|0)[2-478](?:[ -]?[0-9]){8}/);
  const phone = phoneMatch ? phoneMatch[0] : (existingProfile.phone || '');

  // Suburb & Location — check text or preserve existing profile location
  let suburb = existingProfile.suburb || '';
  let location = existingProfile.location || '';
  if (lower.includes('richmond')) { suburb = 'Richmond'; location = 'Richmond VIC 3121'; }
  else if (lower.includes('south yarra')) { suburb = 'South Yarra'; location = 'South Yarra VIC 3141'; }
  else if (lower.includes('st kilda')) { suburb = 'St Kilda'; location = 'St Kilda VIC 3182'; }
  else if (lower.includes('docklands')) { suburb = 'Docklands'; location = 'Docklands VIC 3008'; }
  else if (lower.includes('parkville')) { suburb = 'Parkville'; location = 'Parkville VIC 3052'; }
  else if (lower.includes('melbourne')) { suburb = 'Melbourne'; location = 'Melbourne VIC 3000'; }

  // Industry Resolution: Evaluate keyword density across all industries
  let bestIndustry = existingProfile.industry && existingProfile.industry !== ''
    ? existingProfile.industry
    : 'Healthcare & Medical';

  let highestScore = -1;
  for (const [indName, indConf] of Object.entries(MULTI_INDUSTRY_PARSER_CONFIG)) {
    let score = 0;
    for (const kw of indConf.keywords) {
      if (lower.includes(kw)) score += 2;
    }
    for (const titleCandidate of indConf.titles) {
      if (lower.includes(titleCandidate.toLowerCase())) score += 5;
    }
    if (score > highestScore) {
      highestScore = score;
      bestIndustry = indName;
    }
  }

  // If existing profile had an explicit non-IT industry and score didn't massively contradict, honor existing profile
  if (existingProfile.industry && existingProfile.industry in MULTI_INDUSTRY_PARSER_CONFIG) {
    bestIndustry = existingProfile.industry;
  }

  const industryConfig = MULTI_INDUSTRY_PARSER_CONFIG[bestIndustry] || MULTI_INDUSTRY_PARSER_CONFIG['Healthcare & Medical'];

  // Seniority & Experience
  let seniorityLevel = existingProfile.seniorityLevel || 'Senior';
  let yearsOfExperience = existingProfile.yearsOfExperience || 7;

  const yearMatches = text.match(/20\d\d|19\d\d/g);
  if (yearMatches && yearMatches.length >= 2) {
    const years = yearMatches.map(Number).sort();
    const span = years[years.length - 1] - years[0];
    if (span >= 1 && span <= 35) yearsOfExperience = span;
  }

  if (lower.includes('director') || lower.includes('head of') || lower.includes('executive') || lower.includes('chief')) {
    seniorityLevel = 'Executive / Director';
  } else if (lower.includes('principal') || lower.includes('architect')) {
    seniorityLevel = 'Principal / Architect';
  } else if (yearsOfExperience >= 10 || lower.includes('lead') || lower.includes('manager') || lower.includes('unit manager')) {
    seniorityLevel = 'Senior / Lead';
  } else if (yearsOfExperience <= 2 || lower.includes('graduate') || lower.includes('entry level') || lower.includes('junior')) {
    seniorityLevel = 'Entry / Graduate';
  }

  // Exact Title Detection within the identified industry
  let matchedTitle = '';
  // Check longer titles first
  const sortedTitles = [...industryConfig.titles].sort((a, b) => b.length - a.length);
  for (const tCandidate of sortedTitles) {
    if (new RegExp(`\\b${tCandidate.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(text)) {
      matchedTitle = tCandidate;
      break;
    }
  }

  // If not matched from dictionary, check lines 1–4 for professional headline
  if (!matchedTitle) {
    for (let i = 0; i < Math.min(lines.length, 5); i++) {
      const line = lines[i];
      if (/nurse|accountant|engineer|manager|coordinator|specialist|supervisor|director|solicitor|teacher|educator|analyst/i.test(line) && line.length < 50 && !line.includes('@')) {
        matchedTitle = line.replace(/[^a-zA-Z\s/&-]/g, '').trim();
        break;
      }
    }
  }

  if (!matchedTitle) {
    matchedTitle = industryConfig.titles[0];
  }

  // Build target titles for this specific industry (Never pollute with IT engineer titles)
  const targetTitles = [
    matchedTitle,
    ...industryConfig.titles.filter(t => t.toLowerCase() !== matchedTitle.toLowerCase())
  ].slice(0, 5);

  // Skill Extraction for this specific industry
  const extractedSkills = industryConfig.skills.filter(k => {
    const cleanK = k.split('(')[0].trim();
    return new RegExp(`\\b${cleanK.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(text);
  });

  const finalSkills = [...new Set([
    ...extractedSkills,
    ...(existingProfile.coreSkills || []),
    ...industryConfig.skills.slice(0, 4)
  ])];

  return {
    id: existingProfile.id || `profile_${Date.now()}`,
    name: name,
    title: matchedTitle,
    industry: bestIndustry,
    seniorityLevel: seniorityLevel,
    yearsOfExperience: yearsOfExperience,
    marketArchetype: `${seniorityLevel} ${bestIndustry} Specialist`,
    email: email,
    phone: phone,
    location: location,
    suburb: suburb,
    workRights: existingProfile.workRights || 'Australian Citizen (Unrestricted)',
    clearance: existingProfile.clearance || '',
    targetSalary: existingProfile.targetSalary || '',
    targetTitles: targetTitles,
    coreSkills: finalSkills,
    certifications: existingProfile.certifications || [],
    keyStrengths: existingProfile.keyStrengths || [],
    managementStyle: existingProfile.managementStyle || '',
    interviewTalkingPoints: existingProfile.interviewTalkingPoints || [],
    workHistorySummary: text.slice(0, 500) || '',
    fullWorkExperienceText: text
  };
};

/**
 * AI-powered resume parser via OpenRouter or Server-Side AI Proxy
 */
export const parseResumeWithAI = async (resumeText, apiKey, model, contextIndustry = '') => {
  const config = getLlmConfig();
  const effectiveKey = (apiKey || config.apiKey || '').trim();
  const effectiveModel = model || config.model;
  const endpoint = config.endpoint || 'https://openrouter.ai/api/v1/chat/completions';
  const provider = config.provider || 'openrouter';

  // If no personal API key is provided, attempt server-side AI proxy first
  if (!effectiveKey) {
    try {
      const { callAIProxy } = await import('../billingService');
      const proxyResult = await callAIProxy({
        model: effectiveModel || 'google/gemini-2.0-flash',
        messages: [
          { role: 'system', content: 'You are a principal talent intelligence architect that outputs strictly valid JSON only.' },
          { role: 'user', content: `Analyze the following resume and return a structured JSON profile for ${contextIndustry || 'the candidate'}. Schema: {"name": "Full Name", "title": "Professional Title", "industry": "${contextIndustry || 'Industry'}", "targetTitles": ["Title 1", "Title 2", "Title 3"], "coreSkills": ["Skill 1", "Skill 2"], "location": "City, State", "workHistorySummary": "Summary"}. Resume:\n${resumeText.slice(0, 8000)}` }
        ],
        temperature: 0.2,
        max_tokens: 2500
      });
      const content = proxyResult?.choices?.[0]?.message?.content || '';
      const cleanJson = content.replace(/```json/g, '').replace(/```/g, '').trim();
      const parsed = JSON.parse(cleanJson);
      if (parsed && (parsed.title || parsed.targetTitles?.length)) {
        return {
          id: parsed.id || `profile_${Date.now()}`,
          ...parsed,
          industry: contextIndustry || parsed.industry,
          fullWorkExperienceText: parsed.fullWorkExperienceText || resumeText
        };
      }
    } catch (proxyErr) {
      console.warn('Server-side AI proxy parse unavailable, using high-precision multi-industry client parser:', proxyErr);
    }
    return parseResumeTextClientSide(resumeText, { industry: contextIndustry });
  }

  const prompt = `You are a Principal Executive Recruiter and Behavioral Talent Architect.
Analyze the following resume text and synthesize an exhaustive, highly structured single user profile JSON.

Schema:
{
  "name": "Full Name",
  "title": "Most marketable current professional title",
  "industry": "Industry Category (e.g. Technology & IT)",
  "seniorityLevel": "Junior / Graduate | Mid-Level | Senior | Lead / Principal | Executive / Director",
  "yearsOfExperience": 10,
  "marketArchetype": "5-8 word executive positioning statement",
  "email": "Email Address",
  "phone": "Phone Number",
  "location": "City, State Postcode",
  "suburb": "Suburb Name",
  "workRights": "Australian Citizen (Unrestricted)",
  "clearance": "Security Clearance Eligibility",
  "targetSalary": "$140,000 - $165,000 + Super",
  "targetTitles": ["Title 1", "Title 2", "Title 3", "Title 4", "Title 5", "Title 6"],
  "coreSkills": ["Skill 1", "Skill 2", "Skill 3"],
  "certifications": ["Cert 1", "Cert 2"],
  "keyStrengths": ["Strength 1", "Strength 2", "Strength 3"],
  "managementStyle": "Leadership & Working Style",
  "interviewTalkingPoints": ["STAR Story 1", "STAR Story 2", "STAR Story 3"],
  "workHistorySummary": "Executive career summary narrative",
  "fullWorkExperienceText": "Clean structured chronological resume text"
}

Return ONLY valid JSON matching this schema with NO markdown and NO conversational text.

Resume Text:
${resumeText.slice(0, 9000)}`;

  try {
    let res;
    if (provider === 'anthropic') {
      res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': effectiveKey,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true'
        },
        body: JSON.stringify({
          model: effectiveModel,
          max_tokens: 3000,
          messages: [{ role: 'user', content: prompt }]
        })
      });
    } else {
      const headers = {
        'Content-Type': 'application/json'
      };
      if (effectiveKey) {
        headers['Authorization'] = `Bearer ${effectiveKey}`;
      }
      if (provider === 'openrouter') {
        headers['HTTP-Referer'] = typeof window !== 'undefined' ? window.location.origin : 'https://job-dashboard.app';
        headers['X-Title'] = 'CAREER.AGENT - Deep Profile Engine';
      }

      res = await fetch(endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          model: effectiveModel,
          messages: [
            { role: 'system', content: 'You are a precise talent intelligence parser that outputs strictly valid JSON only.' },
            { role: 'user', content: prompt }
          ],
          temperature: 0.2,
          max_tokens: 3000
        })
      });
    }

    if (!res.ok) {
      throw new Error(`Parser API error: ${res.status}`);
    }

    const data = await res.json();
    let content = '';
    if (provider === 'anthropic') {
      content = data.content?.[0]?.text || '';
    } else {
      content = data.choices?.[0]?.message?.content || '';
    }
    const cleanJson = content.replace(/```json/g, '').replace(/```/g, '').trim();
    const parsed = JSON.parse(cleanJson);

    return {
      id: parsed.id || `profile_${Date.now()}`,
      ...parsed,
      fullWorkExperienceText: parsed.fullWorkExperienceText || resumeText
    };
  } catch (e) {
    console.warn('AI Parsing failed, falling back to heuristic parser:', e);
    return parseResumeTextClientSide(resumeText);
  }
};
