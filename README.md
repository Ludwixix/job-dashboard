# ACAA Career Agent V2.0 (React Frontend)

An AI-powered, highly resilient, commercial-ready job application tracking system. This system organizes applications into a sleek Kanban board, surfaces deep market intelligence (FIT Audits), and uses generative AI to tailor resumes and cover letters with 1-click Auto-Apply functionality.

![Dashboard Preview](public/social-preview.png)

## 🚀 Live Demo
Check out the live production deployment: [https://job-dashboard-6xrdvjlrcq-ts.a.run.app/](https://job-dashboard-6xrdvjlrcq-ts.a.run.app/)

## ✨ Key Features (V2.0 Commercial Release)

- **Smart Profile Auto-Synthesis**: Resume upload/parsing instantly builds a candidate profile (any industry, not just IT); saving it pushes personalized search queries to the backend and seeds ranking preferences before the next discovery scrape.
- **Auto-Apply Engine**: 1-click pipeline that synthesizes tailored PDF Resumes/Cover Letters based on a live-edited "Source of Truth" profile, pre-fills screening data, and robustly dispatches candidates to the correct application portal (SEEK, LinkedIn, Indeed, Adzuna).
- **Career Operations**: Saved search profiles, application reminders (follow-up/interview/offer), a per-job fit-audit explanation (score, matched/missing skills, strengths, gaps), and live scraper source-health.
- **Honest Posting Dates**: A job with a missing or unparseable posted date is never shown as "posted today" — age filters and rankings explicitly exclude/deprioritize jobs whose freshness can't be verified (see `src/utils/dateUtils.js`).
- **Application Studio (Live PDF Sync)**: Real-time, debounced auto-saving in the Generator Modal ensures all custom doc edits are immediately synced to the backend and immediately reflected in generated PDFs.
- **Enterprise Resilience**: Comprehensive `SafeErrorBoundary` architecture ensures that isolated component crashes (e.g., Job Modal rendering) fallback gracefully without dropping the user's active session or job feed. Includes `safeStorage` to prevent QuotaExceeded crashes.
- **Live System Health HUD**: Real-time monitoring of Backend APIs, SQLite persistence, Active Profile Sync, and Indexed Feed counts directly in the Auth modal.
- **Production SEO & Branding**: Full OpenGraph tags, Twitter Cards, and product branding ready for commercial growth.

## 🛠️ Architecture
- **Framework**: React 19, Vite, Tailwind CSS, Lucide Icons
- **State & UI**: Custom DnD Kit (Kanban), Recharts for data visualization, React Error Boundaries for granular crash recovery.
- **Backend Sync**: Integrates strictly with the Python `job-dashboard-modular` backend for SQLite WAL persistence and OpenRouter LLM synthesis.

## 💻 Local Setup

This project requires the companion Python backend scraper (`job-dashboard-modular`) for live job fetching, database persistence, and ML scoring.

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Environment Variables:**
   Create a `.env` file in this directory with any local overrides:
   ```env
   VITE_API_BASE_URL="http://localhost:8000"
   ```

3. **Start the Frontend:**
   ```bash
   npm run dev
   ```

4. **Start the Backend:**
   Navigate to the `job-dashboard-modular` directory and start the local API:
   ```bash
   cd ../job-dashboard-modular
   PYTHONPATH=src python3 -m job_dashboard.run_server
   ```
