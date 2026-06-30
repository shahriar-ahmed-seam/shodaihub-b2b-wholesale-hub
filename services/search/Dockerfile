# syntax=docker/dockerfile:1
# ============================================================================
# Search Service — multi-stage production image (Python 3.12 + FastAPI).
#
# Built with services/search as the build context:
#
#     docker build -t b2b/search services/search
#
# Stage 1 builds a self-contained virtualenv (runtime deps only — no dev/test
# extras). Stage 2 copies the venv onto a slim base and serves with uvicorn.
# ============================================================================

# ----------------------------------------------------------------------------
FROM python:3.12-slim AS build
WORKDIR /app
ENV PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1
RUN python -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"
# Install runtime dependencies + the app package (hatchling build backend).
COPY pyproject.toml README.md ./
COPY app ./app
RUN pip install .

# ----------------------------------------------------------------------------
FROM python:3.12-slim AS runtime
WORKDIR /app
ENV PATH="/opt/venv/bin:$PATH" \
    PYTHONUNBUFFERED=1 \
    SEARCH_PORT=8000
RUN useradd -r -u 1001 -m -d /home/appuser appuser
COPY --from=build /opt/venv /opt/venv
COPY app ./app
USER appuser
EXPOSE 8000
# uvicorn serves the FastAPI app; honor SEARCH_PORT (default 8000).
CMD ["sh", "-c", "exec uvicorn app.main:app --host 0.0.0.0 --port ${SEARCH_PORT:-8000}"]
