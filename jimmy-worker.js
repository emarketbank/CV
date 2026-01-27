
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

async function callGemini(env, body) {
  // استخدام gemini-1.5-flash لأنه الأسرع والأحدث حالياً للردود القصيرة
  const model = env.GEMINI_MODEL || "gemini-1.5-flash";
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${env.GEMINI_API_KEY}`;

  const system = getSystemPrompt(env);

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
        maxOutputTokens: 800 // لضمان ردود مختصرة وسريعة
      }
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
  
  return text;
}

export default {
  async fetch(request, env) {
    const corsHeaders = buildCorsHeaders();

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    if (request.method !== "POST") {
      return new Response(
        JSON.stringify({ response: "Method Not Allowed" }),
        { status: 405, headers: corsHeaders }
      );
    }

    try {
      const body = await request.json();
      
      // ✅ استدعاء مباشر لـ Gemini فقط
      const responseText = await callGemini(env, body);

      return new Response(JSON.stringify({ response: responseText }), {
        status: 200,
        headers: corsHeaders,
      });

    } catch (err) {
      console.error("Worker Error:", err);
      // رسالة خطأ لطيفة للمستخدم
      return new Response(
        JSON.stringify({ response: "معلش، في مشكلة تقنية صغيرة دلوقتي. ممكن تجرب تاني كمان شوية؟" }),
        { status: 500, headers: corsHeaders }
      );
    }
  },
};
