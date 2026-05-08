# Deployment

Sonae is a long-running Next.js Node.js app. The pipeline takes 1–5 minutes
on a cold cache and the streaming response runs longer than typical Vercel
serverless function limits, so **serverless platforms with strict timeouts
(Vercel free tier / AWS Lambda) are not supported out of the box**. Use a
long-lived Node host instead.

## Self-hosted Node (recommended)

```bash
git clone https://github.com/couzip/sonae.git
cd sonae
npm ci
# Skip Playwright Chromium if you only use registry-driven Discovery:
#   npm ci --ignore-scripts
npm run build
npm start                              # listens on $PORT (default 3000)
```

Required environment variables: see `.env.example`. Override `SONAE_CACHE_DIR`
when the working directory is read-only.

## Docker

Sonae itself does not ship a Dockerfile (LM Studio / Ollama runs out of band
on the host or as a sidecar). Reference structure for self-hosting:

```dockerfile
FROM node:22-bookworm-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts

FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:22-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production
ENV SONAE_CACHE_DIR=/var/cache/sonae
COPY --from=build /app/.next ./.next
COPY --from=build /app/public ./public
COPY --from=build /app/data ./data
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./package.json
RUN mkdir -p /var/cache/sonae && chown -R node:node /var/cache/sonae
USER node
EXPOSE 3000
CMD ["node_modules/.bin/next", "start"]
```

Mount `/var/cache/sonae` to a persistent volume — this is where the PDFs,
OCR markdown, and final assessments live. Without persistence the pipeline
re-fetches and re-OCRs every time the container restarts.

If you need browser-use Discovery, additionally install Chromium and the
Playwright system dependencies (see Playwright's official Dockerfile for the
exact apt list).

## LLM/OCR backend

The defaults assume LM Studio at `http://localhost:1234`. For a multi-host
deploy, point `LLM_BASE_URL` / `OCR_BASE_URL` at any OpenAI-compatible
endpoint reachable from the Sonae container.

| Backend | Notes |
|---|---|
| LM Studio | Default. Local-first, OpenAI-compatible REST. |
| Ollama | Set `LLM_BASE_URL=http://ollama:11434/v1`, model name accordingly. |
| OpenAI | Use real models (e.g. `gpt-4o-mini`) and a real `LLM_API_KEY`. Note: OCR via OpenAI Vision is not pin-compatible with the `enginil/dots.mocr` output format that the parser expects — verify on a sample PDF before swapping. |
| vLLM / TGI | Any OpenAI-compatible endpoint works. |

## Reverse proxy

Sonae streams Server-Sent Events (`text/event-stream`) for long-running
pipeline progress. Disable response buffering at the proxy:

- nginx: `proxy_buffering off;` for `/api/disasters`
- Cloudflare: SSE works without changes; do not enable "Speed → Optimization
  → Compression" for these paths
- Apache: `SetEnv proxy-sendchunked 1` for the API location

Sonae itself emits `X-Accel-Buffering: no` on the SSE response, but some
proxies require explicit configuration as well.
