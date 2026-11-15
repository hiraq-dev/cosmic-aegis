FROM python:3.12-slim
WORKDIR /app
COPY server/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY server/ ./server/
COPY rag_service/data/protocols ./rag_service/data/protocols
WORKDIR /app/server
ENV AEGIS_ENV=production
CMD sh -c "alembic upgrade head && uvicorn app.main:create_app --factory --host 0.0.0.0 --port ${PORT:-8000} --workers 1"
