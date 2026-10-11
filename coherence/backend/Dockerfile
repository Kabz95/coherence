FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV PORT=8080

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    curl \
    git \
    libgl1 \
    libglib2.0-0 \
    dcm2niix \
  && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY entrypoint.py main.py worker.py ./
COPY jobs ./jobs
COPY lib ./lib

# API service mode:
#   uvicorn main:app --host 0.0.0.0 --port 8080
# Cloud Run Job mode:
#   python worker.py
CMD ["python", "entrypoint.py"]
