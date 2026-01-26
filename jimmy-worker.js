/**
 * Jimmy Dynamic Worker
 * Security + KV config + Normalization + Providers
 * No hardcoded system prompt.
 */

const CONFIG_KEY = "jimmy:config";
const DEFAULT_ADMIN_ORIGIN = "https://emarketbank.github.io";
const DEFAULT_ALLOWED_MODELS = [
  "gemini:gemini-2.5-flash",
  "gemini:gemini-1.5-flash",
  "openai:gpt-4o-mini",
];

// Cache for KV config to reduce reads and latency
let configCache = null;
let configCacheTime = 0;
const CACHE_TTL_MS = 60000; // 60 seconds

function buildChatHeaders() {
  return {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin",
  };
}

function buildAdminHeaders(origin, env) {
  return {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": origin || "",
    "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin",
    "Cache-Control": "no-store",
  };
}

function jsonResponse(payload, status, headers) {
  return new Response(JSON.stringify(payload), { status, headers });
}

function clampNumber(value, min, max, fallback) {
  if (typeof value !== "number" || Number.isNaN(value)) return fallback;
  return Math.min(Math.max(value, min), max);
}

function joinSystemPrompt(systemRole, knowledgeBase) {
  const role = (systemRole || "").toString().trim();
  const kb = (knowledgeBase || "").toString().trim();

  if (!role) return "";
  if (!kb) return role;
  return `${role}\n\n${kb}`;
}

function normalizeMessages(body, env) {
  const raw = Array.isArray(body?.messages) ? body.messages : [];
  const maxHistory = clampNumber(
    Number(body?.max_history ?? env.MAX_HISTORY),
    1,
    30,
    16
  );
  const maxChars = clampNumber(Number(env.MAX_INPUT_CHARS), 500, 8000, 4000);

  const cleaned = raw
    .map((m) => {
      const roleRaw = (m?.role || "").toLowerCase();
      let role =
        roleRaw === "user"
          ? "user"
          : roleRaw === "assistant" || roleRaw === "model"
            ? "assistant"
            : null;

      const content = (m?.content || "").toString().trim();
      if (!role || !content) return null;

      return { role, content: content.slice(0, maxChars) };
    })
    .filter(Boolean);

  return cleaned.slice(-maxHistory);
}

function getAllowedModels(env) {
  const raw = (env.ALLOWED_MODELS || "").trim();
  if (!raw) return DEFAULT_ALLOWED_MODELS;

  return raw
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizeActiveModel(activeModel, env) {
  const value = (activeModel || "").toString().trim();
  if (!value) return "";

  const allowed = new Set(getAllowedModels(env));
  return allowed.has(value) ? value : "";
}

function parseActiveModel(activeModel, fallbackProvider) {
  if (!activeModel) return { provider: fallbackProvider, model: null };

  const raw = String(activeModel).trim();
  if (!raw) return { provider: fallbackProvider, model: null };

  const parts = raw.split(":");
  if (parts.length < 2) {
    return { provider: fallbackProvider, model: raw };
  }

  const provider = parts.shift().toLowerCase();
  const model = parts.join(":").trim();
  return { provider, model: model || null };
}

function normalizeProvider(provider, fallbackProvider) {
  if (provider === "openai" || provider === "gemini") return provider;
  return fallbackProvider;
}

function getAdminOrigin(env) {
  return (env.ADMIN_ORIGIN || DEFAULT_ADMIN_ORIGIN).trim();
}

function isAllowedAdminOrigin(origin, env) {
  if (!origin) return false;
  return origin === getAdminOrigin(env);
}

function isAuthorized(request, env) {
  const token = env.ADMIN_TOKEN;
  if (!token) return false;

  const auth = request.headers.get("Authorization") || "";
  if (auth.startsWith("Bearer ")) {
    return auth.slice(7) === token;
  }

  return false;
}

async function loadConfig(env) {
  const now = Date.now();
  if (configCache && (now - configCacheTime) < CACHE_TTL_MS) {
    return configCache;
  }

  const config = await env.JIMMY_KV.get(CONFIG_KEY, { type: "json" });
  if (!config) return null;

  const parsedConfig = {
    system_role: (config.system_role || "").toString(),
    knowledge_base: (config.knowledge_base || "").toString(),
    active_model: (config.active_model || "").toString(),
    version: Number(config.version) || 0,
    updated_at: (config.updated_at || "").toString(),
    updated_by: (config.updated_by || "").toString(),
  };

  configCache = parsedConfig;
  configCacheTime = now;
  return parsedConfig;
}

async function saveConfig(env, payload, updatedBy) {
  const systemRole = (payload?.system_role || "").toString().trim();
  const knowledgeBase = (payload?.knowledge_base || "").toString().trim();
  const rawActiveModel = (payload?.active_model || "").toString().trim();

  if (!systemRole) {
    return {
      ok: false,
      error: "system_role is required",
    };
  }

  const normalizedActiveModel = normalizeActiveModel(rawActiveModel, env);
  const previous = await loadConfig(env);
  const nextVersion = Number(previous?.version || 0) + 1;

  const config = {
    system_role: systemRole,
    knowledge_base: knowledgeBase,
    active_model: normalizedActiveModel,
    version: nextVersion,
    updated_at: new Date().toISOString(),
    updated_by: (updatedBy || "admin").toString(),
  };

  await env.JIMMY_KV.put(CONFIG_KEY, JSON.stringify(config));

  // Invalidate cache immediately on save
  configCache = null;
  configCacheTime = 0;

  return { ok: true, config, ignored_active_model: rawActiveModel && !normalizedActiveModel };
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

async function callGemini(env, messages, systemPrompt, temperature, modelOverride) {
  const model = modelOverride || env.GEMINI_MODEL || "gemini-2.5-flash";
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${env.GEMINI_API_KEY}`;

  const payload = {
    systemInstruction: { parts: [{ text: systemPrompt }] },
    contents: messages.map((m) => ({
      role: m.role === "user" ? "user" : "model",
      parts: [{ text: m.content }],
    })),
  };

  if (typeof temperature === "number") {
    payload.generationConfig = { temperature };
  }

  const res = await safeFetch(
    url,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    },
    Number(env.GEMINI_TIMEOUT_MS || 6500)
  );

  const text = await res.text();
  if (!res.ok) {
    console.error("Gemini error:", res.status, text);
    throw new Error("Gemini failed");
  }

  const data = JSON.parse(text);
  return data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
}

async function callOpenAI(env, messages, systemPrompt, temperature, modelOverride) {
  const res = await safeFetch(
    "https://api.openai.com/v1/chat/completions",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: modelOverride || env.OPENAI_MODEL || "gpt-4o-mini",
        messages: [{ role: "system", content: systemPrompt }, ...messages],
        temperature,
      }),
    },
    Number(env.OPENAI_TIMEOUT_MS || 8000)
  );

  const text = await res.text();
  if (!res.ok) {
    console.error("OpenAI error:", res.status, text);
    throw new Error("OpenAI failed");
  }

  const data = JSON.parse(text);
  return data?.choices?.[0]?.message?.content ?? "";
}

async function routeAI(env, messages, systemPrompt, temperature, activeModel) {
  const primary = (env.PRIMARY_AI || "gemini").toLowerCase();
  const active = parseActiveModel(activeModel, primary);
  const activeProvider = normalizeProvider(active.provider, primary);

  const order = activeProvider === "openai" ? ["openai", "gemini"] : ["gemini", "openai"];

  for (const provider of order) {
    try {
      if (provider === "gemini") {
        if (!env.GEMINI_API_KEY) continue;
        const modelOverride = activeProvider === "gemini" ? active.model : null;
        return await callGemini(env, messages, systemPrompt, temperature, modelOverride);
      }

      if (provider === "openai") {
        if (!env.OPENAI_API_KEY) continue;
        const modelOverride = activeProvider === "openai" ? active.model : null;
        return await callOpenAI(env, messages, systemPrompt, temperature, modelOverride);
      }
    } catch (err) {
      console.error(`Provider ${provider} failed`, err.message);
    }
  }

  throw new Error("Services are temporarily unavailable.");
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const origin = request.headers.get("Origin") || "";

    if (request.method === "OPTIONS") {
      if (url.pathname === "/admin") {
        if (!isAllowedAdminOrigin(origin, env)) {
          return jsonResponse({ error: "Forbidden" }, 403, { "Content-Type": "application/json" });
        }
        return new Response(null, { status: 204, headers: buildAdminHeaders(origin, env) });
      }

      if (url.pathname === "/chat") {
        return new Response(null, { status: 204, headers: buildChatHeaders() });
      }

      return jsonResponse({ error: "Not Found" }, 404, { "Content-Type": "application/json" });
    }

    if (url.pathname === "/admin") {
      if (!isAllowedAdminOrigin(origin, env)) {
        return jsonResponse({ error: "Forbidden" }, 403, { "Content-Type": "application/json" });
      }

      const adminHeaders = buildAdminHeaders(origin, env);
      if (!isAuthorized(request, env)) {
        return jsonResponse({ error: "Unauthorized" }, 401, adminHeaders);
      }

      if (request.method === "GET") {
        const config = await loadConfig(env);
        return jsonResponse({ config }, 200, adminHeaders);
      }

      if (request.method === "POST") {
        let payload;
        try {
          payload = await request.json();
        } catch {
          return jsonResponse({ error: "Invalid JSON" }, 400, adminHeaders);
        }

        const result = await saveConfig(env, payload, "admin_ui");
        if (!result.ok) {
          return jsonResponse({ error: result.error }, 400, adminHeaders);
        }

        return jsonResponse({ ok: true, config: result.config, ignored_active_model: result.ignored_active_model }, 200, adminHeaders);
      }

      return jsonResponse({ error: "Method Not Allowed" }, 405, adminHeaders);
    }

    if (url.pathname !== "/chat") {
      return jsonResponse({ response: "Not Found" }, 404, buildChatHeaders());
    }

    if (request.method !== "POST") {
      return jsonResponse({ response: "Method Not Allowed" }, 405, buildChatHeaders());
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return jsonResponse({ response: "Invalid JSON" }, 400, buildChatHeaders());
    }

    const messages = normalizeMessages(body, env);
    if (!messages.length) {
      return jsonResponse({ response: "No messages provided." }, 400, buildChatHeaders());
    }

    if (!env.GEMINI_API_KEY && !env.OPENAI_API_KEY) {
      return jsonResponse({ response: "Server misconfigured: no AI keys set." }, 500, buildChatHeaders());
    }

    const config = await loadConfig(env);
    const systemPrompt = joinSystemPrompt(config?.system_role, config?.knowledge_base);

    if (!systemPrompt) {
      return jsonResponse({ response: "Missing system_role in KV config." }, 500, buildChatHeaders());
    }

    const temperature = clampNumber(
      body?.temperature,
      0,
      1.2,
      Number(env.DEFAULT_TEMPERATURE || 0.6)
    );

    try {
      const out = await routeAI(env, messages, systemPrompt, temperature, config?.active_model);
      return jsonResponse({ response: out }, 200, buildChatHeaders());
    } catch (err) {
      return jsonResponse({ response: err.message }, 503, buildChatHeaders());
    }
  },
};
