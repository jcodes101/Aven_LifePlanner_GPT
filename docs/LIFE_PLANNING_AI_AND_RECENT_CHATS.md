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
     └─ AIProvider interface ─┬─ geminiProvider.ts ──► Google Gemini generateContent (default)
                               └─ openaiProvider.ts ──► OpenAI Chat Completions (optional)
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
| Provider abstraction, Gemini (default) and OpenAI implementations | `server/ai/` |
| List models your key can use (`npm run models`) | `server/listModels.ts` |
| Life Planning system prompt | `server/prompts/lifePlanning.ts` |
| Env configuration | `server/config.ts`, `.env.example` |

## Local development

Requires Node.js 22.9 or newer.

```bash
npm install

# Terminal 1: the Aven API server (compiles server/ to server-dist/ and runs it)
cp .env.example .env        # then set GEMINI_API_KEY (free at aistudio.google.com/apikey)
npm run models              # lists the models your key can use; set AI_MODEL to one
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
| `AI_PROVIDER` | no | `gemini` | `gemini` or `openai`. |
| `GEMINI_API_KEY` | yes, for Gemini | none | Secret key from https://aistudio.google.com/apikey. Server-side only. |
| `AI_MODEL` | yes | none (`.env.example` suggests `gemini-3.8-flash`) | Model ID. Run `npm run models` to see what your key can use. |
| `AI_THINKING_LEVEL` | no | model default | Gemini 3+ thinking effort: `minimal`, `low`, `medium`, `high`. `.env.example` uses `low` for quick replies. |
| `GEMINI_BASE_URL` | no | `https://generativelanguage.googleapis.com/v1beta` | Override for proxies/testing. |
| `OPENAI_API_KEY` / `OPENAI_BASE_URL` | only for `openai` | none / `https://api.openai.com/v1` | OpenAI or any OpenAI-compatible endpoint. |
| `PORT` | no | `8787` | API port. The Vite proxy reads it too. |
| `ALLOWED_ORIGINS` | no | `http://localhost:5173,http://127.0.0.1:5173` | Browser origins allowed to call the API. |
| `TRUST_PROXY` | no | `false` | Use `X-Forwarded-For` for rate limiting (set `true` behind a hosting proxy). |
| `AI_TIMEOUT_MS` | no | `30000` | Provider timeout (1,000 to 120,000). |
| `AI_MAX_OUTPUT_TOKENS` | no | `4096` | Max output tokens per reply. On Gemini this **includes thinking tokens**, so keep it generous. |
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
  "model": "gemini-3.8-flash", "provider": "gemini", "finishReason": "STOP" }
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
| 503 | `ai_busy` | Provider rate limited us (e.g. free-tier quota used up) |
| 422 | `ai_blocked` | The provider's safety filters blocked the message or reply (not retryable) |
| 504 | `ai_timeout` | Provider exceeded `AI_TIMEOUT_MS` |
| 502 | `ai_provider_error` | Any other provider failure (details only in server logs) |

`GET /api/health` → `{ "status": "ok", "aiConfigured": true | false }`.

Security controls: the system prompt lives on the server, and clients cannot
send `system` messages. The API key is never logged or returned. Provider
error bodies are not forwarded to the browser. Requests are limited by size,
rate, and origin, responses are `no-store`, and the provider call is aborted
if the browser disconnects.

## AI provider: Gemini (free tier)

Gemini is the default provider because Google AI Studio offers a free tier.
As of November 2026, Google's pricing page lists these text models as
free-tier eligible: `gemini-3.8-flash` (recommended for general chat),
`gemini-4-hydrogen`, `gemini-3.6-flash`, `gemini-3.5-flash-lite`, and
`gemini-3.1-flash-lite`. `gemini-2.5-*` models are deprecated and being routed
to newer ones by December 1, 2026. Model lists change, so run
`npm run models` with your key to see what is actually available, and check
https://aistudio.google.com/rate-limit for your free-tier limits.

**Privacy note:** on the free tier, Google states content may be used to
improve its products (paid tier: no). Life-planning chats can be personal, so
tell testers not to enter sensitive information, or enable billing before any
real users.

The integration uses Gemini's `generateContent` REST endpoint, which is
stateless (we send the conversation each turn) and does not store chats on
Google's side the way the newer Interactions API does by default. The key is
sent in the `x-goog-api-key` header, never in the URL. Thought parts are
stripped from replies. Gemini-specific outcomes (invalid key returned as 400,
quota 429, unknown model 404, safety blocks, thinking that uses the whole
token budget) are mapped to the API error codes below.

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
   - Environment: `GEMINI_API_KEY`, `AI_MODEL`, `AI_THINKING_LEVEL=low`,
     `ALLOWED_ORIGINS=https://jcodes101.github.io`, `TRUST_PROXY=true`.
     Most hosts set `PORT` automatically.
2. Check `https://<your-api-host>/api/health` returns `"aiConfigured": true`.
3. In the GitHub repo, go to Settings → Secrets and variables → Actions →
   Variables and add `VITE_AVEN_API_URL=https://<your-api-host>`. The Pages
   workflow passes it into the build.
4. Re-run the Pages deployment.

Cost safety: the endpoint has no user authentication yet (sign-in is
simulated), so anyone who finds the URL could use it within the rate limit.
On the Gemini free tier that means the shared daily quota can run out (users
then see "Aven is busy"); it won't create charges unless billing is enabled on
the Google Cloud project. Keep `RATE_LIMIT_MAX` low and add real
authentication when the auth work lands.

## Tests

```bash
npm test -- --runInBand     # all suites
npm run test:coverage       # with coverage thresholds (85%)
```

- `tests/server/*.test.ts` run in Node with a mocked provider (no paid API calls).
- `tests/unit/*.test.ts` cover storage, the API client, and helpers.
- `tests/RecentChats.test.tsx` and `tests/LifePlanningChat.test.tsx` drive the
  full app with a mocked `fetch`.
