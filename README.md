# ProblemRadar (MVP)

ProblemRadar helps founders discover real problems people discuss on Reddit related to their product or website.

## Stack
- Next.js 16 (App Router) + TypeScript
- TailwindCSS + shadcn/ui
- SQLite + Prisma ORM (driver adapter)
- Reddit API (OAuth client credentials)
- OpenAI API (problem extraction + embeddings clustering)

## Setup

### 1) Install dependencies

```bash
npm install
```

### 2) Environment variables

Create a `.env` file in the repo root:

```bash
DATABASE_URL="file:./dev.db"

OPENAI_API_KEY="..."
# Optional
OPENAI_MODEL="gpt-4o-mini"
OPENAI_EMBEDDING_MODEL="text-embedding-3-small"

REDDIT_CLIENT_ID="..."
REDDIT_SECRET="..."
REDDIT_USER_AGENT="ProblemRadar/0.1 by your-reddit-username"
```

Notes:
- **SQLite** uses a local file (`dev.db`) in the repo root.
- The app is designed for **local/self-hosted Node**. For serverless/multi-instance deployments you’d move the pipeline to a job queue.

### 3) Create and migrate the database

```bash
npx prisma generate
npx prisma migrate dev
```

### 4) Queue + worker

This app now enqueues pipeline runs via BullMQ. You need Redis **6.2+** for production.

```bash
# set REDIS_URL for queue/worker
export REDIS_URL=redis://localhost:6379

# start the web app
npm run dev

# in another terminal, start the worker
npm run worker
```

If `REDIS_URL` is missing in development, the app falls back to in-process execution; in production it will refuse to start without Redis.

### 5) Run the dev server

```bash
npm run dev
```

Open `http://localhost:3000`.

## How to use
- Go to `/` and submit a website URL (example: `https://resumeai.com`).
- ProblemRadar creates a `Project` and starts the pipeline **asynchronously**:
  - scrape website → extract top keywords → search Reddit → store posts → OpenAI problem extraction → embeddings clustering
- Visit `/project/[id]` to watch progress (status + stage) and browse:
  - keywords
  - Reddit posts (with a dialog viewer)
  - extracted problems + confidence
  - clusters + simple “top clusters” chart
  - leads table
- Click **Export CSV** to download lead rows (`username, subreddit, problem, post_url`).

## API routes (MVP)
- `POST /api/projects/create` `{ url }` → `{ projectId }` (kicks off pipeline)
- `GET /api/projects/list` → list projects + counts/status
- `GET /api/projects/[id]` → project detail + posts + clusters
- `POST /api/scrape-website` `{ url, includeHtml? }`
- `POST /api/extract-keywords` `{ url }`
- `POST /api/reddit-search` `{ keyword, limit?, projectId? }`
- `POST /api/analyze-posts` `{ projectId, batchSize?, concurrency? }`
- `POST /api/cluster-problems` `{ projectId, similarityThreshold? }`
- `GET /api/export?projectId=...` → CSV download

## Project structure
- `app/` pages + API route handlers
- `components/` UI building blocks (shadcn + app components)
- `lib/` scraping, keyword extraction, Reddit client, OpenAI client, pipeline orchestration
- `prisma/` schema + migrations

## Notes
- BullMQ + worker handle the pipeline; `/api/projects/create` only enqueues.
- SSE endpoint `/api/projects/[id]/events` streams status/runs for the project page (avoids rapid polling).
- Posts/problems can be fetched with sorting/pagination via query params on `/api/projects/[id]` (e.g., `postSortBy=comments&postSortDir=desc&postLimit=50`).
- OpenAI web search mode is controlled via `USE_OPENAI`/`NEXT_PUBLIC_USE_OPENAI` envs; when true, Reddit creds aren’t required.

## Known trade-offs
- Redis 6.2+ is recommended; older versions may work but aren’t supported by BullMQ.
- Pipeline concurrency and rate limits are conservative to reduce external API pressure.
