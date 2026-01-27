/**
 * Jimmy — Cloudflare Worker (Rebuild 2026)
 * - Single source of truth via KV (no embedded behavior defaults)
 * - Draft → Publish → Rollback
 * - Policy enforcement after model response
 * - No retries (predictable latency)
 */

const CONFIG_ACTIVE_KEY = "jimmy:config:active";
const CONFIG_DRAFT_KEY = "jimmy:config:draft";
const CONFIG_HISTORY_KEY = "jimmy:config:history";
const ADMIN_KEY = "jimmy:admin";
const AUDIT_KEY = "jimmy:audit";

const MAX_HISTORY_ENTRIES = 20;
const MAX_AUDIT_ENTRIES = 200;

const MIN_TIMEOUT_MS = 2000;
const MAX_TIMEOUT_MS = 20000;
const MIN_MAX_LINES = 1;
const MAX_MAX_LINES = 12;
const MIN_FOLLOWUP_QUESTIONS = 0;
const MAX_FOLLOWUP_QUESTIONS = 3;
const MIN_MAX_HISTORY = 1;
const MAX_MAX_HISTORY = 30;
const MIN_MAX_INPUT_CHARS = 200;
const MAX_MAX_INPUT_CHARS = 8000;

const AI_MENTION_REGEX = /\b(ai|a\.i\.|openai|gpt-?\d*|chatgpt|gemini|anthropic|claude|llm|language model)\b/i;
const AI_MENTION_REGEX_AR = /(ذكاء اصطناعي|نموذج لغوي|جي بي تي|شات جي بي تي|جيميني|اوپن ايه اي|أوبن إيه آي)/i;
const EMOJI_REGEX = /[\p{Extended_Pictographic}\uFE0F]/gu;

function json(payload, status = 200, headers) {
  return new Response(JSON.stringify(payload), { status, headers });
}

function buildCorsHeaders(origin) {
  return {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": origin || "*",
    "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin",
  };
}

function parseAllowedOrigins(env) {
  const raw = env.ADMIN_ORIGINS || "https://emarketbank.github.io";
  return raw.split(",").map(s => s.trim()).filter(Boolean);
}

function getAdminHeaders(origin, allowedOrigins) {
  const allowOrigin = origin && allowedOrigins.includes(origin) ? origin : (origin ? "null" : "*");
  return buildCorsHeaders(allowOrigin);
}

function clampNumber(value, min, max) {
  const n = typeof value === "string" ? Number(value) : value;
  if (typeof n !== "number" || Number.isNaN(n)) return null;
  return Math.min(Math.max(n, min), max);
}

function requestId() {
  return `req_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function normalizeString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeStringArray(value) {
  if (!Array.isArray(value)) return [];
  return value
    .map(v => (typeof v === "string" ? v.trim() : ""))
    .filter(Boolean);
}

function normalizeConfig(input) {
  const config = input && typeof input === "object" ? input : {};

  return {
    version: normalizeString(config.version),
    status: normalizeString(config.status),
    default_language: config.default_language === "en" ? "en" : (config.default_language === "ar" ? "ar" : ""),
    system_prompt: {
      ar: normalizeString(config.system_prompt?.ar),
      en: normalizeString(config.system_prompt?.en),
    },
    verified_facts: {
      ar: normalizeString(config.verified_facts?.ar),
      en: normalizeString(config.verified_facts?.en),
    },
    contact_templates: {
      ar: normalizeString(config.contact_templates?.ar),
      en: normalizeString(config.contact_templates?.en),
    },
    identity_templates: {
      ar: normalizeString(config.identity_templates?.ar),
      en: normalizeString(config.identity_templates?.en),
    },
    fallback_messages: {
      ar: normalizeString(config.fallback_messages?.ar),
      en: normalizeString(config.fallback_messages?.en),
    },
    rules: {
      max_lines: clampNumber(config.rules?.max_lines, MIN_MAX_LINES, MAX_MAX_LINES),
      followup_questions: clampNumber(config.rules?.followup_questions, MIN_FOLLOWUP_QUESTIONS, MAX_FOLLOWUP_QUESTIONS),
      block_ai_mentions: typeof config.rules?.block_ai_mentions === "boolean" ? config.rules.block_ai_mentions : null,
      block_emojis: typeof config.rules?.block_emojis === "boolean" ? config.rules.block_emojis : null,
    },
    intent_rules: {
      contact_keywords: normalizeStringArray(config.intent_rules?.contact_keywords),
      identity_keywords: normalizeStringArray(config.intent_rules?.identity_keywords),
    },
    model_policy: {
      provider: normalizeString(config.model_policy?.provider).toLowerCase(),
      model: normalizeString(config.model_policy?.model),
      timeout_ms: clampNumber(config.model_policy?.timeout_ms, MIN_TIMEOUT_MS, MAX_TIMEOUT_MS),
      temperature: typeof config.model_policy?.temperature === "number" ? config.model_policy.temperature : null,
    },
    limits: {
      max_history: clampNumber(config.limits?.max_history, MIN_MAX_HISTORY, MAX_MAX_HISTORY),
      max_input_chars: clampNumber(config.limits?.max_input_chars, MIN_MAX_INPUT_CHARS, MAX_MAX_INPUT_CHARS),
    },
    updated_at: normalizeString(config.updated_at),
    updated_by: normalizeString(config.updated_by),
    published_at: normalizeString(config.published_at),
  };
}

function validateConfig(config) {
  const errors = [];

  if (!isNonEmptyString(config.system_prompt?.ar)) errors.push("system_prompt.ar is required");
  if (!isNonEmptyString(config.system_prompt?.en)) errors.push("system_prompt.en is required");
  if (!isNonEmptyString(config.contact_templates?.ar)) errors.push("contact_templates.ar is required");
  if (!isNonEmptyString(config.contact_templates?.en)) errors.push("contact_templates.en is required");
  if (!isNonEmptyString(config.identity_templates?.ar)) errors.push("identity_templates.ar is required");
  if (!isNonEmptyString(config.identity_templates?.en)) errors.push("identity_templates.en is required");
  if (!isNonEmptyString(config.fallback_messages?.ar)) errors.push("fallback_messages.ar is required");
  if (!isNonEmptyString(config.fallback_messages?.en)) errors.push("fallback_messages.en is required");

  if (config.rules?.max_lines == null) errors.push("rules.max_lines is required");
  if (config.rules?.followup_questions == null) errors.push("rules.followup_questions is required");
  if (typeof config.rules?.block_ai_mentions !== "boolean") errors.push("rules.block_ai_mentions is required");
  if (typeof config.rules?.block_emojis !== "boolean") errors.push("rules.block_emojis is required");

  if (!Array.isArray(config.intent_rules?.contact_keywords) || config.intent_rules.contact_keywords.length === 0) {
    errors.push("intent_rules.contact_keywords is required");
  }
  if (!Array.isArray(config.intent_rules?.identity_keywords) || config.intent_rules.identity_keywords.length === 0) {
    errors.push("intent_rules.identity_keywords is required");
  }

  const provider = config.model_policy?.provider;
  if (provider !== "openai" && provider !== "gemini") errors.push("model_policy.provider must be openai or gemini");
  if (!isNonEmptyString(config.model_policy?.model)) errors.push("model_policy.model is required");
  if (config.model_policy?.timeout_ms == null) errors.push("model_policy.timeout_ms is required");
  if (config.model_policy?.temperature != null) {
    const t = config.model_policy.temperature;
    if (typeof t !== "number" || Number.isNaN(t) || t < 0 || t > 1.2) {
      errors.push("model_policy.temperature must be between 0 and 1.2");
    }
  }

  if (config.limits?.max_history == null) errors.push("limits.max_history is required");
  if (config.limits?.max_input_chars == null) errors.push("limits.max_input_chars is required");

  if (config.default_language !== "ar" && config.default_language !== "en") {
    errors.push("default_language must be ar or en");
  }

  return { ok: errors.length === 0, errors };
}

function buildSystemPrompt(config, lang) {
  const base = lang === "en" ? config.system_prompt.en : config.system_prompt.ar;
  const facts = lang === "en" ? config.verified_facts.en : config.verified_facts.ar;
  const maxLines = config.rules?.max_lines;
  const followups = config.rules?.followup_questions;

  const ruleParts = [];
  if (typeof maxLines === "number") {
    ruleParts.push(lang === "en" ? `Max ${maxLines} lines.` : `حد أقصى ${maxLines} سطر.`);
  }
  if (typeof followups === "number") {
    ruleParts.push(lang === "en" ? `Up to ${followups} follow-up question(s).` : `سؤال متابعة بحد أقصى ${followups}.`);
  }
  if (config.rules?.block_ai_mentions) {
    ruleParts.push(lang === "en" ? "Do not mention AI/providers/models." : "ممنوع ذكر AI أو المزوّد أو الموديل.");
  }
  if (config.rules?.block_emojis) {
    ruleParts.push(lang === "en" ? "No emojis." : "بدون إيموجي.");
  }

  const rulesLine = ruleParts.length
    ? (lang === "en" ? `Rules: ${ruleParts.join(" ")}` : `قواعد إضافية: ${ruleParts.join(" ")}`)
    : "";

  return [base, facts, rulesLine].filter(part => part && part.trim().length).join("\n\n").trim();
}

function detectLang(body, defaultLang) {
  const explicit = (body?.language || "").toLowerCase();
  if (explicit === "ar" || explicit === "en") return explicit;

  const fallback = defaultLang === "en" ? "en" : "ar";
  const msgs = Array.isArray(body?.messages) ? body.messages : [];
  const lastUser = [...msgs].reverse().find(m => (m?.role || "").toLowerCase() === "user");
  const text = (lastUser?.content || "").toString();

  if (/[^\S\r\n]*[\u0600-\u06FF]/.test(text)) return "ar";
  if (/[A-Za-z]/.test(text)) return "en";
  return fallback;
}

function normalizeMessages(body, limits) {
  const raw = Array.isArray(body?.messages) ? body.messages : [];
  const maxHistory = limits.max_history;
  const maxChars = limits.max_input_chars;

  const cleaned = raw
    .map(m => {
      const roleRaw = (m?.role || "").toLowerCase();
      const role =
        roleRaw === "user" ? "user" :
        roleRaw === "assistant" || roleRaw === "model" ? "assistant" :
        null;

      const content = (m?.content || "").toString().trim();
      if (!role || !content) return null;
      return { role, content: content.slice(0, maxChars) };
    })
    .filter(Boolean);

  return cleaned.slice(-maxHistory);
}

function isIntent(messages, keywords) {
  const lastUser = [...messages].reverse().find(m => m.role === "user");
  if (!lastUser || !Array.isArray(keywords)) return false;
  const text = (lastUser.content || "").toLowerCase();
  return keywords.some(k => k && text.includes(k.toLowerCase()));
}

function containsAiMention(text) {
  return AI_MENTION_REGEX.test(text) || AI_MENTION_REGEX_AR.test(text);
}

function stripEmojis(text) {
  return text.replace(EMOJI_REGEX, "").replace(/[ \t]{2,}/g, " ").trim();
}

function sanitizeLines(text) {
  return text
    .replace(/\r\n/g, "\n")
    .replace(/[\t ]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function enforcePolicy(text, rules, lang, fallbackMessages) {
  let output = (text || "").toString().trim();
  if (!output) return fallbackMessages[lang] || fallbackMessages.en;

  output = sanitizeLines(output);

  if (rules.block_emojis) {
    output = stripEmojis(output);
  }

  if (rules.block_ai_mentions) {
    const lines = output.split("\n").filter(line => !containsAiMention(line));
    output = lines.join("\n").trim();
  }

  output = sanitizeLines(output);

  if (rules.max_lines) {
    const lines = output.split("\n").filter(Boolean);
    output = lines.slice(0, rules.max_lines).join("\n").trim();
  }

  if (!output || output.length < 2) {
    return fallbackMessages[lang] || fallbackMessages.en;
  }

  return output;
}

function enforceTemplatePolicy(text, rules, lang, fallbackMessages) {
  const templateRules = { ...rules, max_lines: null };
  return enforcePolicy(text, templateRules, lang, fallbackMessages);
}

function getContactTemplate(config, lang) {
  return lang === "en" ? config.contact_templates.en : config.contact_templates.ar;
}

function getIdentityTemplate(config, lang) {
  return lang === "en" ? config.identity_templates.en : config.identity_templates.ar;
}

function getFallbackMessage(config, lang) {
  return lang === "en" ? config.fallback_messages.en : config.fallback_messages.ar;
}

function withTimeout(ms) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), ms);
  return { signal: controller.signal, cancel: () => clearTimeout(id) };
}

async function safeFetch(url, options, timeoutMs) {
  const t = withTimeout(timeoutMs);
  try {
    return await fetch(url, { ...options, signal: t.signal });
  } finally {
    t.cancel();
  }
}

async function callOpenAI(env, model, messages, system, temperature, timeoutMs) {
  const res = await safeFetch(
    "https://api.openai.com/v1/chat/completions",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages: [{ role: "system", content: system }, ...messages],
        temperature: typeof temperature === "number" ? temperature : undefined,
      }),
    },
    timeoutMs
  );

  const text = await res.text();
  if (!res.ok) throw new Error("provider_error");
  const data = JSON.parse(text);
  return data?.choices?.[0]?.message?.content ?? "";
}

async function callGemini(env, model, messages, system, temperature, timeoutMs) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${env.GEMINI_API_KEY}`;

  const payload = {
    system_instruction: { parts: [{ text: system }] },
    contents: messages.map(m => ({
      role: m.role === "user" ? "user" : "model",
      parts: [{ text: m.content }],
    })),
  };

  if (typeof temperature === "number") {
    payload.generationConfig = { temperature };
  }

  const res = await safeFetch(
    url,
    { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) },
    timeoutMs
  );

  const text = await res.text();
  if (!res.ok) throw new Error("provider_error");
  const data = JSON.parse(text);
  return data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
}

async function routeModel(env, config, messages, system) {
  const provider = config.model_policy.provider;
  const model = config.model_policy.model;
  const timeoutMs = config.model_policy.timeout_ms;
  const temperature = config.model_policy.temperature;

  if (provider === "openai") {
    if (!env.OPENAI_API_KEY) throw new Error("missing_openai_key");
    return callOpenAI(env, model, messages, system, temperature, timeoutMs);
  }

  if (provider === "gemini") {
    if (!env.GEMINI_API_KEY) throw new Error("missing_gemini_key");
    return callGemini(env, model, messages, system, temperature, timeoutMs);
  }

  throw new Error("invalid_provider");
}

async function readKvJson(env, key) {
  if (!env.JIMMY_KV) return null;
  return env.JIMMY_KV.get(key, { type: "json" });
}

async function writeKvJson(env, key, value) {
  if (!env.JIMMY_KV) return null;
  await env.JIMMY_KV.put(key, JSON.stringify(value));
  return value;
}

function buildAuditEntry(action, meta = {}) {
  return {
    action,
    at: new Date().toISOString(),
    ...meta,
  };
}

async function appendAudit(env, entry) {
  if (!env.JIMMY_KV) return;
  const existing = (await readKvJson(env, AUDIT_KEY)) || [];
  const updated = [entry, ...existing].slice(0, MAX_AUDIT_ENTRIES);
  await writeKvJson(env, AUDIT_KEY, updated);
}

function makeVersionId() {
  const d = new Date();
  const pad = n => String(n).padStart(2, "0");
  return `v${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}-${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}`;
}

async function getAdminToken(env) {
  const stored = await readKvJson(env, ADMIN_KEY);
  const token = stored?.token || env.ADMIN_TOKEN || "";
  return { token, source: stored?.token ? "kv" : (env.ADMIN_TOKEN ? "env" : "none") };
}

async function requireAdminAuth(request, env, headers) {
  const auth = request.headers.get("Authorization") || "";
  const provided = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  const { token } = await getAdminToken(env);

  if (!token) {
    return { ok: false, response: json({ error: "Admin token not configured" }, 500, headers) };
  }

  if (!provided || provided !== token) {
    return { ok: false, response: json({ error: "Unauthorized" }, 401, headers) };
  }

  return { ok: true };
}

function getClientMeta(request) {
  return {
    ip: request.headers.get("CF-Connecting-IP") || "",
    ua: request.headers.get("User-Agent") || "",
  };
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const origin = request.headers.get("Origin") || "";
    const rid = requestId();

    // Preflight
    if (request.method === "OPTIONS") {
      if (url.pathname.startsWith("/admin")) {
        const allowedOrigins = parseAllowedOrigins(env);
        const headers = getAdminHeaders(origin, allowedOrigins);
        if (origin && !allowedOrigins.includes(origin)) {
          return json({ error: "Origin not allowed" }, 403, headers);
        }
        return new Response(null, { status: 204, headers });
      }
      return new Response(null, { status: 204, headers: buildCorsHeaders("*") });
    }

    // GET /
    if (request.method === "GET" && url.pathname === "/") {
      return json(
        {
          ok: true,
          service: "jimmy-worker",
          routes: [
            "GET /",
            "GET /health",
            "POST /chat",
            "GET /admin/config?state=active|draft",
            "POST /admin/config/draft",
            "POST /admin/config (alias for draft)",
            "POST /admin/publish",
            "POST /admin/rollback",
            "POST /admin/preview",
            "POST /admin/token/rotate",
            "GET /admin/audit",
          ],
        },
        200,
        buildCorsHeaders("*")
      );
    }

    // GET /health
    if (request.method === "GET" && url.pathname === "/health") {
      const active = env.JIMMY_KV ? await readKvJson(env, CONFIG_ACTIVE_KEY) : null;
      const admin = await getAdminToken(env);
      const providerChecks = { gemini: !!env.GEMINI_API_KEY, openai: !!env.OPENAI_API_KEY };
      return json(
        {
          status: "ok",
          timestamp: new Date().toISOString(),
          kv: !!env.JIMMY_KV,
          config_active: !!active,
          admin_token_source: admin.source,
          providers: providerChecks,
          checks: {
            kv_bound: !!env.JIMMY_KV,
            active_config_present: !!active,
            provider_key_present: providerChecks,
          },
        },
        200,
        buildCorsHeaders("*")
      );
    }

    // Admin endpoints
    if (url.pathname.startsWith("/admin")) {
      const allowedOrigins = parseAllowedOrigins(env);
      const headers = getAdminHeaders(origin, allowedOrigins);

      if (origin && !allowedOrigins.includes(origin)) {
        return json({ error: "Origin not allowed" }, 403, headers);
      }

      if (!env.JIMMY_KV) {
        return json({ error: "KV not configured" }, 500, headers);
      }

      const auth = await requireAdminAuth(request, env, headers);
      if (!auth.ok) return auth.response;

      if (request.method === "GET" && url.pathname === "/admin/config") {
        const state = (url.searchParams.get("state") || "active").toLowerCase();
        const key = state === "draft" ? CONFIG_DRAFT_KEY : CONFIG_ACTIVE_KEY;
        const config = await readKvJson(env, key);
        return json({ ok: true, config }, 200, headers);
      }

      if (request.method === "GET" && url.pathname === "/admin/audit") {
        const audit = (await readKvJson(env, AUDIT_KEY)) || [];
        return json({ ok: true, audit }, 200, headers);
      }

      if (request.method === "POST" && (url.pathname === "/admin/config/draft" || url.pathname === "/admin/config")) {
        let payload;
        try {
          payload = await request.json();
        } catch {
          return json({ error: "Invalid JSON" }, 400, headers);
        }

        const normalized = normalizeConfig(payload || {});
        if (!normalized.version) normalized.version = makeVersionId();
        normalized.status = "draft";
        normalized.updated_at = new Date().toISOString();
        normalized.updated_by = "admin";

        const validation = validateConfig(normalized);
        if (!validation.ok) {
          return json({ error: "Invalid config", details: validation.errors }, 400, headers);
        }

        await writeKvJson(env, CONFIG_DRAFT_KEY, normalized);
        await appendAudit(env, buildAuditEntry("draft_saved", { version: normalized.version, ...getClientMeta(request) }));

        return json({ ok: true, config: normalized }, 200, headers);
      }

      if (request.method === "POST" && url.pathname === "/admin/publish") {
        const draft = await readKvJson(env, CONFIG_DRAFT_KEY);
        if (!draft) {
          return json({ error: "No draft found" }, 400, headers);
        }

        const normalized = normalizeConfig(draft);
        const validation = validateConfig(normalized);
        if (!validation.ok) {
          return json({ error: "Invalid draft config", details: validation.errors }, 400, headers);
        }

        const active = await readKvJson(env, CONFIG_ACTIVE_KEY);
        const history = (await readKvJson(env, CONFIG_HISTORY_KEY)) || [];
        if (active) {
          const updatedHistory = [active, ...history].slice(0, MAX_HISTORY_ENTRIES);
          await writeKvJson(env, CONFIG_HISTORY_KEY, updatedHistory);
        }

        normalized.status = "active";
        normalized.published_at = new Date().toISOString();
        await writeKvJson(env, CONFIG_ACTIVE_KEY, normalized);
        await writeKvJson(env, CONFIG_DRAFT_KEY, null);

        await appendAudit(env, buildAuditEntry("published", { version: normalized.version, ...getClientMeta(request) }));

        return json({ ok: true, config: normalized }, 200, headers);
      }

      if (request.method === "POST" && url.pathname === "/admin/rollback") {
        const history = (await readKvJson(env, CONFIG_HISTORY_KEY)) || [];
        if (!history.length) {
          return json({ error: "No history to rollback" }, 400, headers);
        }

        const [previous, ...rest] = history;
        const current = await readKvJson(env, CONFIG_ACTIVE_KEY);
        const updatedHistory = current ? [current, ...rest].slice(0, MAX_HISTORY_ENTRIES) : rest;

        previous.status = "active";
        previous.published_at = new Date().toISOString();

        await writeKvJson(env, CONFIG_ACTIVE_KEY, previous);
        await writeKvJson(env, CONFIG_HISTORY_KEY, updatedHistory);

        await appendAudit(env, buildAuditEntry("rollback", { version: previous.version, ...getClientMeta(request) }));

        return json({ ok: true, config: previous }, 200, headers);
      }

      if (request.method === "POST" && url.pathname === "/admin/preview") {
        let payload;
        try {
          payload = await request.json();
        } catch {
          return json({ error: "Invalid JSON" }, 400, headers);
        }

        const draft = await readKvJson(env, CONFIG_DRAFT_KEY);
        if (!draft) {
          return json({ error: "No draft found" }, 400, headers);
        }

        const config = normalizeConfig(draft);
        const validation = validateConfig(config);
        if (!validation.ok) {
          return json({ error: "Invalid draft config", details: validation.errors }, 400, headers);
        }

        const messages = normalizeMessages(payload, config.limits);
        if (!messages.length) {
          return json({ error: "No messages provided" }, 400, headers);
        }

        const lang = detectLang(payload, config.default_language);

        if (isIntent(messages, config.intent_rules.contact_keywords)) {
          const template = getContactTemplate(config, lang);
          const enforced = enforceTemplatePolicy(template, config.rules, lang, config.fallback_messages);
          return json({ ok: true, response: enforced }, 200, headers);
        }

        if (isIntent(messages, config.intent_rules.identity_keywords)) {
          const template = getIdentityTemplate(config, lang);
          const enforced = enforceTemplatePolicy(template, config.rules, lang, config.fallback_messages);
          return json({ ok: true, response: enforced }, 200, headers);
        }

        const system = buildSystemPrompt(config, lang);
        const start = Date.now();

        try {
          const raw = await routeModel(env, config, messages, system);
          const enforced = enforcePolicy(raw, config.rules, lang, config.fallback_messages);
          const latency = Date.now() - start;
          console.log(JSON.stringify({ rid, endpoint: "preview", status: "ok", latency_ms: latency }));
          return json({ ok: true, response: enforced, latency_ms: latency }, 200, headers);
        } catch (err) {
          console.log(JSON.stringify({ rid, endpoint: "preview", status: "error", reason: err?.message || "provider_error" }));
          return json({ error: getFallbackMessage(config, lang) }, 503, headers);
        }
      }

      if (request.method === "POST" && url.pathname === "/admin/token/rotate") {
        let payload = {};
        try {
          payload = await request.json();
        } catch {
          payload = {};
        }

        const requested = normalizeString(payload.new_token);
        const newToken = requested || `adm_${Math.random().toString(36).slice(2)}_${Date.now().toString(36)}`;
        await writeKvJson(env, ADMIN_KEY, { token: newToken, rotated_at: new Date().toISOString() });

        await appendAudit(env, buildAuditEntry("token_rotated", { ...getClientMeta(request) }));

        return json({ ok: true, token: newToken }, 200, headers);
      }

      return json({ error: "Not Found" }, 404, headers);
    }

    // Only POST /chat
    if (!(request.method === "POST" && url.pathname === "/chat")) {
      return json({ error: "Not Found" }, 404, buildCorsHeaders("*"));
    }

    if (!env.JIMMY_KV) {
      return json({ response: "Service not configured.", request_id: rid }, 500, buildCorsHeaders("*"));
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return json({ response: "Invalid JSON", request_id: rid }, 400, buildCorsHeaders("*"));
    }

    const active = await readKvJson(env, CONFIG_ACTIVE_KEY);
    if (!active) {
      return json({ response: "Service not configured.", request_id: rid }, 503, buildCorsHeaders("*"));
    }

    const config = normalizeConfig(active);
    const validation = validateConfig(config);
    if (!validation.ok) {
      return json({ response: "Service misconfigured.", request_id: rid }, 500, buildCorsHeaders("*"));
    }

    const messages = normalizeMessages(body, config.limits);
    if (!messages.length) {
      return json({ response: "No messages provided.", request_id: rid }, 400, buildCorsHeaders("*"));
    }

    const lang = detectLang(body, config.default_language);

    if (isIntent(messages, config.intent_rules.contact_keywords)) {
      const template = getContactTemplate(config, lang);
      const enforced = enforceTemplatePolicy(template, config.rules, lang, config.fallback_messages);
      return json({ response: enforced, request_id: rid }, 200, buildCorsHeaders("*"));
    }

    if (isIntent(messages, config.intent_rules.identity_keywords)) {
      const template = getIdentityTemplate(config, lang);
      const enforced = enforceTemplatePolicy(template, config.rules, lang, config.fallback_messages);
      return json({ response: enforced, request_id: rid }, 200, buildCorsHeaders("*"));
    }

    const system = buildSystemPrompt(config, lang);
    const start = Date.now();

    try {
      const raw = await routeModel(env, config, messages, system);
      const enforced = enforcePolicy(raw, config.rules, lang, config.fallback_messages);
      const latency = Date.now() - start;
      console.log(JSON.stringify({ rid, endpoint: "chat", status: "ok", latency_ms: latency, provider: config.model_policy.provider, model: config.model_policy.model }));
      return json({ response: enforced, request_id: rid }, 200, buildCorsHeaders("*"));
    } catch (err) {
      console.log(JSON.stringify({ rid, endpoint: "chat", status: "error", reason: err?.message || "provider_error" }));
      return json({ response: getFallbackMessage(config, lang), request_id: rid }, 503, buildCorsHeaders("*"));
    }
  },
};
