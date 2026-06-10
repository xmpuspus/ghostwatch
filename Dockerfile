FROM python:3.12-slim

WORKDIR /app

# Install system deps
RUN apt-get update && apt-get install -y --no-install-recommends curl && rm -rf /var/lib/apt/lists/*

# The package source must be present before `pip install .` — hatchling builds
# from the tree. The [web] extra brings fastapi + uvicorn for the CMD below.
COPY pyproject.toml README.md ./
COPY ghostwatch/ ghostwatch/
RUN pip install --no-cache-dir ".[web]"

COPY api/ api/
COPY data/demo/ data/demo/
COPY ghostwatch.yaml .

EXPOSE 8000
CMD ["uvicorn", "api.main:app", "--host", "0.0.0.0", "--port", "8000"]
