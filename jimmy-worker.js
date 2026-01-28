/**
 * Jimmy AI Worker – Final Runtime (2026)
 * -------------------------------------
 * - Multi-brain (user / market / style)
 * - Conditional brain injection
 * - Gemini fallback with timeout
 * - KV + in-memory cache
 * - Locale aware
 * - Production safe
 */

/* =======================
   CONFIG
======================= */

const CACHE_TTL_MS = 60_000;

const DEFAULT_LIMITS = {
  rulesChars: 2500,
  userChars: 6000,
  marketChars: 7000,
  maxHistory: 10,
  maxMsgChars: 1200,
};

const GEMINI_MODELS_PRIORITY = [
  "gemini-3-flash",
  "gemini-2.5-flash",
  "gemini-2.0-flash",
  "gemini-1.5-flash",
];

/* =======================
   CACHE
======================= */

const cache = {
  items: new Map(),
};

const nowMs = () => Date.now();

/* =======================
   HELPERS
======================= */

function buildCorsHeaders() {
  return {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS, GET",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin",
  };
}

function jsonResponse(body, status = 200, headers = {}) {
  return new Response(JSON.stringify(body), { status, headers });
}

function getKv(env) {
  return env.JIMMY_KV || null;
}

function trimText(text, maxChars) {
  if (!text) return "";
  return text.length > maxChars ? text.slice(0, maxChars) : text;
}

/* =======================
   LOCALE
======================= */

function getLocale(request, body) {
  const bodyLang = String(body?.language || "").toLowerCase();
  const headerLang = (request.headers.get("accept-language") || "").toLowerCase();
  const raw = bodyLang || headerLang;

  if (!raw) return "en-us";

  if (raw.startsWith("ar")) {
    if (/(sa|ae|kw|qa|bh|om)/.test(raw)) return "ar-gulf";
    return "ar-eg";
  }

  if (raw.startsWith("en")) return "en-us";
  return "en-us";
}

/* =======================
   KV ACCESS
======================= */

async function getBrain(env, key) {
  const kv = getKv(env);
  if (!kv) throw new Error("MISSING_KV_BINDING");

  const cached = cache.items.get(key);
  const age = cached ? nowMs() - cached.fetchedAt : Infinity;

  if (cached && age <= CACHE_TTL_MS) {
    return cached.value;
  }

  const value = await kv.get(key);
  cache.items.set(key, { value, fetchedAt: nowMs() });
  return value;
}

function parseStyle(text) {
  if (!text) return null;
  const raw = String(text);
  const trimmed = raw.trim();
  if (!trimmed) return null;

  if (trimmed.startsWith("{")) {
    try {
      return JSON.parse(trimmed);
    } catch {
      // Fall through to plain-text parsing for resilience.
    }
  }

  const lines = raw.split(/\r?\n/);
  let inLimits = false;
  const limits = {};
  let mode = "default";
  const rulesLines = [];

  for (const line of lines) {
    const clean = line.trim();
    if (!clean) {
      if (!inLimits) rulesLines.push(line);
      continue;
    }

    if (clean.toLowerCase() === "[limits]") {
      inLimits = true;
      continue;
    }
    if (clean.toLowerCase() === "[/limits]") {
      inLimits = false;
      continue;
    }

    if (inLimits) {
      const match = clean.match(/^([a-z_]+)\s*=\s*(.+)$/i);
      if (match) {
        const key = match[1].toLowerCase();
        const value = match[2].trim();
        if (key === "mode") mode = value;
        if (key === "rules_chars") limits.rules_chars = Number(value) || limits.rules_chars;
        if (key === "user_chars") limits.user_chars = Number(value) || limits.user_chars;
        if (key === "market_chars") limits.market_chars = Number(value) || limits.market_chars;
      }
      continue;
    }

    rulesLines.push(line);
  }

  const rulesText = rulesLines.join("\n").trim();
  if (!rulesText) return null;

  return {
    rules_text: rulesText,
    limits,
    mode,
  };
}

/* =======================
   INTENT DETECTION (LIGHT)
======================= */

function normalizeText(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function detectIntent(lastMessage) {
  const text = normalizeText(lastMessage);
  if (!text) return "general";

  if (
    /(marketing|growth|ads|ad|paid|seo|crm|funnel|conversion|cvr|roas|cac|ltv|retention|checkout|logistics|ops|revenue|profit|margin|budget|campaign|offer|pricing|acquisition|lead|pipeline|b2b|b2c|ecommerce|e-commerce|meta|tiktok|snapchat|whatsapp|automation|payment|payback|contribution|attribution|organic|paid media|growth engine)/.test(
      text
    ) ||
    /(تسويق|نمو|اعلان|اعلانات|ميديا|سيو|crm|فانل|تحويل|روادس|روأس|كاك|لتي في|احتفاظ|شيك اوت|لوجستكس|تشغيل|تشغيلي|ايرادات|ربح|هامش|ميزانية|حملة|عرض|تسعير|استحواذ|ليد|بايبلاين|بي تو بي|بي تو سي|اي كوميرس|متاجر|متجر|ميتا|تيك توك|سناب|واتساب|اوتوميشن|دفع|باك بيريد|مساهمة|اتريبيوشن|اورجانيك|مدفوع)/.test(
      text
    )
  ) {
    return "market";
  }

  if (
    /(mohamed gamal|mohamed|gamal|cv|resume|portfolio|bio|background|experience|worked|who are you|who is|about you|your work)/.test(
      text
    ) ||
    /(محمد جمال|محمد|جمال|سيرة|سي في|سيڤي|بورتفوليو|خبرة|مين|من هو|عرفني عنك|عن خبرتك|انجازات|أعمالك|شغلك|خلفية)/.test(
      text
    )
  ) {
    return "user";
  }

  if (/(سلام|شكرا|مرحبا|hello|hi)/.test(text)) {
    return "casual";
  }

  return "general";
}

/* =======================
   SYSTEM PROMPT BUILDER
======================= */

function buildSystemPrompt({ style, userBrain, marketBrain, locale, intent }) {
  if (!style?.rules_text) throw new Error("MISSING_STYLE_RULES");

  const limits = style.limits || {};
  const rulesChars = limits.rules_chars || DEFAULT_LIMITS.rulesChars;
  const userChars = limits.user_chars || DEFAULT_LIMITS.userChars;
  const marketChars = limits.market_chars || DEFAULT_LIMITS.marketChars;

  const parts = [
    `MODE: ${style.mode || "default"}`,
    `LOCALE: ${locale}`,
    `STYLE_RULES:\n${trimText(style.rules_text, rulesChars)}`,
  ];

  // Conditional brain injection
  if (intent === "user" || style.mode === "hiring") {
    if (userBrain) {
      parts.push(`USER_BRAIN:\n${trimText(userBrain, userChars)}`);
    }
  }

  if (intent === "market" || style.mode === "diagnose") {
    if (marketBrain) {
      parts.push(`MARKET_BRAIN:\n${trimText(marketBrain, marketChars)}`);
    }
  }

  return parts.join("\n\n");
}

/* =======================
   MESSAGE NORMALIZATION
======================= */

function normalizeMessages(messages, maxHistory, maxMsgChars) {
  return (messages || [])
    .map((m) => {
      if (!m?.content) return null;
      return {
        role: m.role === "user" ? "user" : "model",
        parts: [{ text: trimText(String(m.content), maxMsgChars) }],
      };
    })
    .filter(Boolean)
    .slice(-maxHistory);
}

/* =======================
   GEMINI CALL
======================= */

function buildModelPriority(env) {
  const custom = (env.GEMINI_MODEL || "").trim();
  return custom
    ? Array.from(new Set([custom, ...GEMINI_MODELS_PRIORITY]))
    : GEMINI_MODELS_PRIORITY;
}

async function callGemini(env, payload, timeoutMs) {
  if (!env.GEMINI_API_KEY) throw new Error("MISSING_GEMINI_API_KEY");

  const models = buildModelPriority(env);

  for (const model of models) {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${env.GEMINI_API_KEY}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
          signal: controller.signal,
        }
      );

      if (!res.ok) throw new Error(await res.text());

      const data = await res.json();
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) throw new Error("EMPTY_RESPONSE");

      return text;
    } catch (err) {
      console.warn(`Model failed: ${model}`, err?.message);
    } finally {
      clearTimeout(t);
    }
  }

  throw new Error("ALL_MODELS_FAILED");
}

/* =======================
   WORKER
======================= */

export default {
  async fetch(request, env) {
    const cors = buildCorsHeaders();

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: cors });
    }

    const url = new URL(request.url);

    /* -------- PROBES -------- */

    if (request.method === "GET" && url.pathname === "/probe/flush") {
      cache.items.clear();
      return jsonResponse({ ok: true, cache: "cleared" }, 200, cors);
    }

    /* -------- CHAT -------- */

    if (request.method !== "POST" || url.pathname !== "/chat") {
      return jsonResponse({ response: "Method Not Allowed" }, 405, cors);
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return jsonResponse({ response: "JSON غير صالح" }, 400, cors);
    }

    if (!Array.isArray(body?.messages)) {
      return jsonResponse({ response: "messages مفقودة" }, 400, cors);
    }

    try {
      const locale = getLocale(request, body);
      const maxHistory = Number(env.MAX_HISTORY || DEFAULT_LIMITS.maxHistory);
      const maxMsgChars = Number(env.MAX_MSG_CHARS || DEFAULT_LIMITS.maxMsgChars);
      const timeoutMs = Number(env.PROVIDER_TIMEOUT_MS || 12000);

      const messages = normalizeMessages(body.messages, maxHistory, maxMsgChars);
      if (!messages.length) {
        return jsonResponse({ response: "الرسالة فارغة" }, 400, cors);
      }

      const lastUserMsg =
        body.messages.slice().reverse().find((m) => m.role === "user")?.content || "";

      const intent = detectIntent(lastUserMsg);

      const style = parseStyle(await getBrain(env, "jimmy:style"));
      const userBrain = intent === "user" ? await getBrain(env, "jimmy:kb:user") : "";
      const marketBrain = intent === "market" ? await getBrain(env, "jimmy:kb:market") : "";

      const systemPrompt = buildSystemPrompt({
        style,
        userBrain,
        marketBrain,
        locale,
        intent,
      });

      const payload = {
        system_instruction: { parts: [{ text: systemPrompt }] },
        contents: messages,
        generationConfig: {
          temperature: body.temperature ?? 0.6,
          maxOutputTokens: 800,
        },
      };

      const text = await callGemini(env, payload, timeoutMs);
      return jsonResponse({ response: text }, 200, cors);
    } catch (err) {
      console.error("Worker Error:", err);

      return jsonResponse(
        {
          response:
            "معلش، في مشكلة تقنية صغيرة دلوقتي. جرّب تاني بعد شوية.",
        },
        500,
        cors
      );
    }
  },
};
