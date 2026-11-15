FROM python:3.11-slim
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends curl libgl1 libglib2.0-0 && rm -rf /var/lib/apt/lists/*
COPY rag_service/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY shared/common.py ./common.py
COPY rag_service/ .
RUN useradd -m aegis && chown -R aegis /app
USER aegis
EXPOSE 8003
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8003"]
