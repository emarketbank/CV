# Mohamed Gamal CV Site

## Structure
- `index.html` - main site (English)
- `portfolio/` and `achievements/` - portfolio and achievements pages
- `assets/css/` - shared styles
- `assets/js/` - shared scripts
- `assets/docs/mohamed-gamal-cv.pdf` - downloadable CV
- `about-mo.gamal.md` - long-form bio copy
- `assets/captain-jimmy-prompt.txt` - Jimmy system prompt reference
- `jimmy-worker.js` - Cloudflare Worker (dynamic Jimmy config)
- `admin.html` - control panel (GitHub Pages)

## Architecture (MVP)
- Worker = engine only (routing, security, providers, normalization).
- On every `/chat` request, Worker loads KV config and builds:
  `system_prompt = system_prompt + "\n\n" + verified_facts`.
- If KV is missing or incomplete, Worker falls back to embedded defaults.

## Endpoints
- `POST /chat`
  - Public
  - CORS: `*`
  - Reads KV on every request

- `GET /admin`
- `POST /admin`
  - Private
  - CORS allowlist: `https://emarketbank.github.io`
  - Authorization: `Authorization: Bearer ADMIN_TOKEN`
  - Origin not allowed → `403`
  - Missing/invalid token → `401`

## KV config
- Binding: `JIMMY_KV`
- Key: `jimmy:config`

Schema (JSON):
- `system_prompt` (string, required)
- `verified_facts` (string, optional)
- `contact_templates` (object with `ar`, `en`)
- `default_language` (`ar` or `en`)
- `primary_provider` (`gemini` or `openai`)
- `models` (object with `gemini`, `openai`)
- `rules` (object with `max_lines`, `followup_questions`)

## Admin panel
- Hosted at: `https://emarketbank.github.io/CV/admin.html`
- Fields:
  - System Prompt
  - Verified Facts
  - Contact Templates (AR/EN)
  - Default Language / Primary Provider / Models
  - Rules (max lines + follow-up questions)
- Save writes directly to KV. Changes are live immediately.

## Behavior rules (write inside system_prompt)
- Responses are short.
- One follow-up question only.
- No contact suggestion unless the user asks.
- No hallucinated numbers or titles.
- Use KB facts only when directly relevant.

## System Prompt Template (Arabic)
أنت "كابتن جيمي" — المساعد الرسمي لمحمد جمال.
بتتكلم عربي مصري، هادي، مباشر، من غير تنظير.

قواعد الرد:
- 2 إلى 6 سطور فقط.
- سؤال متابعة واحد فقط في آخر سطر.
- ممنوع ذكر أي مزود/موديل/AI.
- ممنوع إيموجيز.
- ممنوع تقترح تواصل إلا لو المستخدم طلب صراحة.

قاعدة الحقائق:
- استخدم معلومات الـ Verified Facts فقط لو السؤال له علاقة مباشرة.
- لو مش متأكد: قول "مش متأكد" واطلب معلومة واحدة.

## Verified Facts Template (Arabic)
حقائق مؤكدة عن محمد جمال (استخدمها فقط عند الارتباط بالسؤال):
- [ضع الحقائق المؤكدة هنا بنقاط قصيرة]
- [أرقام مؤكدة فقط]

ممنوعات:
- أي منصب/رقم/إنجاز غير مؤكد.
- ممنوع ذكر كل الأرقام مرة واحدة.

## Testing (post-deploy)
- Run 3 requests (AR / EN / Contact) and review Worker logs.

## Language notes
- Arabic pages: `portfolio/index-ar.html`, `achievements/index-ar.html`
- Home is currently English-only; update links if you add an Arabic home page later.
