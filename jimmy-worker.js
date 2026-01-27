/**
 * Jimmy — Cloudflare Worker (Code-config, 2026)
 * - Single source of truth in code
 * - No Admin panel, no KV
 * - Policy enforcement after model response
 * - Waterfall with a fixed total timeout, no retries
 */

const CONFIG = {
  default_language: "ar",
  system_prompt: {
    ar: "أنت \"كابتن جيمي\" المساعد الرسمي لمحمد جمال.\nأنت مش محمد وماينفعش تدّعي إنك هو.\nهدفك: رد قصير واضح، حقائق مؤكدة فقط، وتوصيل العميل لمحمد عند الحاجة.\nاللغة: مصري مهني مختصر وثابت.\nلا تذكر الذكاء الاصطناعي أو المزوّد أو الموديل. بدون إيموجي.\nلا تعرض التواصل إلا بطلب صريح.\nلو الطلب خطة/محتوى/بحث أو خارج نطاقك: قول إن محمد الأنسب واسأله لو عايز يتواصل.",
    en: "You are \"Captain Jimmy\", Mohamed Gamal’s official assistant.\nYou are not Mohamed and never claim to be him.\nGoal: short, clear replies using verified facts only, and connect to Mohamed when needed.\nLanguage: direct American English and stay consistent.\nDo not mention AI/providers/models. No emojis.\nDo not offer contact unless explicitly requested.\nIf asked for plans/content/research, say Mohamed is best and ask if they want to reach him.",
  },
  verified_facts: {
    ar: "حقائق مؤكدة فقط:\n- خبرة 10+ سنوات في النمو الرقمي والتحول الرقمي في MENA مع تركيز على السعودية.\n- نمو عضوي ~6x في Arabian Oud خلال ~24 شهر.\n- إدارة إنفاق إعلاني يومي تقريباً $12k–$20k عبر 6 أسواق.\n- مشاركة في Guinness World Record (5M orders، Black Friday 2020).",
    en: "Verified facts only:\n- 10+ years in digital growth and transformation across MENA with strong KSA focus.\n- ~6x organic growth at Arabian Oud over ~24 months.\n- Managed daily ad spend ~$12k–$20k across 6 markets.\n- Participated in a Guinness World Record (5M orders, Black Friday 2020).",
  },
  contact_templates: {
    ar: "محمد هيكون سعيد يسمع منك.\nتحب مكالمة سريعة ولا واتساب؟\n\nمكالمة: 00201555141282\nواتساب: https://wa.me/201555141282",
    en: "Mohamed will be happy to hear from you.\nCall or WhatsApp — whatever works best.\n\nCall: 00201555141282\nWhatsApp: https://wa.me/201555141282",
  },
  identity_templates: {
    ar: "أنا كابتن جيمي، المساعد الرسمي لمحمد جمال.\nبدلّل الناس على شغله وخبرته، ولو حابب أوصّلك بيه بسهولة.",
    en: "I'm Captain Jimmy, Mohamed Gamal’s official assistant.\nI explain his work and can connect you with him if you want.",
  },
  fallback_messages: {
    ar: "الخدمة مشغولة دلوقتي. جرّب كمان شوية.",
    en: "Service temporarily unavailable. Please try again later.",
  },
  rules: {
    max_lines: 3,
    followup_questions: 1,
    block_ai_mentions: true,
    block_emojis: true,
  },
  intent_rules: {
    contact_keywords: [
      "عايز اكلم محمد",
      "عايز أكلم محمد",
      "اتواصل مع محمد",
      "عايز اتواصل مع محمد",
      "وصلني بمحمد",
      "عايز رقم محمد",
      "واتساب محمد",
      "مكالمة مع محمد",
      "عايز مكالمة مع محمد",
      "contact mohamed",
      "talk to mohamed",
      "reach mohamed",
      "call mohamed",
      "whatsapp mohamed",
      "get mohamed's number",
    ],
    identity_keywords: [
      "اسمك ايه",
      "اسمك إيه",
      "مين انت",
      "انت مين",
      "إنت مين",
      "تعرفني بنفسك",
      "انت جيمي",
      "جيمي مين",
      "who are you",
      "what is your name",
      "your name",
      "are you jimmy",
      "introduce yourself",
    ],
  },
  // للمطور: نفّذ Waterfall بالموديلات بالترتيب ده بدون retries وبمهلة إجمالية ثابتة CONFIG.timeouts.total_ms.
  // للمطور: الوقت يتوزع حسب المتبقي، وأول موديل يرجّع نص صالح يوقف السلسلة ويرجع الرد.
  model_waterfall: [
    { provider: "openai", model: "gpt-5.1" },
    { provider: "openai", model: "gpt-4.1-mini" },
    { provider: "gemini", model: "gemini-3-flash" },
    { provider: "gemini", model: "gemini-2.5-flash" },
    { provider: "gemini", model: "gemini-2.5-pro" },
  ],
  timeouts: {
    total_ms: 8000,
  },
  temperature: 0.4,
  limits: {
    max_history: 12,
    max_input_chars: 2500,
  },
};

const EMERGENCY_FALLBACK = {
  ar: "الخدمة مشغولة دلوقتي. جرّب كمان شوية.",
  en: "Service temporarily unavailable. Please try again later.",
};

let LAST_PROVIDER_USED = "";

const AI_MENTION_REGEX = /\b(ai|a\.i\.|openai|gpt-?\d*|chatgpt|gemini|anthropic|claude|llm|language model)\b/i;
const AI_MENTION_REGEX_AR = /(ذكاء اصطناعي|نموذج لغوي|جي بي تي|شات جي بي تي|جيميني|اوپن ايه اي|أوبن إيه آي)/i;
const EMOJI_REGEX = /[\p{Extended_Pictographic}\uFE0F]/gu;
const AI_MENTION_REGEX_GLOBAL = new RegExp(AI_MENTION_REGEX.source, "ig");
const AI_MENTION_REGEX_AR_GLOBAL = new RegExp(AI_MENTION_REGEX_AR.source, "ig");

function json(payload, status = 200, headers) {
  return new Response(JSON.stringify(payload), { status, headers });
}

function buildCorsHeaders(origin) {
  const allowOrigin = origin || "*";
  return {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin",
  };
}

function requestId() {
  return `req_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function clampNumber(value, min, max, fallback) {
  const n = typeof value === "string" ? Number(value) : value;
  if (typeof n !== "number" || Number.isNaN(n)) return fallback;
  return Math.min(Math.max(n, min), max);
}

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function normalizeMessages(body, limits) {
  const raw = Array.isArray(body?.messages) ? body.messages : [];
  const maxHistory = clampNumber(limits.max_history, 1, 30, 12);
  const maxChars = clampNumber(limits.max_input_chars, 200, 8000, 2500);

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

function detectLang(body, defaultLang) {
  const explicit = (body?.language || "").toLowerCase();
  if (explicit === "ar" || explicit === "en") return explicit;

  const fallback = defaultLang === "en" ? "en" : "ar";
  const msgs = Array.isArray(body?.messages) ? body.messages : [];
  const lastUser = [...msgs].reverse().find(m => (m?.role || "").toLowerCase() === "user");
  const text = (lastUser?.content || "").toString();

  if (/[\u0600-\u06FF]/.test(text)) return "ar";
  if (/[A-Za-z]/.test(text)) return "en";
  return fallback;
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

function redactAiMentions(text) {
  if (!text) return "";
  let output = text.toString();
  output = output.replace(AI_MENTION_REGEX_GLOBAL, "");
  output = output.replace(AI_MENTION_REGEX_AR_GLOBAL, "");
  output = output.replace(/\s{2,}/g, " ");
  output = output.replace(/\s+([,.!?])/g, "$1");
  output = output.replace(/\(\s*\)/g, "");
  return output.trim();
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
    const cleaned = output
      .split("\n")
      .map(line => {
        if (!containsAiMention(line)) return line;
        const redacted = redactAiMentions(line);
        if (!redacted) return "";
        if (containsAiMention(redacted)) return "";
        return redacted;
      })
      .filter(Boolean);

    output = cleaned.join("\n").trim();
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
    ruleParts.push(lang === "en" ? "Do not mention AI/providers/models." : "ممنوع ذكر الذكاء الاصطناعي أو المزوّد أو الموديل.");
  }
  if (config.rules?.block_emojis) {
    ruleParts.push(lang === "en" ? "No emojis." : "بدون إيموجي.");
  }

  const rulesLine = ruleParts.length
    ? (lang === "en" ? `Rules: ${ruleParts.join("\n")}` : `قواعد إضافية: ${ruleParts.join("\n")}`)
    : "";

  return [base, facts, rulesLine].filter(part => part && part.trim().length).join("\n\n").trim();
}

function getContactTemplate(config, lang) {
  return lang === "en" ? config.contact_templates.en : config.contact_templates.ar;
}

function getIdentityTemplate(config, lang) {
  return lang === "en" ? config.identity_templates.en : config.identity_templates.ar;
}

function getFallbackMessage(config, lang) {
  const fallback = config?.fallback_messages || EMERGENCY_FALLBACK;
  return lang === "en" ? fallback.en : fallback.ar;
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

  const maxLines = clampNumber(config.rules?.max_lines, 1, 12, null);
  const followups = clampNumber(config.rules?.followup_questions, 0, 3, null);
  if (maxLines == null) errors.push("rules.max_lines is required (1-12)");
  if (followups == null) errors.push("rules.followup_questions is required (0-3)");
  if (typeof config.rules?.block_ai_mentions !== "boolean") errors.push("rules.block_ai_mentions is required");
  if (typeof config.rules?.block_emojis !== "boolean") errors.push("rules.block_emojis is required");

  if (!Array.isArray(config.intent_rules?.contact_keywords) || !config.intent_rules.contact_keywords.length) {
    errors.push("intent_rules.contact_keywords is required");
  }
  if (!Array.isArray(config.intent_rules?.identity_keywords) || !config.intent_rules.identity_keywords.length) {
    errors.push("intent_rules.identity_keywords is required");
  }

  if (!Array.isArray(config.model_waterfall) || !config.model_waterfall.length) {
    errors.push("model_waterfall is required");
  } else {
    config.model_waterfall.forEach((entry, idx) => {
      const provider = (entry?.provider || "").toLowerCase();
      if (provider !== "openai" && provider !== "gemini") errors.push(`model_waterfall[${idx}].provider invalid`);
      if (!isNonEmptyString(entry?.model)) errors.push(`model_waterfall[${idx}].model is required`);
    });
  }

  const totalMs = clampNumber(config.timeouts?.total_ms, 1000, 30000, null);
  if (totalMs == null) errors.push("timeouts.total_ms is required (1000-30000)");

  if (config.temperature != null) {
    const t = config.temperature;
    if (typeof t !== "number" || Number.isNaN(t) || t < 0 || t > 1.2) {
      errors.push("temperature must be between 0 and 1.2");
    }
  }

  const maxHistory = clampNumber(config.limits?.max_history, 1, 30, null);
  const maxInput = clampNumber(config.limits?.max_input_chars, 200, 8000, null);
  if (maxHistory == null) errors.push("limits.max_history is required (1-30)");
  if (maxInput == null) errors.push("limits.max_input_chars is required (200-8000)");

  if (config.default_language !== "ar" && config.default_language !== "en") {
    errors.push("default_language must be ar or en");
  }

  return errors;
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

function extractOpenAIText(data) {
  if (typeof data?.output_text === "string" && data.output_text.trim()) {
    return data.output_text.trim();
  }

  const output = Array.isArray(data?.output) ? data.output : [];
  const parts = [];

  for (const item of output) {
    if (item?.type !== "message" || !Array.isArray(item?.content)) continue;
    for (const part of item.content) {
      if (part?.type === "output_text" && typeof part.text === "string") {
        parts.push(part.text);
      }
    }
  }

  return parts.join("\n").trim();
}

function buildOpenAIPayload(model, messages, system, temperature) {
  const inputItems = messages.map(m => ({
    role: m.role,
    content: [{ type: "input_text", text: m.content }],
  }));

  const payload = {
    model,
    input: inputItems,
    instructions: system,
  };

  if (typeof temperature === "number") {
    payload.temperature = temperature;
  }

  return payload;
}

async function callOpenAI(env, model, messages, system, temperature, timeoutMs) {
  const headers = {
    Authorization: `Bearer ${env.OPENAI_API_KEY}`,
    "Content-Type": "application/json",
  };

  const payload = buildOpenAIPayload(model, messages, system, temperature);

  const res = await safeFetch(
    "https://api.openai.com/v1/responses",
    {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
    },
    timeoutMs
  );

  const bodyText = await res.text();
  if (!res.ok) {
    const snippet = bodyText.slice(0, 200).replace(/\s+/g, " ");
    throw new Error(`openai:${model}:${res.status}:${snippet}`);
  }

  let data;
  try {
    data = JSON.parse(bodyText);
  } catch {
    throw new Error(`openai:${model}:${res.status}:invalid_json`);
  }

  const output = extractOpenAIText(data);
  if (!output) {
    throw new Error(`openai:${model}:${res.status}:empty_response`);
  }
  return output;
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

  const bodyText = await res.text();
  if (!res.ok) {
    const snippet = bodyText.slice(0, 200).replace(/\s+/g, " ");
    throw new Error(`gemini:${model}:${res.status}:${snippet}`);
  }

  let data;
  try {
    data = JSON.parse(bodyText);
  } catch {
    throw new Error(`gemini:${model}:${res.status}:invalid_json`);
  }

  const output = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
  if (!output || !output.trim()) {
    throw new Error(`gemini:${model}:${res.status}:empty_response`);
  }
  return output;
}

async function routeWaterfall(env, config, messages, system) {
  const order = Array.isArray(config.model_waterfall) ? config.model_waterfall : [];
  const totalTimeout = clampNumber(config.timeouts?.total_ms, 1000, 30000, 8000);
  const temperature = typeof config.temperature === "number" ? config.temperature : undefined;
  const deadline = Date.now() + totalTimeout;
  let lastError;

  const candidates = order.filter(item => {
    if (!item || !item.provider || !item.model) return false;
    const provider = item.provider.toLowerCase();
    if (provider === "openai") return !!env.OPENAI_API_KEY;
    if (provider === "gemini") return !!env.GEMINI_API_KEY;
    return false;
  });

  for (let i = 0; i < candidates.length; i += 1) {
    const item = candidates[i];
    const provider = item.provider.toLowerCase();
    const model = item.model;

    const remaining = deadline - Date.now();
    if (remaining <= 0) break;

    const remainingModels = candidates.length - i;
    const baseBudget = Math.floor(remaining / remainingModels);
    const timeoutMs = Math.min(remaining, Math.max(1200, baseBudget));

    try {
      if (provider === "openai") {
        const out = await callOpenAI(env, model, messages, system, temperature, timeoutMs);
        if (out && out.trim()) return { text: out, provider, model };
      }

      if (provider === "gemini") {
        const out = await callGemini(env, model, messages, system, temperature, timeoutMs);
        if (out && out.trim()) return { text: out, provider, model };
      }
    } catch (err) {
      lastError = err;
      continue;
    }
  }

  throw lastError || new Error("provider_error");
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const origin = request.headers.get("Origin") || "";
    const rid = requestId();

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: buildCorsHeaders(origin) });
    }

    if (request.method === "GET" && url.pathname === "/") {
      return json(
        { ok: true, service: "jimmy-worker", routes: ["GET /", "GET /health", "GET /probe/openai", "POST /chat"] },
        200,
        buildCorsHeaders(origin)
      );
    }

    if (request.method === "GET" && url.pathname === "/probe/openai") {
      const modelEntry = (CONFIG.model_waterfall || []).find(
        item => (item?.provider || "").toLowerCase() === "openai"
      );
      const model = modelEntry?.model || "";

      if (!model) {
        return json(
          { ok: false, provider: "openai", model, status_code: 0, error: "missing_openai_model", request_id: rid },
          500,
          buildCorsHeaders(origin)
        );
      }

      if (!env.OPENAI_API_KEY) {
        return json(
          { ok: false, provider: "openai", model, status_code: 0, error: "missing_openai_key", request_id: rid },
          503,
          buildCorsHeaders(origin)
        );
      }

      const payload = buildOpenAIPayload(
        model,
        [{ role: "user", content: "ping" }],
        "Health probe",
        0
      );

      try {
        const res = await safeFetch(
          "https://api.openai.com/v1/responses",
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${env.OPENAI_API_KEY}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify(payload),
          },
          clampNumber(CONFIG.timeouts?.total_ms, 1000, 30000, 8000)
        );

        const bodyText = await res.text();
        if (!res.ok) {
          const snippet = bodyText.slice(0, 200).replace(/\s+/g, " ");
          return json(
            { ok: false, provider: "openai", model, status_code: res.status, error: snippet, request_id: rid },
            502,
            buildCorsHeaders(origin)
          );
        }

        let data;
        try {
          data = JSON.parse(bodyText);
        } catch {
          return json(
            { ok: false, provider: "openai", model, status_code: res.status, error: "invalid_json", request_id: rid },
            502,
            buildCorsHeaders(origin)
          );
        }

        const output = extractOpenAIText(data);
        return json(
          {
            ok: true,
            provider: "openai",
            model,
            status_code: res.status,
            output_preview: (output || "").slice(0, 120),
            request_id: rid,
          },
          200,
          buildCorsHeaders(origin)
        );
      } catch (err) {
        const message = (err?.message || "probe_error").slice(0, 200);
        return json(
          { ok: false, provider: "openai", model, status_code: 0, error: message, request_id: rid },
          502,
          buildCorsHeaders(origin)
        );
      }
    }

    if (request.method === "GET" && url.pathname === "/health") {
      const errors = validateConfig(CONFIG);
      const waterfall = Array.isArray(CONFIG.model_waterfall)
        ? CONFIG.model_waterfall.map(item => `${item.provider}:${item.model}`).join(" > ")
        : "";
      return json(
        {
          status: "ok",
          timestamp: new Date().toISOString(),
          request_id: rid,
          config_loaded: true,
          config_valid: errors.length === 0,
          config_errors: errors,
          provider: CONFIG.model_waterfall?.[0]?.provider || "",
          has_keys: { gemini: !!env.GEMINI_API_KEY, openai: !!env.OPENAI_API_KEY },
          last_provider_used: LAST_PROVIDER_USED,
          waterfall,
          provider_key_present: { gemini: !!env.GEMINI_API_KEY, openai: !!env.OPENAI_API_KEY },
          provider_in_use: CONFIG.model_waterfall?.[0]?.provider || "",
        },
        200,
        buildCorsHeaders(origin)
      );
    }

    if (!(request.method === "POST" && url.pathname === "/chat")) {
      return json({ error: "Not Found" }, 404, buildCorsHeaders(origin));
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return json({ response: "Invalid JSON", request_id: rid }, 400, buildCorsHeaders(origin));
    }

    const errors = validateConfig(CONFIG);
    if (errors.length) {
      console.log(JSON.stringify({ rid, endpoint: "chat", status: "error", reason: "config_invalid", errors }));
      const lang = detectLang(body, CONFIG.default_language || "ar");
      return json({ response: getFallbackMessage(CONFIG, lang), request_id: rid }, 500, buildCorsHeaders(origin));
    }

    const messages = normalizeMessages(body, CONFIG.limits);
    if (!messages.length) {
      return json({ response: "No messages provided.", request_id: rid }, 400, buildCorsHeaders(origin));
    }

    const lang = detectLang(body, CONFIG.default_language || "ar");

    if (isIntent(messages, CONFIG.intent_rules.contact_keywords)) {
      const template = getContactTemplate(CONFIG, lang);
      const enforced = enforceTemplatePolicy(template, CONFIG.rules, lang, CONFIG.fallback_messages);
      return json({ response: enforced, request_id: rid }, 200, buildCorsHeaders(origin));
    }

    if (isIntent(messages, CONFIG.intent_rules.identity_keywords)) {
      const template = getIdentityTemplate(CONFIG, lang);
      const enforced = enforceTemplatePolicy(template, CONFIG.rules, lang, CONFIG.fallback_messages);
      return json({ response: enforced, request_id: rid }, 200, buildCorsHeaders(origin));
    }

    const system = buildSystemPrompt(CONFIG, lang);
    const start = Date.now();

    try {
      const result = await routeWaterfall(env, CONFIG, messages, system);
      LAST_PROVIDER_USED = result?.provider && result?.model ? `${result.provider}:${result.model}` : (result?.provider || "");
      const enforced = enforcePolicy(result.text, CONFIG.rules, lang, CONFIG.fallback_messages);
      const latency = Date.now() - start;
      console.log(JSON.stringify({ rid, endpoint: "chat", status: "ok", latency_ms: latency, provider: result.provider, model: result.model }));
      return json({ response: enforced, request_id: rid }, 200, buildCorsHeaders(origin));
    } catch (err) {
      console.log(JSON.stringify({ rid, endpoint: "chat", status: "error", reason: err?.message || "provider_error" }));
      return json({ response: getFallbackMessage(CONFIG, lang), request_id: rid }, 503, buildCorsHeaders(origin));
    }
  },
};
