# Mohamed Gamal CV Site

## Structure
- `index.html` - main site (English)
- `portfolio/` and `achievements/` - portfolio and achievements pages
- `assets/css/` - shared styles
- `assets/js/` - shared scripts (including the chat widget)
- `assets/docs/mohamed-gamal-cv.pdf` - downloadable CV
- `about-mo.gamal.md` - long-form bio copy
- `jimmy-worker.js` - Cloudflare Worker (engine + policy + admin API)
- `admin.html` - control panel (GitHub Pages)

## Architecture (Rebuild 2026)
- **Single Source of Truth**: Worker uses KV config only. No embedded behavior defaults.
- **Draft → Publish → Rollback**: Admin edits draft, publishes to active, and can roll back.
- **Policy Engine**: Enforces max lines + blocks AI mentions + emojis after the model responds.
- **Predictable Latency**: Single model per request, no retries.

## Endpoints
Public:
- `POST /chat`
  - CORS: `*`
  - Uses **active** config only

Health:
- `GET /health`
  - KV status, active config presence, provider key availability

Admin (private, CORS allowlist + Bearer token):
- `GET /admin/config?state=active|draft`
- `POST /admin/config/draft` (alias: `POST /admin/config`)
- `POST /admin/publish`
- `POST /admin/rollback`
- `POST /admin/preview`
- `POST /admin/token/rotate`
- `GET /admin/audit`

## KV Keys
- Binding: `JIMMY_KV`
- Keys:
  - `jimmy:config:active`
  - `jimmy:config:draft`
  - `jimmy:config:history`
  - `jimmy:admin`
  - `jimmy:audit`

## Config Schema (JSON)
Required fields:
- `default_language` (`ar` or `en`)
- `system_prompt` (`{ ar, en }`)
- `verified_facts` (`{ ar, en }`)
- `contact_templates` (`{ ar, en }`)
- `identity_templates` (`{ ar, en }`)
- `fallback_messages` (`{ ar, en }`)
- `rules` (`{ max_lines, followup_questions, block_ai_mentions, block_emojis }`)
- `intent_rules` (`{ contact_keywords[], identity_keywords[] }`)
- `model_policy` (`{ provider, model, timeout_ms, temperature? }`)
- `limits` (`{ max_history, max_input_chars }`)

Optional metadata:
- `version`, `updated_at`, `updated_by`, `published_at`

## Admin Panel
- Hosted at: `https://emarketbank.github.io/CV/admin.html`
- Features:
  - Draft → Publish → Rollback
  - AR / EN separated 100%
  - Playground testing against Draft
  - Token rotation
  - Audit log

## Notes
- No defaults: If no active config exists, `/chat` returns “Service not configured.”
- Update behavior only through Admin.
- Logs are JSON with latency and request ID.

## Repo hygiene (later)
- There are unrelated deletions/asset diffs in the repo. We will ignore them for now and run a cleanup sprint after the chat system stabilizes.

## Testing (post-deploy)
1) Create Draft from Admin.
2) Publish.
3) Run 3 requests (AR / EN / Contact) and verify logs + response rules.

## Language notes
- Arabic pages: `portfolio/index-ar.html`, `achievements/index-ar.html`
- Home is currently English-only; update links if you add an Arabic home page later.
