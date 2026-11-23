# Life Planning AI and Recent Chats

Owner: Jarman Perry. Branch: `feature/jarman-life-planning-chats`.

This document covers the two features added in this branch: the real
LLM-backed **Life Planning** mode and the **Recent Chats** system.

## Architecture at a glance

```
Browser (React, GitHub Pages or `npm run dev`)
  App.tsx ── useConversations ── ConversationStore (localStorage MVP)
     │
     └─ lifePlanningApi.ts ── POST /api/chat/life-planning ──┐
                                                             ▼
Aven API server (Node, `server/`)                            
  app.ts  ── validation ── rate limit ── CORS allowlist      
     │                                                       
     └─ AIProvider interface ── openaiProvider.ts ──► OpenAI Chat Completions
          (system prompt from prompts/lifePlanning.ts is added here)
```

| Concern | File |
| --- | --- |
| Conversation types | `src/types/index.ts` |
| Pure conversation helpers (titles, sorting, dates) | `src/utils/conversations.ts` |
| Storage interface + localStorage implementation | `src/services/conversationStore.ts` |
| Conversation state (list, active chat, saving) | `src/hooks/useConversations.ts` |
| Browser → API client | `src/services/lifePlanningApi.ts` |
| Build-time API URL | `src/config/runtime.ts` |
| Recent Chats dialog | `src/components/chat/RecentChatsModal.tsx` |
| HTTP server, routes, security controls | `server/app.ts` |
| Request validation | `server/validation.ts` |
| Provider abstraction / OpenAI implementation | `server/ai/` |
| Life Planning system prompt | `server/prompts/lifePlanning.ts` |
| Env configuration | `server/config.ts`, `.env.example` |

## Local development

Requires Node.js 22.9 or newer.

```bash
npm install

# Terminal 1: the Aven API server (compiles server/ to server-dist/ and runs it)
cp .env.example .env        # then set OPENAI_API_KEY and AI_MODEL
npm run dev:server          # http://localhost:8787

# Terminal 2: the React app
npm run dev                 # http://localhost:5173 (proxies /api to :8787)
```

- **Without an API key** everything still runs. The server starts, logs
  `Life Planning AI is NOT configured`, and Life Planning shows the message
  "Life Planning AI isn't set up on the server yet, so no reply was generated."
  with a Retry button. Nothing pretends to be a model reply.
- **Without the API server running** Life Planning shows a connection error.
  The other modes (General, Financiality, Wellness) keep their existing
  placeholder replies and do not need the server.

### Environment variables (server only)

| Variable | Required | Default | Purpose |
| --- | --- | --- | --- |
| `OPENAI_API_KEY` | yes, for real AI | none | Secret key. Server-side only. |
| `AI_MODEL` | yes, for real AI | none | Model ID. No default on purpose: pick one your account can use from https://platform.openai.com/docs/models. |
| `AI_PROVIDER` | no | `openai` | Provider selector (only `openai` exists today). |
| `OPENAI_BASE_URL` | no | `https://api.openai.com/v1` | Any OpenAI-compatible endpoint. |
| `PORT` | no | `8787` | API port. The Vite proxy reads it too. |
| `ALLOWED_ORIGINS` | no | `http://localhost:5173,http://127.0.0.1:5173` | Browser origins allowed to call the API. |
| `TRUST_PROXY` | no | `false` | Use `X-Forwarded-For` for rate limiting (set `true` behind a hosting proxy). |
| `AI_TIMEOUT_MS` | no | `30000` | Provider timeout (1,000 to 120,000). |
| `AI_MAX_OUTPUT_TOKENS` | no | `1200` | Max completion tokens per reply. |
| `RATE_LIMIT_WINDOW_MS` / `RATE_LIMIT_MAX` | no | `60000` / `20` | Per-client request limit. |

Frontend (build time, public): `VITE_AVEN_API_URL`, the public URL of the
deployed API (for example `https://aven-api.onrender.com`). It is a URL, not a
secret. **Never put an API key in any `VITE_*` variable**, because Vite embeds
them in public JavaScript.

## API contract

`POST /api/chat/life-planning`

```json
{ "messages": [
  { "role": "user", "content": "I want to become a software engineer before graduation." },
  { "role": "assistant", "content": "When do you graduate?" },
  { "role": "user", "content": "May 2028." }
] }
```

Success (200):

```json
{ "message": { "role": "assistant", "content": "..." },
  "model": "...", "provider": "openai", "finishReason": "stop" }
```

Errors use `{ "error": { "code", "message" } }`:

| Status | Code | When |
| --- | --- | --- |
| 400 | `invalid_json` / `invalid_request` | Bad JSON, wrong roles, empty or overlong text, more than 40 turns or 24k characters, or the last turn not from the user |
| 403 | `origin_not_allowed` | Browser origin not in `ALLOWED_ORIGINS` |
| 413 | `payload_too_large` | Body over 64 KB |
| 415 | `unsupported_media_type` | Not `application/json` |
| 429 | `rate_limited` | Too many requests (`Retry-After` header) |
| 503 | `ai_not_configured` | No key or model configured |
| 503 | `ai_busy` | Provider rate limited us |
| 504 | `ai_timeout` | Provider exceeded `AI_TIMEOUT_MS` |
| 502 | `ai_provider_error` | Any other provider failure (details only in server logs) |

`GET /api/health` → `{ "status": "ok", "aiConfigured": true | false }`.

Security controls: the system prompt lives on the server, and clients cannot
send `system` messages. The API key is never logged or returned. Provider
error bodies are not forwarded to the browser. Requests are limited by size,
rate, and origin, responses are `no-store`, and the provider call is aborted
if the browser disconnects.

## Life Planning behavior

The coaching behavior is defined in `server/prompts/lifePlanning.ts`
(versioned via `LIFE_PLANNING_PROMPT_VERSION`, returned in the
`X-Aven-Prompt-Version` header). It tells the model to ask focused clarifying
questions, personalize from the conversation, and give measurable steps and
milestones. It also covers weighing options, naming obstacles, keeping facts
separate from predictions, never promising outcomes, respecting the user's
autonomy, and referring medical, legal, and financial questions to
professionals, with a crisis-line response for safety concerns.

On the client:
- The most recent 20 turns (up to 16k characters) are sent as context.
- Send is disabled while a reply is loading, so a message can't be submitted twice.
- Every request has an id. Switching modes, opening another chat, starting a
  new chat, or signing out aborts it, and a late response is discarded, so it
  can never land in a different conversation.
- Failures show an `role="alert"` message with Retry where retrying makes sense.
  A restored Life Planning chat whose last message never got a reply also
  offers Retry.
- **Attachments are not sent to the model.** The UI says so in Life Planning
  mode, and the request tells the model which file names were attached and
  that it cannot see their contents.

## Recent Chats and storage

- A conversation (`id`, `title`, `mode`, `createdAt`, `updatedAt`, ordered
  `messages`) is created on its first message, so blank chats are never saved.
  Its mode is fixed, so switching modes starts a new conversation instead of
  overwriting another one.
- **New chat:** the `+` button in the composer (shown once a chat has messages)
  or the "New chat" button in the Recent Chats dialog starts a fresh chat in
  the current mode. Clicking the Aven wordmark still returns to General with a
  fresh chat. Saved chats are never erased by either.
- **Recent Chats dialog:** opened from More → Recent Chats. It lists chats
  newest first with title, mode, last activity, and a preview. It has
  `role="dialog"` and `aria-modal`, traps focus, supports arrow, Home, and End
  keys between chats, and closes with Escape, the close button, or a backdrop
  click. Focus returns to the message box. It honors reduced motion and works
  on mobile widths.
- **Storage (MVP):** `localStorage` under
  `aven.conversations.v1.<username>`, as a versioned envelope
  `{ version: 1, conversations: [...] }`. Loading validates every record. A
  corrupted or unknown-version blob is copied to `<key>.corrupt` and the app
  starts clean with a visible notice. Saves de-duplicate by id, keep at most
  50 chats and 200 messages each, and drop the oldest chats if the browser
  quota is hit. If saving fails, the user is told the chat will be lost on
  refresh.
- **Attachments:** only name and type are saved. Temporary `blob:` preview URLs
  are never stored, and restored images show the file name with a note that
  the preview isn't available.

### Limitations (please read)

- Sign-in is simulated. Scoping storage by username keeps demo users' chats
  apart in one browser, **but it is not security**: anyone using that browser
  can read `localStorage` or sign in with the same name. Do not store
  sensitive information.
- Chats don't sync across devices or browsers.
- To move to a database, implement `ConversationStore` (`list`, `save`,
  `remove`) against the chosen backend with real authentication, and create
  it in `App.tsx` where `createLocalConversationStore` is called. The UI and
  hook don't change.

## Deployment

GitHub Pages only hosts static files, so **the deployed site cannot run the
API server**. Until a backend is deployed and configured, Life Planning on
https://jcodes101.github.io/Aven_LifePlanner_GPT/ will say the AI isn't
connected. Recent Chats works there today because it runs entirely in the
browser.

To enable real AI in production:

1. Deploy the API server to a Node host (Render, Railway, Fly.io, a VPS, etc.):
   - Build command: `npm ci && npm run build:server`
   - Start command: `npm run start:server`
   - Environment: `OPENAI_API_KEY`, `AI_MODEL`,
     `ALLOWED_ORIGINS=https://jcodes101.github.io`, `TRUST_PROXY=true`.
     Most hosts set `PORT` automatically.
2. Check `https://<your-api-host>/api/health` returns `"aiConfigured": true`.
3. In the GitHub repo, go to Settings → Secrets and variables → Actions →
   Variables and add `VITE_AVEN_API_URL=https://<your-api-host>`. The Pages
   workflow passes it into the build.
4. Re-run the Pages deployment.

Cost safety: the endpoint has no user authentication yet (sign-in is
simulated), so anyone who finds the URL could use it within the rate limit.
Set a monthly spending limit in the OpenAI dashboard, keep `RATE_LIMIT_MAX`
low, and add real authentication when the auth work lands.

## Tests

```bash
npm test -- --runInBand     # all suites
npm run test:coverage       # with coverage thresholds (85%)
```

- `tests/server/*.test.ts` run in Node with a mocked provider (no paid API calls).
- `tests/unit/*.test.ts` cover storage, the API client, and helpers.
- `tests/RecentChats.test.tsx` and `tests/LifePlanningChat.test.tsx` drive the
  full app with a mocked `fetch`.
