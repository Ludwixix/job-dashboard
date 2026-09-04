#!/usr/bin/env bash
# scripts/smoke-test.sh
# Post-deployment smoke check for Cloud Run backend (Production or Staging)
# Usage:
#   ./scripts/smoke-test.sh [URL_OR_TAG]
# Examples:
#   ./scripts/smoke-test.sh
#   ./scripts/smoke-test.sh --staging
#   ./scripts/smoke-test.sh https://staging---job-dashboard-6xrdvjlrcq-ts.a.run.app

set -euo pipefail

PROD_URL="https://job-dashboard-6xrdvjlrcq-ts.a.run.app"
STAGING_URL="https://staging---job-dashboard-6xrdvjlrcq-ts.a.run.app"

TARGET_URL="${PROD_URL}"
if [ "${1:-}" = "--staging" ] || [ "${1:-}" = "-s" ]; then
    TARGET_URL="${STAGING_URL}"
elif [ -n "${1:-}" ]; then
    TARGET_URL="${1}"
fi

# Strip trailing slash if present
TARGET_URL="${TARGET_URL%/}"

GREEN='\033[0;32m'
RED='\033[0;31m'
CYAN='\033[0;36m'
NC='\033[0m'

echo -e "${CYAN}▶ Running Smoke Test against: ${TARGET_URL}${NC}"

FAILED=0

check_endpoint() {
    local path="$1"
    local desc="$2"
    local full_url="${TARGET_URL}${path}"

    printf "  Checking %-28s [%s] ... " "${desc}" "${path}"
    HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 15 "${full_url}" || echo "000")

    if [ "$HTTP_CODE" = "200" ]; then
        echo -e "${GREEN}PASS (200 OK)${NC}"
    else
        echo -e "${RED}FAIL (HTTP ${HTTP_CODE})${NC}"
        FAILED=$((FAILED + 1))
    fi
}

check_endpoint "/health" "Healthcheck"
check_endpoint "/api/metrics/summary" "Metrics Summary"
check_endpoint "/api/metrics/hourly" "Hourly Ingestion"
check_endpoint "/api/openapi.json" "OpenAPI Schema"

echo ""
if [ "$FAILED" -eq 0 ]; then
    echo -e "${GREEN}✅ All smoke tests passed successfully for ${TARGET_URL}${NC}"
    exit 0
else
    echo -e "${RED}❌ Smoke test failed: ${FAILED} check(s) did not return 200 OK.${NC}"
    exit 1
fi
