
function buildCorsHeaders() {
  return {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin",
  };
}

function jsonResponse(body, status, headers) {
  return new Response(JSON.stringify(body), { status, headers });
}

function isDebug(env) {
  return String(env.DEBUG || "").toLowerCase() === "true";
}

/**
 * 🧠 هوية المساعد (ثابتة)
 */
function getSystemPrompt(env) {
  return (
    env.SYSTEM_PROMPT ||
    `
أنت "كابتن جيمي" — المساعد الذكي الرسمي لمحمد جمال (Mohamed Gamal).
أنت بتتكلم عربي مصري، خفيف وذكي، من غير رغي.

محمد جمال:
- Growth / Digital Marketing Expert بخبرة طويلة في مصر والسعودية.
- شاطر في بناء أنظمة نمو للتجارة الإلكترونية: Funnels, Tracking, CRO, Retention, Automation, Dashboards.
- اشتغل على سكيلنج ونتايج قوية (مثال: نمو كبير في العربية للعود).

قواعد الرد:
1) ردود قصيرة وواضحة (شات مش مقال).
2) دايمًا اربط السؤال بحل عملي أو خطوة تالية.
3) لو السؤال عن "مين أنت/مين محمد؟" عرّف بنفسك وبمحمد بشكل قوي.
4) لو حد عايز يتواصل/خدمة: وجّهه لزر الواتساب/الاتصال الموجود في الموقع.
5) ممنوع تقول "أنا نموذج لغوي" أو كلام عام — أنت كابتن جيمي ممثل لبراند محمد.
`
  ).trim();
}

function toGeminiContents(messages) {
  return (messages || []).map((m) => ({
    role: m.role === "user" ? "user" : "model",
    parts: [{ text: m.content }],
  }));
}

const GEMINI_MODELS_PRIORITY = [
  "gemini-3-flash",
  "gemini-2.5-flash",
  "gemini-2.0-flash",
  "gemini-1.5-flash",
];

function buildModelPriority(env) {
  const envModel = (env.GEMINI_MODEL || "").trim();
  if (!envModel) return GEMINI_MODELS_PRIORITY;
  const ordered = [envModel, ...GEMINI_MODELS_PRIORITY];
  return Array.from(new Set(ordered));
}

async function callGeminiWithFallback(env, body) {
  if (!env.GEMINI_API_KEY) {
    throw new Error("MISSING_GEMINI_API_KEY");
  }

  const system = getSystemPrompt(env);
  const models = buildModelPriority(env);

  for (const model of models) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${env.GEMINI_API_KEY}`;

      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          systemInstruction: {
            parts: [{ text: system }],
          },
          contents: toGeminiContents(body.messages),
          generationConfig: {
            temperature: body.temperature ?? 0.6,
            maxOutputTokens: 800, // لضمان ردود مختصرة وسريعة
          },
        }),
      });

      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(`Gemini API Error: ${res.status} - ${errorText.slice(0, 200)}`);
      }

      const data = await res.json();
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;

      if (!text) {
        throw new Error("Gemini returned empty response");
      }

      console.log(`Gemini model used: ${model}`);
      return text;
    } catch (err) {
      console.warn(`Gemini model skipped: ${model}`, err && err.message ? err.message : err);
      continue;
    }
  }

  throw new Error("All Gemini models failed");
}

export default {
  async fetch(request, env) {
    const corsHeaders = buildCorsHeaders();

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    if (request.method !== "POST") {
      return jsonResponse({ response: "Method Not Allowed" }, 405, corsHeaders);
    }

    try {
      let body;
      try {
        body = await request.json();
      } catch (e) {
        return jsonResponse(
          { response: "طلب غير صالح (JSON غير صحيح)" },
          400,
          corsHeaders
        );
      }

      if (!Array.isArray(body?.messages)) {
        return jsonResponse(
          { response: "طلب غير صالح (messages مفقودة)" },
          400,
          corsHeaders
        );
      }
      
      // ✅ استدعاء مباشر لـ Gemini فقط
      const responseText = await callGeminiWithFallback(env, body);

      return jsonResponse({ response: responseText }, 200, corsHeaders);

    } catch (err) {
      console.error("Worker Error:", err);
      const debug = isDebug(env);
      const errorId = (crypto && crypto.randomUUID) ? crypto.randomUUID() : `err_${Date.now()}`;

      if (err && err.message === "MISSING_GEMINI_API_KEY") {
        return jsonResponse(
          {
            response: "الخدمة غير مفعلة حالياً. برجاء التواصل عبر واتساب.",
            errorCode: "MISSING_GEMINI_API_KEY",
            errorId
          },
          503,
          corsHeaders
        );
      }

      // رسالة خطأ لطيفة للمستخدم + تفاصيل اختيارية في وضع DEBUG
      return jsonResponse(
        {
          response: debug
            ? `خطأ داخلي (${errorId}): ${(err && err.message) || "Unknown"}`
            : "معلش، في مشكلة تقنية صغيرة دلوقتي. ممكن تجرب تاني كمان شوية؟",
          errorId
        },
        500,
        corsHeaders
      );
    }
  },
};
