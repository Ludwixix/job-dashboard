#!/bin/bash
# deploy-cloudrun.sh
# One-command deploy of job-dashboard to Google Cloud Run
# Run: bash deploy-cloudrun.sh [--staging] [PROJECT_ID]

set -e

IS_STAGING=false
REMAINING_ARGS=()
for arg in "$@"; do
    if [ "$arg" = "--staging" ] || [ "$arg" = "-s" ]; then
        IS_STAGING=true
    else
        REMAINING_ARGS+=("$arg")
    fi
done

PROJECT_ID="${REMAINING_ARGS[0]:-$(gcloud config get-value project 2>/dev/null)}"
REGION="australia-southeast1"
SERVICE_NAME="job-dashboard"
REPO_NAME="cloud-run-source-deploy"
IMAGE="${REGION}-docker.pkg.dev/${PROJECT_ID}/${REPO_NAME}/${SERVICE_NAME}"

if [ -z "$PROJECT_ID" ] || [ "$PROJECT_ID" = "(unset)" ]; then
    echo "❌ No GCP project set. Run: gcloud config set project YOUR_PROJECT_ID"
    exit 1
fi

if [ "$IS_STAGING" = true ]; then
    echo "🚀 Deploying ${SERVICE_NAME} to Cloud Run [STAGING TAG - 0% BASE TRAFFIC]"
else
    echo "🚀 Deploying ${SERVICE_NAME} to Cloud Run [PRODUCTION - 100% TRAFFIC]"
fi
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
echo "▶ Building frontend for Cloud Run deployment…"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if [ -d "${SCRIPT_DIR}/../frontend" ]; then
    REACT_DIR="$(cd "${SCRIPT_DIR}/../frontend" && pwd)"
elif [ -d "${SCRIPT_DIR}/../job-dashboard-react" ]; then
    REACT_DIR="$(cd "${SCRIPT_DIR}/../job-dashboard-react" && pwd)"
else
    REACT_DIR=""
fi

if [ -n "${REACT_DIR}" ] && [ -d "${REACT_DIR}" ]; then
    cd "${REACT_DIR}"
    echo "▶ Running React Vitest component & interaction tests..."
    npm test -- --run
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
    EXISTING_JWT_KEY=$(gcloud run services describe "${SERVICE_NAME}" --region="${REGION}" --project="${PROJECT_ID}" --format=json 2>/dev/null | python3 -c "import sys, json; data=json.load(sys.stdin); envs={e['name']: e.get('value','') for e in data.get('spec',{}).get('template',{}).get('spec',{}).get('containers',[])[0].get('env',[])}; print(envs.get('JWT_SECRET_KEY',''))" 2>/dev/null || true)
    if [ -n "${EXISTING_JWT_KEY}" ]; then
        JWT_SECRET_KEY="${EXISTING_JWT_KEY}"
        echo "✓ Retained existing persistent JWT_SECRET_KEY from active Cloud Run service"
    else
        JWT_SECRET_KEY=$(openssl rand -hex 32)
        echo "✓ Generated new persistent JWT_SECRET_KEY for initial deployment"
    fi
fi

EXTRA_FLAGS=()
if [ "$IS_STAGING" = true ]; then
    EXTRA_FLAGS+=("--no-traffic" "--tag=staging")
fi

# Safely pass OpenRouter key to Cloud Run if available
ROUTER_KEY="${JOB_DASHBOARD_OPENROUTER_API_KEY:-}"
if [ -z "$ROUTER_KEY" ] && [ -f "${SCRIPT_DIR}/../OpenRouterAPI.txt" ]; then
    ROUTER_KEY="$(cat "${SCRIPT_DIR}/../OpenRouterAPI.txt" | tr -d '[:space:]')"
elif [ -z "$ROUTER_KEY" ] && [ -f "${SCRIPT_DIR}/../../OpenRouterAPI.txt" ]; then
    ROUTER_KEY="$(cat "${SCRIPT_DIR}/../../OpenRouterAPI.txt" | tr -d '[:space:]')"
fi

ENV_VARS="HOST=0.0.0.0,ENVIRONMENT=production,JWT_SECRET_KEY=${JWT_SECRET_KEY},JOB_DASHBOARD_DATA_DIR=/app/data,JOB_DASHBOARD_GCS_DATA_BUCKET=${PROJECT_ID}-job-dashboard-data,JOB_DASHBOARD_SEEK_CACHE_PATH=/app/data/seek_cache.json,JOB_DASHBOARD_SEEK_CACHE_FALLBACK=true,JOB_DASHBOARD_LINKEDIN_ENABLED=false"
if [ -n "$ROUTER_KEY" ]; then
    ENV_VARS="${ENV_VARS},JOB_DASHBOARD_OPENROUTER_API_KEY=${ROUTER_KEY}"
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
    --set-env-vars="${ENV_VARS}" \
    --project="${PROJECT_ID}" \
    "${EXTRA_FLAGS[@]}" \
    --quiet

if [ "$IS_STAGING" = true ]; then
    STAGING_URL=$(gcloud run services describe "${SERVICE_NAME}" \
        --region="${REGION}" \
        --project="${PROJECT_ID}" \
        --format="value(status.traffic[?tag=='staging'].url)" 2>/dev/null || true)
    if [ -z "$STAGING_URL" ]; then
        STAGING_URL="https://staging---job-dashboard-6xrdvjlrcq-ts.a.run.app"
    fi

    echo ""
    echo "✅ Staging revision deployed with 0% production traffic!"
    echo "   Staging URL: ${STAGING_URL}"
    echo ""
    echo "Next steps:"
    echo "  1. Test staging health:  curl ${STAGING_URL}/health"
    echo "  2. Test staging API:     curl ${STAGING_URL}/api/metrics/summary"
    echo ""
    echo "  To promote staging to 100% production traffic:"
    echo "     gcloud run services update-traffic ${SERVICE_NAME} --region=${REGION} --project=${PROJECT_ID} --to-tags=staging=100"
else
    # Get production service URL
    SERVICE_URL=$(gcloud run services describe "${SERVICE_NAME}" \
        --region="${REGION}" \
        --project="${PROJECT_ID}" \
        --format="value(status.url)")

    echo ""
    echo "✅ Deployed successfully to production (100% traffic)!"
    echo "   Service URL: ${SERVICE_URL}"
    echo ""
    echo "Next steps:"
    echo "  1. Test health:  curl ${SERVICE_URL}/health"
    echo "  2. Test metrics: curl ${SERVICE_URL}/api/metrics/summary"
fi