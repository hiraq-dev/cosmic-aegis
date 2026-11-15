FROM python:3.11-slim
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends curl libgl1 libglib2.0-0 && rm -rf /var/lib/apt/lists/*
COPY cognitive_triage/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY shared/common.py ./common.py
COPY cognitive_triage/ .
RUN useradd -m aegis && chown -R aegis /app
USER aegis
EXPOSE 8002
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8002"]
