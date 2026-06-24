FROM node:20-slim

# Install Chromium + all shared library dependencies (for whatsapp-web.js/Puppeteer)
RUN apt-get update && apt-get install -y \
    chromium \
    --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV CHROME_PATH=/usr/bin/chromium
ENV NODE_ENV=production

WORKDIR /app

# Root package
COPY package*.json ./
RUN npm install

# Client: install deps and build
COPY client/package*.json ./client/
RUN npm --prefix client install
COPY client/ ./client/
RUN npm --prefix client run build

# Server: install production deps
COPY server/package*.json ./server/
RUN npm --prefix server install --only=production

# Server source
COPY server/ ./server/

EXPOSE 5000
CMD ["node", "server/index.js"]
