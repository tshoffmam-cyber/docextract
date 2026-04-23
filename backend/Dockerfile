# Railway deployment: apt-get funciona sem restrições
FROM python:3.12-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    ghostscript \
    poppler-utils \
    tesseract-ocr \
    tesseract-ocr-por \
    qpdf \
    unpaper \
    libgl1-mesa-glx \
    libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]

# end
