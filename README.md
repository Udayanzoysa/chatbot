# Meta + Gemini 24/7 Sales Agent

Node.js (TypeScript) backend that receives **WhatsApp**, **Messenger**, and **Instagram** messages via Meta webhooks, replies with **Gemini 2.5 Flash**, and stores conversation history + leads in **PostgreSQL**.

## Prerequisites

- Node.js 20+
- PostgreSQL 16+ (local install **or** Docker Desktop)
- [ngrok](https://ngrok.com/) (or similar) for a public HTTPS URL
- Meta Developer account + Business portfolio
- Google AI Studio / Gemini API key

## Quick start (recommended on Windows — local PostgreSQL)

Docker is optional. If you already have PostgreSQL installed and running (e.g. `postgresql-x64-18`):

```powershell
# 1) Create the chatbot database (enter your postgres password when prompted)
$env:Path = "C:\Program Files\PostgreSQL\18\bin;" + $env:Path
psql -U postgres -h localhost -c "CREATE DATABASE chatbot;"
# If it already exists, you can ignore the error.

# 2) Put your real postgres password in .env:
# DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@localhost:5432/chatbot

# 3) Install deps + migrate + run
npm install
copy .env.example .env   # skip if .env already exists
npm run migrate
npm run dev
```

`.env` should use:

```env
DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@localhost:5432/chatbot
```

Health check: [http://localhost:3000/health](http://localhost:3000/health)

### Docker Compose (local or VPS server)

Runs **app + Postgres** together. Postgres is reachable inside the network as host `postgres` (not `localhost`).

1. Install Docker on the server ([Docker Engine](https://docs.docker.com/engine/install/) or Docker Desktop).
2. Copy the project to the server (git clone).
3. Create `.env` from the example and fill secrets:

```bash
cp .env.example .env
nano .env
```

Set at least:

```env
POSTGRES_USER=postgres
POSTGRES_PASSWORD=pick-a-strong-password
POSTGRES_DB=chatbot
DOCKER_DATABASE_URL=postgresql://postgres:pick-a-strong-password@postgres:5432/chatbot
META_VERIFY_TOKEN=your-verify-token
META_APP_SECRET=your-app-secret
WHATSAPP_TOKEN=...
WHATSAPP_PHONE_NUMBER_ID=...
GEMINI_API_KEY=...
SKIP_META_SIGNATURE=false
```

`DOCKER_DATABASE_URL` must use host **`postgres`** (the Docker service name), not `localhost`.

4. Start:

```bash
docker compose up -d --build
```

5. Check:

```bash
docker compose ps
docker compose logs -f app
curl http://localhost:3000/health
```

Expect `"status":"ok"` and `"db":"up"`.

6. Point Meta webhook to your public URL:

`https://YOUR_DOMAIN_OR_IP:3000/webhook`

(Prefer Nginx + HTTPS in production; put Meta callback on `https://yourdomain.com/webhook`.)

Useful commands:

```bash
docker compose logs -f          # all logs
docker compose restart app      # after .env change: recreate
docker compose up -d --force-recreate app
docker compose down             # stop (keeps DB volume)
docker compose down -v          # stop AND wipe Postgres data
```

**Local npm (no Docker app)** still uses `DATABASE_URL=...@localhost:5432/chatbot` and `npm run migrate:dev`.

## Environment variables

| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` | Postgres connection string |
| `META_VERIFY_TOKEN` | Shared secret you invent for webhook GET verify |
| `META_APP_SECRET` | App secret for `X-Hub-Signature-256` |
| `META_PAGE_ACCESS_TOKEN` | Long-lived Page token (Messenger + Instagram) |
| `WHATSAPP_TOKEN` | WhatsApp Cloud API token |
| `WHATSAPP_PHONE_NUMBER_ID` | WhatsApp phone number ID |
| `GEMINI_API_KEY` | Google Gemini API key |
| `SKIP_META_SIGNATURE` | `true` only for local signature-bypass smoke tests |

## Meta Developer setup (click path)

1. Go to [developers.facebook.com](https://developers.facebook.com/) → **Create App** (Business / Other as prompted).
2. Add products: **WhatsApp**, **Messenger**, **Instagram**.
3. Connect a Facebook Page and an Instagram Professional account linked to that Page.
4. WhatsApp → API Setup: copy **Temporary/Permanent token** and **Phone number ID** into `.env`.
5. Messenger → generate a **Page access token** with `pages_messaging` (and Instagram messaging permissions as required). Prefer a long-lived token.
6. Copy **App Secret** from Settings → Basic → `META_APP_SECRET`.
7. Start a tunnel:
   ```bash
   ngrok http 3000
   ```
   Callback URL: `https://<your-subdomain>.ngrok.app/webhook`
8. Configure webhooks (same URL + `META_VERIFY_TOKEN`):
   - WhatsApp: subscribe to `messages`
   - Messenger: `messages`, `messaging_postbacks`
   - Instagram: `messages`
9. Meta will hit `GET /webhook` — the app returns the challenge when the verify token matches.

## How a message flows

1. Customer messages your ad / Page / WhatsApp number.
2. Meta `POST`s to `/webhook` (signature verified).
3. Backend upserts `contacts`, stores the user message, loads last 15 messages.
4. Gemini generates a reply (and may call `save_lead_information`).
5. Lead rows go to `leads`; reply is stored and sent via Graph API.

## Lead capture

Gemini is instructed to call `save_lead_information` when the user voluntarily shares name / email / phone. Duplicates for the same contact + email/phone within 24 hours are skipped.

Inspect leads:

```sql
SELECT * FROM leads ORDER BY created_at DESC LIMIT 20;
```

## Useful scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Hot-reload TypeScript server |
| `npm run build` | Compile to `dist/` |
| `npm start` | Run compiled server |
| `npm run migrate` | Apply `src/db/schema.sql` |
| `npm run typecheck` | TypeScript check only |

## Project layout

```
src/
  index.ts              # Express boot + /health
  config.ts             # Zod env validation
  db/                   # pool, migrate, schema
  meta/                 # verify, parse, sign, send
  session/history.ts    # contact + message memory
  ai/                   # Gemini + tools + system prompt
  leads/saveLead.ts     # Postgres lead persistence
  routes/webhook.ts     # GET/POST /webhook orchestration
```

## Production notes

- Never set `SKIP_META_SIGNATURE=true` in production.
- Rotate Meta tokens before expiry; prefer System User tokens for WhatsApp.
- CRM (HubSpot / Zapier) is intentionally out of scope for v1 — extend `saveLead` later.
- Redis can replace/augment Postgres session reads when you need higher throughput.
