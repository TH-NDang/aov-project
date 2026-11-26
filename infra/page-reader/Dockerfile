# syntax=docker/dockerfile:1
# Page reader of the patch watch (ADR-035): Node with Alpine's Chromium, opening the one publisher page that fills its
# list from scripts. Build context is infra/page-reader. Only the server runs it; nobody's laptop does.
FROM node:22-alpine
# Chromium comes from Alpine, so puppeteer downloads no browser of its own. No fonts: the reader reads text, not pixels.
RUN apk add --no-cache chromium
ENV PUPPETEER_SKIP_DOWNLOAD=true \
    NODE_ENV=production
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts && npm cache clean --force
COPY reader.mjs server.mjs ./
USER node
EXPOSE 8095
CMD ["node", "server.mjs"]
