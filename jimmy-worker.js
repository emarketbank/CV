/**
 * Jimmy — Cloudflare Worker (Standardized SSE, 2026)
 * - Unified SSE protocol: meta -> token -> done (+ error)
 * - No raw passthrough: worker normalizes OpenAI/Gemini/Intents into same stream
 * - CORS allowlist + explicit 403
 * - Waterfall: OpenAI primary, Gemini fallback
 * - Structured logs
 */

const CONFIG = {
  default_language: "ar",
  allowed_origins: [
    "https://emarketbank.github.io",
  ],

  // NOTE: Keep prompts short, directive, and stable.
  system_prompt: {
    ar:
      'أنت "كابتن جيمي" المساعد الرسمي لمحمد جمال.\n' +
      "أنت مش محمد وماينفعش تدّعي إنك هو.\n" +
      "هدفك: رد قصير واضح، حقائق مؤكدة فقط، وتوصيل العميل لمحمد عند الحاجة.\n" +
      "اللغة: مصري مهني مختصر وثابت.\n" +
      "لا تذكر الذكاء الاصطناعي أو المزوّد أو الموديل. بدون إيموجي.\n" +
      "لا تعرض التواصل إلا بطلب صريح.\n" +
      "لو الطلب خطة/محتوى/بحث أو خارج نطاقك: قول إن محمد الأنسب واسأله لو عايز يتواصل.",
    en:
      'You are "Captain Jimmy", Mohamed Gamal’s official assistant.\n' +
      "You are not Mohamed and never claim to be him.\n" +
      "Goal: short, clear replies using verified facts only, and connect to Mohamed when needed.\n" +
      "Language: direct American English and stay consistent.\n" +
      "Do not mention AI/providers/models. No emojis.\n" +
      "Do not offer contact unless explicitly requested.\n" +
      "If asked for plans/content/research, say Mohamed is best and ask if they want to reach him.",
  },

  verified_facts: {
    ar:
      "حقائق مؤكدة فقط:\n" +
      "- خبرة 10+ سنوات في النمو الرقمي والتحول الرقمي في MENA مع تركيز على السعودية.\n" +
      "- نمو عضوي ~6x في Arabian Oud خلال ~24 شهر.\n" +
      "- إدارة إنفاق إعلاني يومي تقريباً $12k–$20k عبر 6 أسواق.\n" +
      "- مشاركة في Guinness World Record (5M orders، Black Friday 2020).",
    en:
      "Verified facts only:\n" +
      "- 10+ years in digital growth and transformation across MENA with strong KSA focus.\n" +
      "- ~6x organic growth at Arabian Oud over ~24 months.\n" +
      "- Managed daily ad spend ~$12k–$20k across 6 markets.\n" +
      "- Participated in a Guinness World Record (5M orders, Black Friday 2020).",
  },

  contact_templates: {
    ar:
      "محمد هيكون سعيد يسمع منك.\n" +
      "تحب مكالمة سريعة ولا واتساب؟\n\n" +
      "مكالمة: 00201555141282\n" +
      "واتساب: https://wa.me/201555141282",
    en:
      "Mohamed will be happy to hear from you.\n" +
      "Call or WhatsApp — whatever works best.\n\n" +
      "Call: 00201555141282\n" +
      "WhatsApp: https://wa.me/201555141282",
  },

  identity_templates: {
    ar:
      "أنا كابتن جيمي، المساعد الرسمي لمحمد جمال.\n" +
      "بدلّل الناس على شغله وخبرته، ولو حابب أوصّلك بيه بسهولة.",
    en:
      "I'm Captain Jimmy, Mohamed Gamal’s official assistant.\n" +
      "I explain his work and can connect you with him if you want.",
  },

  fallback_messages: {
    ar: "الخدمة مشغولة دلوقتي. جرّب كمان شوية.",
    en: "Service temporarily unavailable. Please try again later.",
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

  // Waterfall provider list:
  model_waterfall: [
    { provider: "openai", model: "gpt-5.1" },
    { provider: "gemini", model: "gemini-3-flash" },
  ],

  timeouts: { total_ms: 25000 },
  temperature: 0.4,

  limits: {
    max_history: 12,
    max_input_chars: 2500,
  },

  // Fake stream behavior:
  fake_stream: {
    chunk_ms: 18, // feel free to tune
    max_chunk: 8, // characters per chunk
  },

  // Optional keepalive for long answers:
  heartbeat_ms: 15000,
};

// -------------------- Utilities --------------------

function nowMs() {
  return Date.now();
}

function requestId() {
  return `req_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function safeJsonParse(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function pickLanguage(payload, lastUserMessage) {
  // Prefer explicit payload language if provided
  const lang = (payload?.language || "").toLowerCase();
  if (lang === "ar" || lang === "en") return lang;

  // Auto-detect from last user message
  const msg = (lastUserMessage || "").trim();
  const hasArabic = /[\u0600-\u06FF]/.test(msg);
  return hasArabic ? "ar" : "en";
}

function normalizeMessages(messages) {
  if (!Array.isArray(messages)) return [];
  const out = [];

  for (const m of messages) {
    if (!m || typeof m !== "object") continue;
    let role = (m.role || "").toLowerCase();
    const content = typeof m.content === "string" ? m.content : "";

    if (!content.trim()) continue;

    // normalize roles
    if (role === "model") role = "assistant";
    if (role !== "user" && role !== "assistant" && role !== "system") continue;

    out.push({ role, content: content.trim() });
  }

  // trim history
  return out.slice(-CONFIG.limits.max_history);
}

function truncateText(s, maxChars) {
  if (typeof s !== "string") return "";
  if (s.length <= maxChars) return s;
  return s.slice(0, maxChars);
}

function findLastUser(messages) {
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i]?.role === "user") return messages[i].content || "";
  }
  return "";
}

function detectIntent(text) {
  const t = (text || "").toLowerCase();
  const has = (arr) => arr.some((k) => t.includes(k.toLowerCase()));

  if (has(CONFIG.intent_rules.contact_keywords)) return "contact";
  if (has(CONFIG.intent_rules.identity_keywords)) return "identity";
  return null;
}

function buildCorsHeaders(origin) {
  const isAllowed = CONFIG.allowed_origins.includes(origin);
  // IMPORTANT: for disallowed origin, do not pretend "null" is ok; we will 403 anyway.
  return {
    "Access-Control-Allow-Origin": isAllowed ? origin : "",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}

function buildSSEHeaders(origin) {
  const cors = buildCorsHeaders(origin);
  return {
    ...cors,
    "Content-Type": "text/event-stream; charset=utf-8",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
  };
}

// -------------------- SSE Formatter (Unified Contract) --------------------

const SSE = {
  // data must be JSON-serializable object
  meta: (obj) => `event: meta\ndata: ${JSON.stringify(obj)}\n\n`,

  // IMPORTANT: data is always JSON string (quoted) produced by JSON.stringify.
  token: (text) => `event: token\ndata: ${JSON.stringify(String(text))}\n\n`,

  done: () => `event: done\ndata: {}\n\n`,

  error: (obj) =>
    `event: error\ndata: ${JSON.stringify({
      message: obj?.message || "Error",
      code: obj?.code || "ERR",
    })}\n\n`,
};

// -------------------- Provider Calls --------------------

async function callOpenAI({ apiKey, model, system, messages, temperature, timeoutMs, signal }) {
  // Uses Responses API (v1/responses) with streaming.
  // We request text output and stream SSE.
  const url = "https://api.openai.com/v1/responses";

  const input = [
    { role: "system", content: system },
    ...messages,
  ];

  const body = {
    model,
    input,
    temperature,
    stream: true,
  };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort("timeout"), timeoutMs);
  const compositeSignal = anySignal([signal, controller.signal]);

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    signal: compositeSignal,
  });

  clearTimeout(timer);

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`OpenAI HTTP ${res.status}: ${text.slice(0, 200)}`);
  }

  if (!res.body) throw new Error("OpenAI: missing response body");

  // Convert OpenAI's stream (SSE-ish) into unified token events.
  return normalizeOpenAIStreamToTokens(res.body);
}

async function callGemini({ apiKey, model, system, messages, temperature, timeoutMs, signal }) {
  // Gemini streaming endpoint. We'll use generateContent?alt=sse for SSE output.
  // NOTE: This is a typical Gemini pattern; if your existing impl differs, adjust here.
  const url =
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
      model
    )}:streamGenerateContent?alt=sse&key=${encodeURIComponent(apiKey)}`;

  // Convert messages to Gemini "contents" format
  const contents = messages.map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }],
  }));

  const body = {
    systemInstruction: { parts: [{ text: system }] },
    contents,
    generationConfig: { temperature },
  };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort("timeout"), timeoutMs);
  const compositeSignal = anySignal([signal, controller.signal]);

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: compositeSignal,
  });

  clearTimeout(timer);

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Gemini HTTP ${res.status}: ${text.slice(0, 200)}`);
  }

  if (!res.body) throw new Error("Gemini: missing response body");

  // Convert Gemini SSE stream into unified tokens
  return normalizeGeminiStreamToTokens(res.body);
}

// -------------------- Stream Normalizers --------------------

function anySignal(signals) {
  // Minimal polyfill for combining abort signals
  const controller = new AbortController();
  const onAbort = () => controller.abort();
  for (const s of signals) {
    if (!s) continue;
    if (s.aborted) return s;
    s.addEventListener?.("abort", onAbort, { once: true });
  }
  return controller.signal;
}

function createSSEParser() {
  // Parses SSE lines into {event, data} records.
  let buffer = "";
  return {
    push(chunk) {
      buffer += chunk;
      const events = [];
      const parts = buffer.split("\n\n");
      buffer = parts.pop() || "";
      for (const part of parts) {
        const lines = part.split("\n");
        let event = "message";
        let data = "";
        for (const line of lines) {
          if (line.startsWith("event:")) event = line.slice(6).trim();
          else if (line.startsWith("data:")) data += line.slice(5).trim();
        }
        events.push({ event, data });
      }
      return events;
    },
    flush() {
      buffer = "";
    },
  };
}

function normalizeOpenAIStreamToTokens(readable) {
  // OpenAI returns SSE-ish with "data: {...}" lines.
  // We'll extract text deltas if present; otherwise ignore.
  const decoder = new TextDecoder();
  const parser = createSSEParser();

  const stream = new ReadableStream({
    async start(controller) {
      const reader = readable.getReader();
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value, { stream: true });
          const events = parser.push(chunk);

          for (const ev of events) {
            const raw = ev.data;
            if (!raw || raw === "[DONE]") continue;

            const obj = safeJsonParse(raw);
            if (!obj) continue;

            // We try multiple known shapes safely:
            // - Responses API: response.output_text.delta might exist
            // - Or generic "delta" events
            const delta =
              obj?.delta ||
              obj?.response?.output_text?.delta ||
              obj?.output_text?.delta ||
              obj?.content?.[0]?.text?.delta;

            const text =
              typeof delta === "string"
                ? delta
                : typeof obj?.text === "string"
                  ? obj.text
                  : null;

            if (text) controller.enqueue(text);
          }
        }
      } finally {
        controller.close();
      }
    },
  });

  return stream;
}

function normalizeGeminiStreamToTokens(readable) {
  // Gemini with alt=sse sends events with data: {json}
  // We'll extract candidates[0].content.parts[].text
  const decoder = new TextDecoder();
  const parser = createSSEParser();

  const stream = new ReadableStream({
    async start(controller) {
      const reader = readable.getReader();
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value, { stream: true });
          const events = parser.push(chunk);

          for (const ev of events) {
            const obj = safeJsonParse(ev.data);
            if (!obj) continue;

            const parts =
              obj?.candidates?.[0]?.content?.parts ||
              obj?.candidates?.[0]?.content?.parts ||
              [];

            for (const p of parts) {
              if (typeof p?.text === "string" && p.text) controller.enqueue(p.text);
            }
          }
        }
      } finally {
        controller.close();
      }
    },
  });

  return stream;
}

// -------------------- Fake Streaming for Intents --------------------

async function fakeStreamText(text, controller, { chunk_ms, max_chunk }) {
  const s = String(text || "");
  let i = 0;
  while (i < s.length) {
    const chunk = s.slice(i, i + max_chunk);
    controller.enqueue(SSE.token(chunk));
    i += max_chunk;
    // small delay for "typing" feel
    await sleep(chunk_ms);
  }
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

// -------------------- Main Chat Handler --------------------

async function handleChat(request, env) {
  const origin = request.headers.get("Origin") || "";
  const isAllowed = CONFIG.allowed_origins.includes(origin);

  if (!isAllowed) {
    return new Response("Forbidden", {
      status: 403,
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        Vary: "Origin",
      },
    });
  }

  const rid = requestId();
  const started = nowMs();

  let payload = null;
  try {
    payload = await request.json();
  } catch {
    return new Response("Bad Request", { status: 400 });
  }

  const rawMessages = normalizeMessages(payload?.messages || []);
  const lastUser = findLastUser(rawMessages);
  const lang = pickLanguage(payload, lastUser);

  const messages = rawMessages.map((m) => ({
    role: m.role,
    content: truncateText(m.content, CONFIG.limits.max_input_chars),
  }));

  const intent = detectIntent(lastUser);

  // SSE Response stream
  const headers = buildSSEHeaders(origin);

  const stream = new ReadableStream({
    async start(controller) {
      // Heartbeat
      let heartbeatTimer = null;
      const heartbeat = () => {
        controller.enqueue(`: ping\n\n`);
      };
      heartbeatTimer = setInterval(heartbeat, CONFIG.heartbeat_ms);

      const meta = { request_id: rid, provider: "intent", model: "n/a" };
      const logBase = { request_id: rid, path: "/chat", lang };

      try {
        // meta first
        controller.enqueue(SSE.meta(meta));

        // Intents
        if (intent === "contact") {
          const text = CONFIG.contact_templates[lang] || CONFIG.contact_templates.ar;
          await fakeStreamText(text, controller, CONFIG.fake_stream);
          controller.enqueue(SSE.done());
          logInfo({ ...logBase, provider: "intent", model: "contact", status: "ok", ms: nowMs() - started });
          return;
        }

        if (intent === "identity") {
          const text = CONFIG.identity_templates[lang] || CONFIG.identity_templates.ar;
          await fakeStreamText(text, controller, CONFIG.fake_stream);
          controller.enqueue(SSE.done());
          logInfo({ ...logBase, provider: "intent", model: "identity", status: "ok", ms: nowMs() - started });
          return;
        }

        // Build system prompt with verified facts
        const system =
          (CONFIG.system_prompt[lang] || CONFIG.system_prompt.ar) +
          "\n\n" +
          (CONFIG.verified_facts[lang] || CONFIG.verified_facts.ar);

        // Waterfall: OpenAI then Gemini
        const totalBudget = CONFIG.timeouts.total_ms;
        const perProvider = Math.floor(totalBudget / CONFIG.model_waterfall.length);

        const abortAll = new AbortController();

        for (let i = 0; i < CONFIG.model_waterfall.length; i++) {
          const { provider, model } = CONFIG.model_waterfall[i];
          const providerBudget = i === 0 ? perProvider : totalBudget - perProvider; // give fallback more time
          const providerStart = nowMs();

          try {
            // update meta for provider
            controller.enqueue(SSE.meta({ request_id: rid, provider, model }));

            logInfo({
              ...logBase,
              at: "start_provider",
              provider,
              model,
              budget_ms: providerBudget,
            });

            let tokenStream = null;

            if (provider === "openai") {
              if (!env.OPENAI_API_KEY) throw new Error("Missing OPENAI_API_KEY");
              tokenStream = await callOpenAI({
                apiKey: env.OPENAI_API_KEY,
                model,
                system,
                messages,
                temperature: CONFIG.temperature,
                timeoutMs: providerBudget,
                signal: abortAll.signal,
              });
            } else if (provider === "gemini") {
              if (!env.GEMINI_API_KEY) throw new Error("Missing GEMINI_API_KEY");
              tokenStream = await callGemini({
                apiKey: env.GEMINI_API_KEY,
                model,
                system,
                messages,
                temperature: CONFIG.temperature,
                timeoutMs: providerBudget,
                signal: abortAll.signal,
              });
            } else {
              throw new Error(`Unknown provider: ${provider}`);
            }

            // Pipe provider tokens into SSE.token
            const reader = tokenStream.getReader();
            let sentAnyToken = false;

            while (true) {
              const { done, value } = await reader.read();
              if (done) break;
              if (typeof value === "string" && value.length) {
                controller.enqueue(SSE.token(value));
                sentAnyToken = true;
              }
            }

            // ⛑️ Guarantee non-empty response
            if (!sentAnyToken) {
              controller.enqueue(SSE.token(" "));
            }

            controller.enqueue(SSE.done());

            logInfo({
              ...logBase,
              at: "end_provider",
              provider,
              model,
              status: "ok",
              provider_ms: nowMs() - providerStart,
              total_ms: nowMs() - started,
            });
            return; // success: stop waterfall
          } catch (err) {
            logWarn({
              ...logBase,
              at: "provider_error",
              provider,
              model,
              status: "fail",
              provider_ms: nowMs() - providerStart,
              message: String(err?.message || err),
            });

            // try next provider in waterfall
            continue;
          }
        }

        // If all providers failed
        const fallback = CONFIG.fallback_messages[lang] || CONFIG.fallback_messages.ar;
        controller.enqueue(SSE.error({ message: fallback, code: "ALL_FAILED" }));
        await fakeStreamText(fallback, controller, CONFIG.fake_stream);
        controller.enqueue(SSE.done());

        logError({
          ...logBase,
          at: "all_failed",
          status: "fail",
          total_ms: nowMs() - started,
        });
      } catch (err) {
        const fallback = CONFIG.fallback_messages[lang] || CONFIG.fallback_messages.ar;
        controller.enqueue(SSE.error({ message: fallback, code: "WORKER_ERR" }));
        controller.enqueue(SSE.done());

        logError({
          ...logBase,
          at: "worker_error",
          status: "fail",
          total_ms: nowMs() - started,
          message: String(err?.message || err),
        });
      } finally {
        if (heartbeatTimer) clearInterval(heartbeatTimer);
        controller.close();
      }
    },
  });

  return new Response(stream, { headers });
}

// -------------------- Logging --------------------

function logInfo(obj) {
  console.log(JSON.stringify({ level: "info", ...obj }));
}
function logWarn(obj) {
  console.log(JSON.stringify({ level: "warn", ...obj }));
}
function logError(obj) {
  console.log(JSON.stringify({ level: "error", ...obj }));
}

// -------------------- Worker Router --------------------

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const origin = request.headers.get("Origin") || "";

    // Preflight
    if (request.method === "OPTIONS") {
      const isAllowed = CONFIG.allowed_origins.includes(origin);
      if (!isAllowed) return new Response(null, { status: 403 });

      return new Response(null, {
        status: 204,
        headers: {
          ...buildCorsHeaders(origin),
        },
      });
    }

    if (url.pathname === "/chat") {
      if (request.method !== "POST") return new Response("Method Not Allowed", { status: 405 });
      return handleChat(request, env);
    }

    // Simple ping (optional). Keep it minimal.
    if (url.pathname === "/") {
      return new Response("OK", {
        status: 200,
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
          ...buildCorsHeaders(origin),
        },
      });
    }

    return new Response("Not Found", { status: 404 });
  },
};
