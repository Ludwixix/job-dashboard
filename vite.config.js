import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { exec } from 'child_process'
import path from 'path'
import fs from 'fs'

// https://vite.dev/config/
export default defineConfig({
  base: process.env.GITHUB_PAGES === 'true' ? '/job-dashboard-react/' : '/',
  plugins: [
    react(),
    tailwindcss(),
    {
      name: 'background-scraper-middleware',
      configureServer(server) {
        // Serve pre-stored background scraped jobs on launch
        server.middlewares.use('/api/scraped-jobs', (req, res) => {
          const combinedJsonPath = path.resolve(__dirname, '../job-dashboard-site/scrapers/jobs_combined.json');
          const seekJsonPath = path.resolve(__dirname, '../job-dashboard-site/scrapers/jobs_seek.json');

          let jobs = [];
          if (fs.existsSync(combinedJsonPath)) {
            try {
              const raw = JSON.parse(fs.readFileSync(combinedJsonPath, 'utf8'));
              jobs = Array.isArray(raw) ? raw : (raw.jobs || []);
            } catch (e) {
              console.error("Error reading jobs_combined.json:", e);
            }
          } else if (fs.existsSync(seekJsonPath)) {
            try {
              const raw = JSON.parse(fs.readFileSync(seekJsonPath, 'utf8'));
              jobs = Array.isArray(raw) ? raw : (raw.jobs || []);
            } catch (e) {
              console.error("Error reading jobs_seek.json:", e);
            }
          }

          res.statusCode = 200;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ success: true, count: jobs.length, jobs }));
        });

        // Automated Application Pipeline Endpoint
        server.middlewares.use('/api/auto-apply', (req, res, next) => {
          if (req.method === 'POST') {
            let body = '';
            req.on('data', chunk => { body += chunk; });
            req.on('end', () => {
              try {
                const jobPayload = JSON.parse(body || '{}');
                const scriptPath = path.resolve(__dirname, '../job-dashboard-site/scrapers/auto_applier.py');
                const tempPayloadPath = path.resolve(__dirname, '../job-dashboard-site/scrapers/temp_job_payload.json');
                
                fs.writeFileSync(tempPayloadPath, JSON.stringify(jobPayload, null, 2));

                exec(`python3 "${scriptPath}"`, { cwd: path.resolve(__dirname, '../job-dashboard-site') }, (error, stdout, stderr) => {
                  if (error) {
                    console.error("Auto-apply execution error:", error, stderr);
                    res.statusCode = 500;
                    res.setHeader('Content-Type', 'application/json');
                    res.end(JSON.stringify({ error: error.message, details: stderr }));
                    return;
                  }

                  let outputData = {};
                  try {
                    const jsonMatch = stdout.match(/\{[\s\S]*\}/);
                    if (jsonMatch) {
                      outputData = JSON.parse(jsonMatch[0]);
                    }
                  } catch {
                    outputData = { details: stdout };
                  }

                  res.statusCode = 200;
                  res.setHeader('Content-Type', 'application/json');
                  res.end(JSON.stringify({
                    success: true,
                    applied_at: new Date().toISOString(),
                    job: jobPayload,
                    pipeline_result: outputData
                  }));
                });
              } catch (e) {
                res.statusCode = 400;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ error: e.message }));
              }
            });
          } else {
            next();
          }
        });

        // Trigger manual run on demand
        server.middlewares.use('/api/run-scraper', (req, res, next) => {
          if (req.method === 'POST') {
            const scriptPath = path.resolve(__dirname, '../job-dashboard-site/scrapers/scrape_seek_quick.py');
            const combinedJsonPath = path.resolve(__dirname, '../job-dashboard-site/scrapers/jobs_combined.json');

            exec(`python3 "${scriptPath}"`, { cwd: path.resolve(__dirname, '../job-dashboard-site') }, (error, _stdout, _stderr) => {
              if (error) {
                console.error("Scraper execution error:", error);
                res.statusCode = 500;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ error: error.message }));
                return;
              }

              let newJobs = [];
              if (fs.existsSync(combinedJsonPath)) {
                try {
                  const raw = JSON.parse(fs.readFileSync(combinedJsonPath, 'utf8'));
                  newJobs = Array.isArray(raw) ? raw : (raw.jobs || []);
                } catch (e) {
                  console.error("Error reading output JSON:", e);
                }
              }

              res.statusCode = 200;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ 
                success: true, 
                count: newJobs.length, 
                jobs: newJobs 
              }));
            });
          } else {
            next();
          }
        });
        // ── AI Document Generation Endpoint ──────────────────────────────────
        server.middlewares.use('/api/generate-docs', (req, res, next) => {
          if (req.method !== 'POST') { next(); return; }

          let body = '';
          req.on('data', chunk => { body += chunk; });
          req.on('end', async () => {
            try {
              const { job } = JSON.parse(body || '{}');
              if (!job) { res.statusCode = 400; res.end(JSON.stringify({ error: 'Missing job data' })); return; }

              // ── Read API key ──────────────────────────────────────────────
              let apiKey = process.env.OPENROUTER_API_KEY || '';
              if (!apiKey) {
                try {
                  const configPath = path.resolve('/home/s/.openclaw/openclaw.json');
                  if (fs.existsSync(configPath)) {
                    const cfg = JSON.parse(fs.readFileSync(configPath, 'utf8'));
                    apiKey = cfg?.models?.providers?.openrouter?.apiKey || '';
                  }
                } catch { /* silent */ }
              }
              if (!apiKey) {
                res.statusCode = 200;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ error: 'NO_API_KEY', message: 'OpenRouter API key not configured. Use the Gemini Gem button instead.' }));
                return;
              }

              // ── Read Master Resume source-of-truth ───────────────────────
              let masterResume = '';
              const masterResumePath = path.resolve('/home/s/.openclaw/workspace/job-dashboard-modular/Source of truth/Master Resume.md');
              if (fs.existsSync(masterResumePath)) {
                masterResume = fs.readFileSync(masterResumePath, 'utf8');
              }

              // ── Build best-in-class prompt ────────────────────────────────
              const systemPrompt = `You are an elite resume and cover letter writer with deep expertise in ATS optimisation, recruiter psychology, and technical hiring for IT and cloud engineering roles in Australia.

You produce documents that:
1. Pass ATS keyword matching: mirror exact technical terms and role-specific language from the job description naturally throughout the summary, skills, and experience sections — not just in a keyword list at the bottom
2. Survive the 7-second recruiter scan: the top third of the resume (name, title, summary) must hook immediately with real outcomes and numbers — never generic filler
3. Use result-first bullet structure: lead with the metric/outcome, then the action. "Reduced migration processing time 87% (2hr → 15min) by engineering a PowerShell automation pipeline" — not "Engineered a PowerShell automation pipeline that reduced processing time"
4. Tailor the professional title exactly to the job ad title — this is the single highest-impact change
5. Every quantified claim is drawn exclusively from the candidate's verified career record — never invented
6. Cover letters open with a compelling specific hook referencing something real from the listing — never "I am writing to apply for..."
7. Cover letters are 250–350 words in three paragraphs: Hook/context → Value fit with specific achievement → Motivation + CTA
8. Australian English spelling throughout: organisation, prioritise, standardised, programme (formal), analyze → analyse
9. No clichés: never use "passionate", "team player", "results-driven", "go-getter", "synergy", "think outside the box", "hit the ground running"
10. No meta-commentary, no section labels in cover letters, no placeholder text — deliver employer-ready output only`;

              const userPrompt = `TARGET JOB:
Title: ${job.title}
Company: ${job.company}
Location: ${job.location || 'Melbourne, VIC'}
${job.salary ? `Salary: ${job.salary}` : ''}
${job.source ? `Source: ${job.source}` : ''}

JOB DESCRIPTION / REQUIREMENTS:
${job.description || 'Technical role requiring relevant infrastructure and systems engineering experience.'}

CANDIDATE MASTER CAREER RECORD (source of truth — draw only from this):
${masterResume}

GENERATION INSTRUCTIONS:
Produce two documents separated exactly by this line: ===COVER_LETTER===

RESUME REQUIREMENTS:
- Line 1: SAM LUDWIG
- Line 2: ${job.title} (mirror the job ad title exactly — this is highest-impact ATS tactic)
- Line 3: Melbourne, VIC | 0405 993 245 | sam.ludwig@gmail.com | Australian Citizen | Clearance Eligible: Baseline/NV1
- Line 4: linkedin.com/in/sam-ludwig
- Blank line
- PROFESSIONAL SUMMARY (2 paragraphs, outcome-led, include 2-3 real numbers, third-person)
- TECHNICAL EXPERTISE (category rows format: "Category: term1, term2, term3" — reorder categories so most relevant to THIS role comes first)
- PROFESSIONAL EXPERIENCE (most recent first; 4-6 bullets for recent roles, 2-4 for older; result-first bullets; preserve all real employer/client names and joint arrangements e.g. "Capgemini (Department of Education Victoria)")
- KEY CERTIFICATIONS & EDUCATION
- KEY PROJECTS (2-3 most relevant to this specific role)
- Format: clean Markdown, no emoji, no tables, single-column

COVER LETTER REQUIREMENTS:
- No header or address block — start directly with the opening sentence
- Paragraph 1 (Hook, 2-3 sentences): Open with something specific about ${job.company} or this specific role — not a generic opener. State explicitly why Sam is the right person for this specific role, referencing a real achievement with a number
- Paragraph 2 (Value fit, 3-4 sentences): Connect 2 of Sam's most relevant specific achievements directly to the role's stated requirements. Use real outcomes (the 87% processing time reduction, the 660k user SharePoint farm, the 100+ clinical endpoint migration, or whichever are most relevant to THIS role)
- Paragraph 3 (Motivation + CTA, 2-3 sentences): What specifically about ${job.company} or this role type draws Sam — reference the listing or company's industry/stack/mission. Close with a confident, direct call to action
- 250–350 words exactly
- No sign-off line — end after the CTA

Return the resume first, then exactly ===COVER_LETTER=== on its own line, then only the cover letter. No commentary, no self-check text, no meta-notes outside the documents.`;

              // ── Call OpenRouter ───────────────────────────────────────────
              const model = process.env.LLM_MODEL || 'deepseek/deepseek-v4-flash-0731';
              const payload = {
                model,
                messages: [
                  { role: 'system', content: systemPrompt },
                  { role: 'user', content: userPrompt },
                ],
                temperature: 0.4,
                max_tokens: 6000,
              };

              const https = await import('https');
              const postData = JSON.stringify(payload);
              const startTime = Date.now();

              await new Promise((resolve, reject) => {
                const options = {
                  hostname: 'openrouter.ai',
                  path: '/api/v1/chat/completions',
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Length': Buffer.byteLength(postData),
                    'HTTP-Referer': 'http://localhost:5173',
                    'X-Title': 'Job Dashboard - Document Generator',
                  },
                };

                const request = https.default.request(options, (apiRes) => {
                  let data = '';
                  apiRes.on('data', chunk => { data += chunk; });
                  apiRes.on('end', () => {
                    try {
                      const parsed = JSON.parse(data);
                      const content = parsed?.choices?.[0]?.message?.content || '';
                      const separatorIdx = content.indexOf('===COVER_LETTER===');
                      
                      let resume = '', coverLetter = '';
                      if (separatorIdx !== -1) {
                        resume = content.slice(0, separatorIdx).trim();
                        coverLetter = content.slice(separatorIdx + '===COVER_LETTER==='.length).trim();
                      } else {
                        resume = content.trim();
                        coverLetter = '';
                      }

                      const elapsedMs = Date.now() - startTime;
                      res.statusCode = 200;
                      res.setHeader('Content-Type', 'application/json');
                      res.end(JSON.stringify({
                        success: true,
                        resume,
                        coverLetter,
                        model,
                        elapsedMs,
                        usage: parsed?.usage,
                      }));
                      resolve();
                    } catch (e) {
                      reject(new Error(`Parse error: ${e.message}`));
                    }
                  });
                });

                request.on('error', reject);
                request.setTimeout(60000, () => { request.destroy(); reject(new Error('Request timed out')); });
                request.write(postData);
                request.end();
              });

            } catch (e) {
              console.error('[generate-docs] Error:', e.message);
              res.statusCode = 500;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ error: e.message }));
            }
          });
        });
      }
    }
  ],
  server: {
    proxy: {
      '/api/sheet-csv': {
        target: 'https://docs.google.com/spreadsheets/d/1IciRjQBBQoykm0K6NljjDNEWDTzdjsSaEPef8-hw8Lk/export?format=csv',
        changeOrigin: true,
        secure: true,
        rewrite: () => '',
      }
    }
  }
})
