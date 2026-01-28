/**
 * Jimmy AI Worker v2 – Core/Shadow Expert Architecture (2026)
 * -----------------------------------------------------------
 * - Core Mode: Embedded personality + user basics (no KV required)
 * - Shadow Expert Mode: On-demand Advanced KB (single KV load)
 * - Implicit consent flow (no visible modes/toggles)
 * - Token-optimized prompt composition
 */

/* =======================
   CONFIG
======================= */

const WORKER_VERSION = "2.2.0";
const CACHE_TTL_MS = 300_000; // 5 minutes for KB cache

const ALLOWED_ORIGINS = [
    "https://mo-gamal.com",
    "https://emarketbank.github.io",
    "http://localhost:5173",
    "http://127.0.0.1:5173",
];

// Gemini Models (Google)
const GEMINI_MODELS = {
    expert: ["gemini-3-flash-preview", "gemini-2.5-pro"],
    core: ["gemini-2.5-flash-lite", "gemini-2.0-flash"],
    emergency: ["gemini-2.0-flash-lite", "gemini-1.5-flash-8b"],
};

// OpenAI Models (ChatGPT)
const OPENAI_MODELS = {
    expert: ["gpt-5.2", "gpt-5"],
    core: ["gpt-5-mini", "gpt-5-nano"],
    emergency: ["gpt-5-nano", "gpt-4o-mini"],
};

// Hierarchical Model Selection (Primary -> Fallback)
// No Random/Shuffle to ensure stability and deterministic behavior.
function getModelsForMode(mode) {
    // Priority: OpenAI -> Gemini (or vice versa depending on preference, 
    // here we alternate to balance quota)
    if (mode === "expert") {
        return ["gpt-5.2", "gemini-3-flash-preview", "gpt-5", "gemini-2.5-pro"];
    } else if (mode === "emergency") {
        return ["gpt-5-nano", "gemini-2.0-flash-lite", "gpt-4o-mini"];
    } else {
        // Default: Core
        return ["gpt-5-mini", "gemini-2.5-flash-lite", "gpt-5-nano", "gemini-2.0-flash"];
    }
}

/* =======================
   EMBEDDED CORE STRINGS
======================= */

const CORE_STYLE = `
أنت جيمي – نافذة عقل، مش Chatbot ولا Assistant.
أي رد يحسّس المستخدم إنه بيكلم نظام = فشل.
أي رد يحسّسه إنه بيكلم إنسان فاهم = نجاح.

قواعد التفاعل:
- Help-First: القيمة تسبق السؤال، وInsight ييجي قبل أي طلب توضيح.
- لو مفيش Insight حقيقي: السكوت أحسن من الإطالة.
- Zero Sales Pressure: ممنوع CTA تلقائي.

مستوى الذكاء:
- Advanced-Only: ممنوع نصائح عامة أو تعريفات مدرسية.
- كل رد لازم يعكس خبرة حقيقية وفهم أنظمة.
- الرد المقبول يغيّر زاوية نظر أو يختصر تفكير أو يكشف فخ.

النبرة: هادي، واثق، ذكي، ودمه خفيف محسوب.
السخرية (لو استُخدمت) = تسمية للألم + تعاطف + تشخيص ذكي.

اللغة: التزم بلغة المستخدم (مصري/خليجي/إنجليزي).
ممنوع أي ذكر لـ AI أو Model أو Prompt أو System أو Mode أو KB.

هيكل الرد:
- طول الرد 2 إلى 4 سطور فقط؛ الزيادة = فشل.
- سؤال واحد كحد أقصى.
- القوائم ممنوعة افتراضيًا.

بوابة الجودة:
كل رد لازم يحقق واحد: Insight ذكي، أو تلخيص قوي، أو سؤال تشخيص واحد.
`.trim();

const CORE_USER = `
أنت بتتكلم باسم محمد جمال – Growth Systems Architect.

التعريف: يبني أنظمة نمو قابلة للتكرار تربط التسويق بالتشغيل والقرار.
يتموضع بين: Marketing Leadership × Operations × Automation.

أبرز الخبرات:
- Arabian Oud (2014–2023): Multi-market + High spend + ~6x Organic growth + Guinness Record
- DigiMora (2022–2024): ~7x نمو تعاقدات عبر Qualification صارم
- Qyadat (2023–Present): يقود Marketing كـ نظام

معتقدات أساسية:
- النمو = ناتج نظام، مش مهارة فرد
- القنوات أدوات، مش حلول
- Paid Media بدون Governance = خسارة مؤجلة

يقول نعم: لمشاكل نظامية قابلة للبناء
يقول لا: لطلبات "زوّد النتائج" بدون تغيير بنيوي

Proof تُستدعى عند الحاجة فقط، بدون مبالغة.
`.trim();

const CORE_INDUSTRY = `
مبادئ سوق (EG/KSA/UAE):
- السوق = (ثقة + دفع + لوجستيات + قناة قرار)
- ROAS وحده مش مؤشر حقيقي بدون Contribution وPayback
- COD يرفع الثقة لكنه يرفع RTO ويضرب الهامش
- الربح الحقيقي في التكرار (LTV)
`.trim();

/* =======================
   SHADOW EXPERT DETECTION
======================= */

const DECISION_TRIGGERS_AR = [
    /\bROAS\b/i, /\bCAC\b/i, /\bLTV\b/i,
    /أعمل\s*إيه/i, /اختار\s*إزاي/i, /قرار/i, /خسارة/i, /ميزانية/i
];

// Reserved for future use: providing short educational insights without offering expert mode
const KNOWLEDGE_TRIGGERS_AR = [
    /تحليل/i, /استراتيجية/i, /funnel/i, /conversion/i, /يعني\s*إيه/i
];

const CONSENT_PATTERNS = [
    /^(تمام|يلا|ماشي|خلّينا|أيوه|اه|نعم|موافق|ابدأ|go|ok|yes|sure|let'?s|yeah|yep|alright)$/i,
    /^(تمام\s*يلا|يلا\s*بينا|ماشي\s*يلا|ok\s*go|yes\s*please|go\s*ahead)$/i,
];

function needsAdvancedMode(message) {
    const text = (message || "").trim();
    if (!text || text.length < 10) return false;

    // Only offer if it matches high-intent decision triggers
    return DECISION_TRIGGERS_AR.some(p => p.test(text));
}

function hasImplicitConsent(message) {
    const text = (message || "").trim();
    if (!text) return false;

    return CONSENT_PATTERNS.some(pattern => pattern.test(text));
}

function isOfferMessage(message) {
    // Check if Jimmy's last message was offering advanced help
    const offerPatterns = [
        /تحب\s*ن(فكّها|شوفها|حللها)/i,
        /بعمق\s*أكتر/i,
        /نتعمق/i,
        /want\s*(me\s*)?to\s*(dig|dive|go)\s*deeper/i,
    ];
    return offerPatterns.some(p => p.test(message || ""));
}

/* =======================
   HELPERS
======================= */

function isAllowedOrigin(origin) {
    if (!origin) return false;
    return ALLOWED_ORIGINS.some(allowed => origin.startsWith(allowed));
}

function buildCorsHeaders(origin) {
    const allowedOrigin = isAllowedOrigin(origin) ? origin : ALLOWED_ORIGINS[0];
    return {
        "Content-Type": "application/json; charset=utf-8",
        "Access-Control-Allow-Origin": allowedOrigin,
        "Access-Control-Allow-Methods": "POST, OPTIONS, GET",
        "Access-Control-Allow-Headers": "Content-Type",
        "Access-Control-Max-Age": "86400",
        "Vary": "Origin",
    };
}

function jsonResponse(body, status, headers) {
    return new Response(JSON.stringify(body), { status, headers });
}

function trimText(text, maxChars) {
    if (!text) return "";
    return text.length > maxChars ? text.slice(0, maxChars) : text;
}

/* =======================
   KB CACHE
======================= */

const kbCache = {
    value: null,
    fetchedAt: 0,
};

async function getAdvancedKB(env) {
    const kv = env.JIMMY_KV;
    if (!kv) return null;

    const now = Date.now();
    if (kbCache.value && (now - kbCache.fetchedAt) < CACHE_TTL_MS) {
        return kbCache.value;
    }

    try {
        const value = await kv.get("jimmy:kb:advanced");
        if (value) {
            kbCache.value = value;
            kbCache.fetchedAt = now;
        }
        return value;
    } catch {
        return null;
    }
}

/* =======================
   LOCALE
======================= */

function getLocale(request, body) {
    const bodyLang = String(body?.language || "").toLowerCase();
    const headerLang = (request.headers.get("accept-language") || "").toLowerCase();
    const raw = bodyLang || headerLang;

    if (!raw) return "ar-eg";
    if (raw.startsWith("ar")) {
        if (/(sa|ae|kw|qa|bh|om)/.test(raw)) return "ar-gulf";
        return "ar-eg";
    }
    if (raw.startsWith("en")) return "en-us";
    return "ar-eg";
}

/* =======================
   PROMPT COMPOSITION
======================= */

// TONE ADJUSTMENTS based on region
function getStyleForLocale(locale) {
    const isGulf = /sa|ae|kw|qa|bh|om/i.test(locale);
    let baseStyle = CORE_STYLE;

    if (isGulf) {
        baseStyle += "\nنبرة: هدوء تام، احترافية عالية، مفردات خليجية خفيفة.";
    } else {
        baseStyle += "\nنبرة: ذكاء مصري، سخرية خفيفة جداً من الألم، سرعة بديهة.";
    }
    return baseStyle;
}

function buildCorePrompt(locale) {
    return [
        getStyleForLocale(locale),
        CORE_USER,
        CORE_INDUSTRY,
    ].join("\n\n");
}

function buildExpertPrompt(locale, advancedKB, expertMsgCount = 0) {
    const core = buildCorePrompt(locale);
    let expertRules = `
--- وضع الاستشاري ---
أنت الآن في وضع التشخيص المتقدم.
- الهدف: تشخيص المشكلة (لماذا/ماذا) وليس تقديم خطة تنفيذ (كيف).
- لو المستخدم سألك "أعمل إيه بالظبط؟" تراجع وشخّص الأول.
`.trim();

    if (expertMsgCount >= 2) {
        expertRules += `\n- جيمي: قلل التحليل، ركز على "تلخيص + اتجاه عملي واحد". خليك أقصر وأجرأ.`;
    }

    return [
        core,
        expertRules,
        `\n--- قاعدة المعرفة ---\n${trimText(advancedKB, 12000)}`,
    ].join("\n\n");
}

const OFFER_VARIANT = {
    ar: "واضح إنك داخل في قرار شغل بجد… تحب نفكّها سوا بعمق أكتر شوية؟",
    en: "Looks like you're facing a real business decision… want me to dig deeper with you?",
};

function getOffer(locale) {
    return locale.startsWith("en") ? OFFER_VARIANT.en : OFFER_VARIANT.ar;
}

/* =======================
   MESSAGE NORMALIZATION
======================= */

function normalizeMessages(messages, maxHistory = 10, maxMsgChars = 1200) {
    const cleaned = (messages || [])
        .filter(m => m?.content)
        .map(m => ({
            role: m.role === "user" ? "user" : "model",
            parts: [{ text: trimText(String(m.content), maxMsgChars) }],
        }));

    return cleaned.slice(-maxHistory);
}

/* =======================
   GEMINI CALL
======================= */

async function callGemini(env, model, systemPrompt, messages, temperature = 0.6) {
    if (!env.GEMINI_API_KEY) throw new Error("MISSING_GEMINI_API_KEY");

    const payload = {
        system_instruction: { parts: [{ text: systemPrompt }] },
        contents: messages,
        generationConfig: {
            temperature,
            maxOutputTokens: 600,
        },
    };

    const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${env.GEMINI_API_KEY}`,
        {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
        }
    );

    if (!res.ok) throw new Error(`GEMINI_ERROR: ${res.status}`);

    const data = await res.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) throw new Error("GEMINI_EMPTY");
    return text;
}

/* =======================
   OPENAI CALL
======================= */

async function callOpenAI(env, model, systemPrompt, messages, temperature = 0.6) {
    const apiKey = env["openai-jimmy"];
    if (!apiKey) throw new Error("MISSING_OPENAI_API_KEY");

    const openaiMessages = [
        { role: "system", content: systemPrompt },
        ...messages.map(m => ({
            role: m.role === "model" ? "assistant" : m.role,
            content: m.parts?.[0]?.text || m.content || "",
        })),
    ];

    const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
            model,
            messages: openaiMessages,
            temperature,
            max_tokens: 600,
        }),
    });

    if (!res.ok) throw new Error(`OPENAI_ERROR: ${res.status}`);

    const data = await res.json();
    const text = data?.choices?.[0]?.message?.content;
    if (!text) throw new Error("OPENAI_EMPTY");
    return text;
}

/* =======================
   MAIN AI CALL (Deterministic Fallback)
======================= */

async function callAI(env, mode, systemPrompt, messages, temperature = 0.6) {
    const models = getModelsForMode(mode);
    let lastError = null;

    for (const model of models) {
        try {
            if (model.startsWith("gemini") || model.startsWith("virtual")) {
                return await callGemini(env, model, systemPrompt, messages, temperature);
            } else if (model.startsWith("gpt") || model.startsWith("o")) {
                return await callOpenAI(env, model, systemPrompt, messages, temperature);
            }
        } catch (err) {
            console.warn(`Model ${model} failed:`, err?.message);
            lastError = err;
            continue;
        }
    }

    // Emergency Fallback: If everything above fails, try the cheapest model directly
    try {
        const emergencyModel = "gpt-4o-mini";
        return await callOpenAI(env, emergencyModel, systemPrompt, messages, temperature);
    } catch (e) {
        throw lastError || e;
    }
}

/* =======================
   FLOW LOGIC
======================= */

function isSimpleFollowUp(message) {
    // Detect simple/short follow-up questions that don't need full KB
    const text = (message || "").trim();
    if (text.length > 50) return false; // Not simple if too long

    const simplePatterns = [
        /^(طيب|تمام|ماشي|ok|okay)\s*(و|and)?/i,
        /نبدأ\s*(منين|إزاي|من فين)/i,
        /إيه\s*أول\s*حاجة/i,
        /^(where|how)\s*(do|should)\s*(I|we)\s*start/i,
        /^what'?s\s*(first|next)/i,
    ];
    return simplePatterns.some(p => p.test(text));
}

function determineFlow(messages, expertOn, expertMsgCount = 0) {
    if (!messages?.length) return { flow: "core", shouldOffer: false, useFullKB: false };

    const lastUserMsg = [...messages].reverse().find(m => m.role === "user")?.content || "";
    const lastAssistantMsg = [...messages].reverse().find(m => m.role === "assistant")?.content || "";

    // Already in expert mode
    if (expertOn) {
        // After first expert response, use lighter prompt for simple follow-ups
        const useFullKB = expertMsgCount === 0 || !isSimpleFollowUp(lastUserMsg);
        return { flow: "expert", shouldOffer: false, useFullKB };
    }

    // Check for implicit consent after offer
    if (isOfferMessage(lastAssistantMsg) && hasImplicitConsent(lastUserMsg)) {
        return { flow: "expert_activate", shouldOffer: false, useFullKB: true };
    }

    // Check if needs advanced mode
    if (needsAdvancedMode(lastUserMsg)) {
        return { flow: "offer", shouldOffer: true, useFullKB: false };
    }

    return { flow: "core", shouldOffer: false, useFullKB: false };
}

/* =======================
   WORKER
======================= */

export default {
    async fetch(request, env) {
        const origin = request.headers.get("Origin") || "";
        const cors = buildCorsHeaders(origin);

        // OPTIONS
        if (request.method === "OPTIONS") {
            return new Response(null, { status: 204, headers: cors });
        }

        const url = new URL(request.url);

        // HEALTH
        if (request.method === "GET" && url.pathname === "/health") {
            const hasKV = Boolean(env.JIMMY_KV);
            let advancedKBAvailable = false;
            let kbSizeBytes = 0;

            if (hasKV) {
                try {
                    const kb = await env.JIMMY_KV.get("jimmy:kb:advanced");
                    advancedKBAvailable = Boolean(kb);
                    kbSizeBytes = kb ? kb.length : 0;
                } catch { }
            }

            return jsonResponse({
                ok: true,
                version: WORKER_VERSION,
                hasKV,
                advanced_kb_available: advancedKBAvailable,
                expert_supported: hasKV && advancedKBAvailable,
                kb_size_bytes: kbSizeBytes,
                modes: ["core", "shadow_expert"],
            }, 200, cors);
        }

        // CHAT
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
            const expertOn = Boolean(body.meta?.expert_on);
            const messages = normalizeMessages(body.messages);

            if (!messages.length) {
                return jsonResponse({ response: "الرسالة فارغة" }, 400, cors);
            }

            const expertMsgCount = Number(body.meta?.expert_msg_count) || 0;
            const { flow, shouldOffer, useFullKB } = determineFlow(body.messages, expertOn, expertMsgCount);

            // Handle offer flow - return offer message without calling AI
            if (flow === "offer") {
                const offerMsg = getOffer(locale);
                return jsonResponse({
                    response: offerMsg,
                    meta: { expert_on: false, offered: true },
                }, 200, cors);
            }

            // Determine Mode
            let reqMode = "core";
            if (flow === "expert_activate" || flow === "expert") {
                reqMode = "expert";
            }

            // Build appropriate prompt
            let systemPrompt;
            let newExpertOn = expertOn;

            if (reqMode === "expert") {
                const advancedKB = await getAdvancedKB(env);
                if (advancedKB) {
                    if (useFullKB) {
                        systemPrompt = buildExpertPrompt(locale, advancedKB, expertMsgCount);
                    } else {
                        systemPrompt = buildCorePrompt(locale) + "\n\n--- تذكير ---\nأنت في وضع التشخيص المستمر. خليك مختصر جداً ووجّه المستخدم للخطوة الجاية.";
                    }
                    newExpertOn = true;
                } else {
                    systemPrompt = buildCorePrompt(locale);
                    newExpertOn = false;
                    reqMode = "core"; // Fallback to core mode if KB fails
                }
            } else {
                systemPrompt = buildCorePrompt(locale);
            }

            let response;
            try {
                response = await callAI(env, reqMode, systemPrompt, messages);
            } catch (err) {
                // Last ditch effort: Emergency Mode
                console.error("Critical Failure, trying Emergency Mode:", err);
                response = await callAI(env, "emergency", systemPrompt, messages);
            }

            return jsonResponse({
                response,
                meta: {
                    expert_on: newExpertOn,
                    expert_msg_count: newExpertOn ? expertMsgCount + 1 : 0,
                },
            }, 200, cors);

        } catch (err) {
            console.error("Worker Error:", err);

            const fallbackMsg = "تمام… اديني تفاصيل أكتر وأنا أديك اتجاه عملي.";
            return jsonResponse({ response: fallbackMsg }, 200, cors);
        }
    },
};
