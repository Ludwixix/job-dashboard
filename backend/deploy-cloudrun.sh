#!/bin/bash
# deploy-cloudrun.sh
# One-command deploy of job-dashboard to Google Cloud Run
# Run: bash deploy-cloudrun.sh [PROJECT_ID]

set -e

PROJECT_ID="${1:-$(gcloud config get-value project 2>/dev/null)}"
REGION="australia-southeast1"
SERVICE_NAME="job-dashboard"
REPO_NAME="cloud-run-source-deploy"
IMAGE="${REGION}-docker.pkg.dev/${PROJECT_ID}/${REPO_NAME}/${SERVICE_NAME}"

if [ -z "$PROJECT_ID" ] || [ "$PROJECT_ID" = "(unset)" ]; then
    echo "❌ No GCP project set. Run: gcloud config set project YOUR_PROJECT_ID"
    exit 1
fi

echo "🚀 Deploying ${SERVICE_NAME} to Cloud Run"
echo "   Project : ${PROJECT_ID}"
echo "   Region  : ${REGION}"
echo "   Image   : ${IMAGE}"
echo ""

# Enable required APIs (Updated for Artifact Registry)
echo "▶ Enabling Cloud Run, Artifact Registry & Cloud Build APIs…"
gcloud services enable run.googleapis.com artifactregistry.googleapis.com cloudbuild.googleapis.com \
    --project="${PROJECT_ID}" --quiet

# Ensure Artifact Registry repository exists
echo "▶ Checking/Creating Artifact Registry repository…"
if ! gcloud artifacts repositories describe "${REPO_NAME}" --location="${REGION}" --project="${PROJECT_ID}" >/dev/null 2>&1; then
    gcloud artifacts repositories create "${REPO_NAME}" \
        --repository-format=docker \
        --location="${REGION}" \
        --project="${PROJECT_ID}" \
        --description="Docker repository for Cloud Run deployments" \
        --quiet
fi

# Build modern React SPA into static directory
echo "▶ Building job-dashboard-react frontend for Cloud Run deployment…"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REACT_DIR="$(cd "${SCRIPT_DIR}/../job-dashboard-react" && pwd)"
if [ -d "${REACT_DIR}" ]; then
    cd "${REACT_DIR}"
    echo "▶ Running React Vitest component & interaction tests..."
    npm test
    echo "▶ Running React lint checks..."
    npm run lint
    echo "▶ Compiling production bundle..."
    npm run build
    rm -rf "${SCRIPT_DIR}/src/job_dashboard/static/"*
    cp -r dist/* "${SCRIPT_DIR}/src/job_dashboard/static/"
    cd "${SCRIPT_DIR}"
    echo "✓ React frontend packaged into src/job_dashboard/static/"
fi

# Build & push image via Cloud Build
echo "▶ Building container image via Cloud Build…"

gcloud builds submit \
    --tag "${IMAGE}" \
    --project="${PROJECT_ID}" \
    .

# Deploy to Cloud Run
echo "▶ Deploying to Cloud Run (${REGION})…"

# Ensure persistent JWT_SECRET_KEY across Cloud Run revisions
if [ -z "${JWT_SECRET_KEY}" ]; then
    EXISTING_JWT_KEY=$(gcloud run services describe "${SERVICE_NAME}" --region="${REGION}" --project="${PROJECT_ID}" --format="value(spec.template.spec.containers[0].env[JWT_SECRET_KEY])" 2>/dev/null || true)
    if [ -n "${EXISTING_JWT_KEY}" ]; then
        JWT_SECRET_KEY="${EXISTING_JWT_KEY}"
    else
        JWT_SECRET_KEY=$(openssl rand -hex 32)
    fi
fi

gcloud run deploy "${SERVICE_NAME}" \
    --image "${IMAGE}" \
    --region "${REGION}" \
    --allow-unauthenticated \
    --timeout 3600 \
    --memory 2Gi \
    --cpu 2 \
    --concurrency 10 \
    --min-instances 0 \
    --max-instances 5 \
    --port 8080 \
    --set-env-vars="HOST=0.0.0.0,ENVIRONMENT=production,JWT_SECRET_KEY=${JWT_SECRET_KEY},JOB_DASHBOARD_DATA_DIR=/app/data,JOB_DASHBOARD_GCS_DATA_BUCKET=${PROJECT_ID}-job-dashboard-data,JOB_DASHBOARD_SEEK_CACHE_PATH=/app/data/seek_cache.json,JOB_DASHBOARD_SEEK_CACHE_FALLBACK=true,JOB_DASHBOARD_LINKEDIN_ENABLED=false" \
    --project="${PROJECT_ID}" \
    --quiet


# Get service URL
SERVICE_URL=$(gcloud run services describe "${SERVICE_NAME}" \
    --region="${REGION}" \
    --project="${PROJECT_ID}" \
    --format="value(status.url)")

echo ""
echo "✅ Deployed successfully!"
echo "   Service URL: ${SERVICE_URL}"
echo ""
echo "Next steps:"
echo "  1. Test health:  curl ${SERVICE_URL}/health"
echo "  2. Set env var in job-dashboard-react:"
echo "     echo 'VITE_SCRAPER_API_URL=${SERVICE_URL}' >> .env.local"
echo "  3. Rebuild React app:  npm run build"
echo "  4. Push to GitHub Pages to deploy"
echo ""
echo "  To add the URL permanently, edit .env.production in job-dashboard-react:"
echo "     VITE_SCRAPER_API_URL=${SERVICE_URL}"