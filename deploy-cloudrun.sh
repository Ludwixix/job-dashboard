#!/bin/bash
# deploy-cloudrun.sh
# One-command deploy of job-dashboard to Google Cloud Run
# Run: bash deploy-cloudrun.sh [PROJECT_ID]

set -e

PROJECT_ID="${1:-$(gcloud config get-value project 2>/dev/null)}"
REGION="australia-southeast1"
SERVICE_NAME="job-dashboard"
IMAGE="gcr.io/${PROJECT_ID}/${SERVICE_NAME}"

if [ -z "$PROJECT_ID" ] || [ "$PROJECT_ID" = "(unset)" ]; then
    echo "❌ No GCP project set. Run: gcloud config set project YOUR_PROJECT_ID"
    exit 1
fi

echo "🚀 Deploying ${SERVICE_NAME} to Cloud Run"
echo "   Project : ${PROJECT_ID}"
echo "   Region  : ${REGION}"
echo "   Image   : ${IMAGE}"
echo ""

# Enable required APIs
echo "▶ Enabling Cloud Run & Container Registry APIs…"
gcloud services enable run.googleapis.com containerregistry.googleapis.com cloudbuild.googleapis.com \
    --project="${PROJECT_ID}" --quiet

# Build & push image via Cloud Build (no local Docker needed)
echo "▶ Building container image via Cloud Build…"
gcloud builds submit \
    --tag "${IMAGE}" \
    --project="${PROJECT_ID}" \
    .

# Deploy to Cloud Run
echo "▶ Deploying to Cloud Run (${REGION})…"
gcloud run deploy "${SERVICE_NAME}" \
    --image "${IMAGE}" \
    --platform managed \
    --region "${REGION}" \
    --allow-unauthenticated \
    --timeout 300 \
    --memory 2Gi \
    --cpu 2 \
    --concurrency 10 \
    --min-instances 0 \
    --max-instances 5 \
    --port 8080 \
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
