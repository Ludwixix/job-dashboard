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
