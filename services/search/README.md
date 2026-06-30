# Search Service (Python 3.12 + FastAPI + ElasticSearch 8)

Fuzzy product search with filters, ranking, pagination, and a Redis Streams index consumer.
Implemented in Milestone 7.

## Toolchain

- **Runtime:** Python 3.12+ (FastAPI + Uvicorn, async I/O).
- **Packaging:** `pyproject.toml` (PEP 621). Install with either:

  ```bash
  # uv (recommended)
  uv venv && uv pip install -e ".[dev]"

  # or plain pip
  python -m venv .venv && . .venv/Scripts/activate   # Windows
  pip install -e ".[dev]"
  ```

- **Lint/format:** [Ruff](https://docs.astral.sh/ruff/). Run `ruff check .` and `ruff format .`.
- **Property-based testing:** [Hypothesis](https://hypothesis.readthedocs.io/) (min 100
  iterations) + Testcontainers for ElasticSearch.

## Run locally

```bash
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```
