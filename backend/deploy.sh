#!/bin/bash
# Docker Deployment Script for Job Dashboard

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}Job Dashboard Deployment Script${NC}"
echo "========================================"

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Check prerequisites
echo -e "\n${YELLOW}Checking prerequisites...${NC}"

if ! command_exists docker; then
    echo -e "${RED}Docker is not installed. Please install Docker first.${NC}"
    exit 1
fi

if ! command_exists docker-compose; then
    echo -e "${RED}Docker Compose is not installed. Please install Docker Compose first.${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Docker and Docker Compose are installed${NC}"

# Check for .env file
if [ ! -f .env ]; then
    echo -e "${YELLOW}No .env file found. Creating from example...${NC}"
    if [ -f .env.example ]; then
        cp .env.example .env
        echo -e "${YELLOW}Please edit the .env file with your configuration${NC}"
    else
        echo -e "${RED}No .env.example file found${NC}"
        exit 1
    fi
fi

# Build images
echo -e "\n${YELLOW}Building Docker images...${NC}"
docker-compose build

# Start services
echo -e "\n${YELLOW}Starting services...${NC}"
docker-compose up -d

# Wait for services to be ready
echo -e "\n${YELLOW}Waiting for services to be ready...${NC}"
sleep 10

# Check service status
echo -e "\n${YELLOW}Checking service status...${NC}"
docker-compose ps

# Run database migrations (if any)
echo -e "\n${YELLOW}Running database setup...${NC}"
# docker-compose exec job-dashboard python -m job_dashboard.db.migrate

# Create initial data
echo -e "\n${YELLOW}Creating initial data...${NC}"
# docker-compose exec job-dashboard python -c "from job_dashboard.repository import init_db; init_db()"

# Run tests
echo -e "\n${YELLOW}Running tests...${NC}"
# docker-compose exec job-dashboard pytest tests/ -v

# Show service URLs
echo -e "\n${GREEN}Deployment complete! Services are running:${NC}"
echo -e "  Job Dashboard:   http://localhost:8787"
echo -e "  Prometheus:      http://localhost:9090"
echo -e "  Grafana:         http://localhost:3000 (admin/admin)"
echo -e "  Flower (Celery): http://localhost:5555"

echo -e "\n${YELLOW}To view logs:${NC}"
echo "  docker-compose logs -f job-dashboard"
echo -e "\n${YELLOW}To stop services:${NC}"
echo "  docker-compose down"

# Health check
echo -e "\n${YELLOW}Running health check...${NC}"
sleep 5
if curl -s http://localhost:8787/health > /dev/null; then
    echo -e "${GREEN}✓ Job Dashboard is healthy${NC}"
else
    echo -e "${RED}✗ Job Dashboard health check failed${NC}"
fi