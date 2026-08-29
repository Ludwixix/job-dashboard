# Cloud Run optimised Dockerfile for job-dashboard-modular
# Uses stdlib ThreadingHTTPServer (not uvicorn/ASGI)

FROM python:3.11-slim

# Cloud Run injects PORT env var; default 8080
ENV PORT=8080 \
    HOST=0.0.0.0 \
    PYTHONPATH=/app/src \
    PYTHONFAULTHANDLER=1 \
    PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1


# System deps needed for playwright + jobspy
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc g++ curl git \
    # Playwright browser dependencies
    libnss3 libatk1.0-0 libatk-bridge2.0-0 libcups2 libdrm2 \
    libxkbcommon0 libxcomposite1 libxdamage1 libxfixes3 libxrandr2 \
    libgbm1 libasound2 libpango-1.0-0 libcairo2 libpangocairo-1.0-0 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install Python dependencies (lean set for Cloud Run)
COPY requirements-cloudrun.txt .
RUN pip install --no-cache-dir -r requirements-cloudrun.txt

# Install Playwright Chromium browser
RUN playwright install chromium --with-deps 2>/dev/null || true

# Copy application source
COPY src/ src/
COPY pyproject.toml .

# Install the package itself (editable-style)
RUN pip install --no-cache-dir -e . 2>/dev/null || pip install --no-cache-dir src/

# Create data directories
RUN mkdir -p /app/data /app/logs

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
    CMD curl -f http://localhost:${PORT}/health || exit 1

EXPOSE ${PORT}

# Cloud Run: bind to 0.0.0.0 and read $PORT from environment
CMD ["sh", "-c", "python -m job_dashboard.run_server --host 0.0.0.0 --port ${PORT}"]

