/**
 * Jimmy — Cloudflare Worker (Engine + Admin MVP)
 * - Routes: GET /, GET /health, POST /chat, GET/POST /admin/config
 * - Contact + Identity intents handled BEFORE AI
 * - KV-backed config with fallback defaults
 * - Hardcoded model waterfall (admin cannot change models)
 */

const MAX_RETRIES = 3;
const RETRY_BASE_DELAY_MS = 1000;
const DEFAULT_GEMINI_TIMEOUT_MS = 15000;
const DEFAULT_OPENAI_TIMEOUT_MS = 15000;
const DEFAULT_CONFIG_CACHE_TTL_MS = 90000;
const CONFIG_KEY = "jimmy:config";

const OPENAI_MODEL_WATERFALL = ["gpt-5.2", "gpt-5.1"];
const GEMINI_MODEL_WATERFALL = ["gemini-3-flash", "gemini-2.5-flash", "gemini-2.5-pro"];

const DEFAULT_CONFIG = {
  system_prompt: `أنت "كابتن جيمي" — المساعد الرسمي لمحمد جمال.
أنت مش محمد، وما ينفعش تدّعي إنك هو.
دورك توصل الناس لمحمد بسرعة وبوضوح.

قواعد اللغة:
- لو المستخدم عربي: رد مصري مهني مختصر.
- لو المستخدم إنجليزي: رد أمريكي مباشر.
- خلي اللغة ثابتة طول المحادثة.

قواعد الرد:
- أول رد ≤ 2 سطر، بعد كده ≤ 3 سطور.
- سؤال متابعة واحد فقط (لو محتاج).
- بدون أي ذكر لـ AI/مزود/موديل.
- بدون إيموجيز.

التواصل:
- ما تعرضش التواصل إلا لو المستخدم طلب صراحة.
- لو طلب تواصل: استخدم نص التواصل الثابت بالحرف.

خارج النطاق:
- لو طلب خطة/محتوى/بحث: قول إن محمد هو الأنسب وسأله لو يحب يتواصل.

ممنوعات:
- نصايح عامة طويلة.
- أي أرقام أو إنجازات غير مؤكدة.`,
  verified_facts: `حقائق مؤكدة فقط (استخدمها عند الارتباط بالسؤال):
- خبرة 10+ سنين في النمو الرقمي والتحول الرقمي في MENA مع تركيز قوي على السعودية.
- 6× نمو مبيعات/إيراد عضوي تقريبًا في Arabian Oud خلال ~24 شهر.
- إدارة إنفاق إعلاني يومي تقريبًا $12k–$20k عبر 6 أسواق.
- 7× نمو تعاقدات في DigiMora خلال حوالي سنة.
- مشاركة في Guinness World Record (5M orders، Black Friday 2020).`,
  contact_templates: {
    ar: "محمد هيكون سعيد يسمع منك.\nتحب مكالمة سريعة ولا واتساب؟\n\n📞 مكالمة: 00201555141282\n💬 واتساب: https://wa.me/201555141282",
    en: "Mohamed will be happy to hear from you.\nCall or WhatsApp — whatever works best.\n\n📞 Call: 00201555141282\n💬 WhatsApp: https://wa.me/201555141282",
  },
  default_language: "ar",
  primary_provider: "openai",
  rules: {
    max_lines: 3,
    followup_questions: 1,
  },
};

const IDENTITY_INTENT_REGEX = /(اسمك|اسم حضرتك|اسم حضرتك ايه|اسمك ايه|إنت مين|انت مين|مين انت|مين حضرتك|تعرفني بنفسك|who are you|your name|what is your name)/i;
const CONTACT_INTENT_REGEX = /(واتساب|whatsapp|رقم|number|مكالمة|call|تواصل|contact|اكلم|أتواصل|اتواصل|كلم|يوصلني|تحولني|وصلني)/i;

const IDENTITY_TEMPLATES = {
  ar: "أنا كابتن جيمي، المساعد الرسمي لمحمد جمال.\nدوري أجاوبك عن شغله وخبرته، ولو حابب أوصّلك بيه بسهولة.",
  en: "I’m Captain Jimmy, Mohamed Gamal’s official assistant.\nI help you understand his work and connect when needed.",
};

let configCache = { value: null, expiresAt: 0 };

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

function json(payload, status = 200, headers) {
  return new Response(JSON.stringify(payload), { status, headers });
}

function clampNumber(value, min, max, fallback) {
  const n = typeof value === "string" ? Number(value) : value;
  if (typeof n !== "number" || Number.isNaN(n)) return fallback;
  return Math.min(Math.max(n, min), max);
}

function requestId() {
  return `req_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function parseAllowedOrigins(env) {
  const raw = env.ADMIN_ORIGINS || "https://emarketbank.github.io";
  return raw.split(",").map(s => s.trim()).filter(Boolean);
}

function getAdminHeaders(origin, allowedOrigins) {
  const allowOrigin = origin && allowedOrigins.includes(origin) ? origin : (origin ? "null" : "*");
  return buildCorsHeaders(allowOrigin);
}

function getCacheTtlMs(env) {
  const ttlMs = env.CONFIG_CACHE_TTL_MS ? Number(env.CONFIG_CACHE_TTL_MS) : null;
  const ttlSec = env.CONFIG_CACHE_TTL_SEC ? Number(env.CONFIG_CACHE_TTL_SEC) * 1000 : null;
  return clampNumber(ttlMs || ttlSec, 30000, 300000, DEFAULT_CONFIG_CACHE_TTL_MS);
}

function mergeConfig(raw) {
  const config = {
    ...DEFAULT_CONFIG,
    ...(raw && typeof raw === "object" ? raw : {}),
  };

  config.contact_templates = {
    ...DEFAULT_CONFIG.contact_templates,
    ...(raw?.contact_templates || {}),
  };

  config.rules = {
    ...DEFAULT_CONFIG.rules,
    ...(raw?.rules || {}),
  };

  return config;
}

async function loadConfig(env) {
  if (!env.JIMMY_KV) return DEFAULT_CONFIG;

  const now = Date.now();
  if (configCache.value && now < configCache.expiresAt) {
    return configCache.value;
  }

  let raw = null;
  try {
    raw = await env.JIMMY_KV.get(CONFIG_KEY, { type: "json" });
  } catch (err) {
    console.warn("KV read failed", err?.message || err);
  }

  const merged = mergeConfig(raw || {});
  configCache = { value: merged, expiresAt: now + getCacheTtlMs(env) };
  return merged;
}

async function writeConfig(env, payload) {
  if (!env.JIMMY_KV) return null;
  const stored = {
    ...payload,
    updated_at: new Date().toISOString(),
  };

  await env.JIMMY_KV.put(CONFIG_KEY, JSON.stringify(stored));
  const merged = mergeConfig(stored);
  configCache = { value: merged, expiresAt: Date.now() + getCacheTtlMs(env) };
  return merged;
}

function detectLang(body, defaultLang) {
  const explicit = (body?.language || "").toLowerCase();
  if (explicit === "ar" || explicit === "en") return explicit;

  const fallback = (defaultLang || "ar").toLowerCase() === "en" ? "en" : "ar";
  const msgs = Array.isArray(body?.messages) ? body.messages : [];
  const lastUser = [...msgs].reverse().find(m => (m?.role || "").toLowerCase() === "user");
  const text = (lastUser?.content || "").toString();

  if (/[\u0600-\u06FF]/.test(text)) return "ar";
  if (/[A-Za-z]/.test(text)) return "en";
  return fallback;
}

function normalizeMessages(body, env) {
  const raw = Array.isArray(body?.messages) ? body.messages : [];

  const maxHistory = clampNumber(body?.max_history ?? env.MAX_HISTORY, 1, 30, 12);
  const maxChars = clampNumber(env.MAX_INPUT_CHARS, 500, 8000, 2500);

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

function isContactRequest(messages) {
  const lastUser = [...messages].reverse().find(m => m.role === "user");
  if (!lastUser) return false;
  return CONTACT_INTENT_REGEX.test(lastUser.content || "");
}

function isIdentityRequest(messages) {
  const lastUser = [...messages].reverse().find(m => m.role === "user");
  if (!lastUser) return false;
  return IDENTITY_INTENT_REGEX.test(lastUser.content || "");
}

function getContactTemplate(config, lang) {
  const template = config?.contact_templates?.[lang];
  if (typeof template === "string" && template.trim().length) {
    return template.trim();
  }
  return DEFAULT_CONFIG.contact_templates[lang] || DEFAULT_CONFIG.contact_templates.en;
}

function getIdentityTemplate(lang) {
  return IDENTITY_TEMPLATES[lang] || IDENTITY_TEMPLATES.en;
}

function buildSystemPrompt(config, lang) {
  const basePrompt = (typeof config?.system_prompt === "string" && config.system_prompt.trim())
    ? config.system_prompt.trim()
    : DEFAULT_CONFIG.system_prompt;

  const hasFacts = Object.prototype.hasOwnProperty.call(config || {}, "verified_facts");
  const facts = hasFacts
    ? (typeof config.verified_facts === "string" ? config.verified_facts.trim() : "")
    : DEFAULT_CONFIG.verified_facts;

  const maxLines = clampNumber(config?.rules?.max_lines, 1, 12, DEFAULT_CONFIG.rules.max_lines);
  const followups = clampNumber(config?.rules?.followup_questions, 0, 3, DEFAULT_CONFIG.rules.followup_questions);

  const langBlock = lang === "ar"
    ? "اللغة: عربي مصري مختصر، مباشر، بدون زخرفة."
    : "Language: American English. Be direct and concise.";

  const ruleBlock = lang === "ar"
    ? `قواعد إضافية: حد أقصى ${maxLines} سطر، سؤال متابعة بحد أقصى ${followups}.`
    : `Extra rules: max ${maxLines} lines, up to ${followups} follow-up question(s).`;

  const parts = [langBlock, basePrompt];
  if (facts) parts.push(facts);
  parts.push(ruleBlock);
  return parts.join("\n\n");
}

function selectPrimaryProvider(config, env) {
  const primary = (config?.primary_provider || env.PRIMARY_AI || DEFAULT_CONFIG.primary_provider || "openai").toLowerCase();
  return primary === "openai" ? "openai" : "gemini";
}

function getProviderModels(provider) {
  if (provider === "openai") return OPENAI_MODEL_WATERFALL;
  if (provider === "gemini") return GEMINI_MODEL_WATERFALL;
  return [];
}

function getServiceError(lang) {
  return lang === "en"
    ? "Service temporarily unavailable."
    : "الخدمة مشغولة دلوقتي. جرّب كمان شوية.";
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

async function safeFetchWithRetry(url, options, timeoutMs, rid) {
  let lastError = null;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const res = await safeFetch(url, options, timeoutMs);
      if (res.ok) return res;

      const retryable = res.status === 429 || res.status >= 500;
      if (!retryable) return res;

      lastError = new Error(`HTTP ${res.status}`);
      console.warn(`[${rid}] attempt ${attempt} => ${res.status}`);
    } catch (e) {
      lastError = e;
      console.warn(`[${rid}] attempt ${attempt} => ${e.message}`);
    }

    if (attempt < MAX_RETRIES) {
      const delay = RETRY_BASE_DELAY_MS * Math.pow(2, attempt - 1);
      await new Promise(r => setTimeout(r, delay));
    }
  }
  throw lastError || new Error("Max retries exceeded");
}

async function callGemini(env, model, messages, system, temperature, rid) {
  const timeoutMs = Number(env.GEMINI_TIMEOUT_MS || DEFAULT_GEMINI_TIMEOUT_MS);

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${env.GEMINI_API_KEY}`;

  const payload = {
    system_instruction: { parts: [{ text: system }] },
    contents: messages.map(m => ({
      role: m.role === "user" ? "user" : "model",
      parts: [{ text: m.content }],
    })),
  };

  if (typeof temperature === "number") payload.generationConfig = { temperature };

  const res = await safeFetchWithRetry(
    url,
    { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) },
    timeoutMs,
    rid
  );

  const text = await res.text();
  if (!res.ok) throw new Error(getServiceError("en"));

  const data = JSON.parse(text);
  return data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
}

async function callOpenAI(env, model, messages, system, temperature, rid) {
  const timeoutMs = Number(env.OPENAI_TIMEOUT_MS || DEFAULT_OPENAI_TIMEOUT_MS);

  const res = await safeFetchWithRetry(
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
        temperature,
      }),
    },
    timeoutMs,
    rid
  );

  const text = await res.text();
  if (!res.ok) throw new Error(getServiceError("en"));

  const data = JSON.parse(text);
  return data?.choices?.[0]?.message?.content ?? "";
}

async function routeAI(env, config, messages, system, temperature, rid) {
  const primary = selectPrimaryProvider(config, env);
  const order = primary === "openai" ? ["openai", "gemini"] : ["gemini", "openai"];

  for (const provider of order) {
    if (provider === "openai" && !env.OPENAI_API_KEY) continue;
    if (provider === "gemini" && !env.GEMINI_API_KEY) continue;

    const models = getProviderModels(provider);

    for (const model of models) {
      try {
        if (provider === "openai") {
          const out = await callOpenAI(env, model, messages, system, temperature, rid);
          if (out && out.trim()) return out;
        }

        if (provider === "gemini") {
          const out = await callGemini(env, model, messages, system, temperature, rid);
          if (out && out.trim()) return out;
        }
      } catch (e) {
        console.warn(`[${rid}] ${provider}:${model} failed`);
      }
    }
  }

  throw new Error(getServiceError("en"));
}

function sanitizeConfigInput(input) {
  const systemPrompt = typeof input?.system_prompt === "string" ? input.system_prompt.trim() : "";
  const verifiedFacts = typeof input?.verified_facts === "string" ? input.verified_facts.trim() : "";

  const contactAr = typeof input?.contact_templates?.ar === "string" ? input.contact_templates.ar.trim() : "";
  const contactEn = typeof input?.contact_templates?.en === "string" ? input.contact_templates.en.trim() : "";

  const defaultLanguage = input?.default_language === "en" ? "en" : "ar";
  const primaryProvider = input?.primary_provider === "openai" ? "openai" : "gemini";

  const rules = {
    max_lines: clampNumber(input?.rules?.max_lines, 1, 12, DEFAULT_CONFIG.rules.max_lines),
    followup_questions: clampNumber(input?.rules?.followup_questions, 0, 3, DEFAULT_CONFIG.rules.followup_questions),
  };

  return {
    system_prompt: systemPrompt,
    verified_facts: verifiedFacts,
    contact_templates: {
      ar: contactAr || DEFAULT_CONFIG.contact_templates.ar,
      en: contactEn || DEFAULT_CONFIG.contact_templates.en,
    },
    default_language: defaultLanguage,
    primary_provider: primaryProvider,
    rules,
  };
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const origin = request.headers.get("Origin") || "";

    // Preflight
    if (request.method === "OPTIONS") {
      if (url.pathname === "/admin/config") {
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
        { ok: true, service: "jimmy-worker", routes: ["GET /", "GET /health", "POST /chat", "GET /admin/config", "POST /admin/config"] },
        200,
        buildCorsHeaders("*")
      );
    }

    // GET /health
    if (request.method === "GET" && url.pathname === "/health") {
      return json(
        {
          status: "ok",
          timestamp: new Date().toISOString(),
          providers: { gemini: !!env.GEMINI_API_KEY, openai: !!env.OPENAI_API_KEY },
        },
        200,
        buildCorsHeaders("*")
      );
    }

    // Admin endpoint
    if (url.pathname === "/admin/config") {
      const allowedOrigins = parseAllowedOrigins(env);
      const headers = getAdminHeaders(origin, allowedOrigins);

      if (origin && !allowedOrigins.includes(origin)) {
        return json({ error: "Origin not allowed" }, 403, headers);
      }

      if (!env.JIMMY_KV) {
        return json({ error: "KV not configured" }, 500, headers);
      }

      const auth = request.headers.get("Authorization") || "";
      const token = env.ADMIN_TOKEN || "";
      const hasToken = auth.startsWith("Bearer ") ? auth.slice(7) : "";

      if (!token) {
        return json({ error: "Admin token not configured" }, 500, headers);
      }

      if (!hasToken || hasToken !== token) {
        return json({ error: "Unauthorized" }, 401, headers);
      }

      if (request.method === "GET") {
        const config = await loadConfig(env);
        return json({ ok: true, config }, 200, headers);
      }

      if (request.method === "POST") {
        let payload;
        try {
          payload = await request.json();
        } catch {
          return json({ error: "Invalid JSON" }, 400, headers);
        }

        const sanitized = sanitizeConfigInput(payload || {});
        if (!sanitized.system_prompt) {
          return json({ error: "system_prompt is required" }, 400, headers);
        }

        const updated = await writeConfig(env, sanitized);
        return json({ ok: true, config: updated }, 200, headers);
      }

      return json({ error: "Method Not Allowed" }, 405, headers);
    }

    // Only POST /chat
    if (!(request.method === "POST" && url.pathname === "/chat")) {
      return json({ error: "Not Found" }, 404, buildCorsHeaders("*"));
    }

    const rid = requestId();
    let body;

    try {
      body = await request.json();
    } catch {
      return json({ response: "Invalid JSON", request_id: rid }, 400, buildCorsHeaders("*"));
    }

    const messages = normalizeMessages(body, env);
    if (!messages.length) {
      return json({ response: "No messages provided.", request_id: rid }, 400, buildCorsHeaders("*"));
    }

    const config = await loadConfig(env);
    const lang = detectLang(body, config.default_language || "ar");

    if (isContactRequest(messages)) {
      return json({ response: getContactTemplate(config, lang), request_id: rid }, 200, buildCorsHeaders("*"));
    }

    if (isIdentityRequest(messages)) {
      return json({ response: getIdentityTemplate(lang), request_id: rid }, 200, buildCorsHeaders("*"));
    }

    if (!env.GEMINI_API_KEY && !env.OPENAI_API_KEY) {
      return json(
        { response: lang === "en" ? "Server misconfigured." : "إعدادات السيرفر ناقصة.", request_id: rid },
        500,
        buildCorsHeaders("*")
      );
    }

    const temperature = clampNumber(body?.temperature, 0, 1.2, Number(env.DEFAULT_TEMPERATURE || 0.5));
    const system = buildSystemPrompt(config, lang);

    try {
      const out = await routeAI(env, config, messages, system, temperature, rid);
      return json({ response: out, request_id: rid }, 200, buildCorsHeaders("*"));
    } catch {
      return json({ response: getServiceError(lang), request_id: rid }, 503, buildCorsHeaders("*"));
    }
  },
};
