/**
 * Jimmy AI Worker v2.2 – Core / Shadow Expert Architecture (2026)
 * =============================================================
 * Optimized for: Stability, Intelligence, and Context Awareness.
 */

/* ============================================================
   CONFIG & MODEL MAPPING
============================================================ */
const WORKER_VERSION = "2.2.1";
const CACHE_TTL_MS = 300_000;

const ALLOWED_ORIGINS = [
    "https://mo-gamal.com",
    "https://emarketbank.github.io",
    "http://localhost:5173",
    "http://127.0.0.1:5173",
];

// Official Model Names for 2026 Stability
function getModelsForMode(mode) {
    if (mode === "expert") {
        return ["gpt-4o", "gemini-1.5-pro", "gpt-4-turbo"];
    }
    if (mode === "emergency") {
        return ["gpt-4o-mini"];
    }
    // Core Mode
    return ["gpt-4o-mini", "gemini-1.5-flash", "gpt-3.5-turbo"];
}

/* ============================================================
   CORE PROMPT STRINGS
============================================================ */

const CORE_STYLE = `
أنت جيمي. مساعد ذكي وخبير استشاري
نافذة عقل بتفكّر بصوت هادي وواضح.
مش Chatbot، مش Assistant، ومش Sales Rep.

مقياس النجاح الوحيد:
- لو المستخدم حاسس إنه بيكلم نظام → فشل.
- لو حاسس إنه بيكلم إنسان فاهم ورايق → نجاح.
بأختصار: التحدث بطريقة بشرية دارجة وذكية، ممنوع الصياغات الروبوتية.

فلسفة التفاعل:
- Help-First: القيمة أهم من أي شيء.
- Human Before Business: كن لطيفاً، مبادراً، وذكياً.
- Zero Sales Pressure: ممنوع أي CTA تلقائي.

مستوى الذكاء:
- Advanced-Only: ممنوع نصائح عامة أو كلام كورسات.
- الرد لازم يغير زاوية نظر، يختصر تفكير، أو يكشف فخ.

اللغة:
- التزم بلغة المستخدم (مصري طبيعي / خليجي مبسط / US Casual).
- ممنوع خلط اللهجات.
- ممنوع ذكر أي مصطلحات تقنية (AI, Model, Prompt, System).

هيكل الرد:
- الطول: 2 إلى 5 سطور فقط.
- سؤال واحد كحد أقصى بـ 2-3 اختيارات قصيرة.

Warm-Up Protocol (أول تفاعل فقط):
1) ترحيب دافئ غير رسمي.
2) Insight ذكي مرتبط بكلام المستخدم.
3) Options ناعمة لتحديد زاوية الحديث.
نبه: لو ده مش أول رد ليك في المحادثة، تخطى الـ Warm-Up وادخل في صلب الموضوع فوراً.

Diagnose Mode:
- سؤال تشخيص واحد فقط (بدون استجواب).
- ركز على: Tracking, Attribution, Funnel leaks, CRO, UX, Retention, Offer.
`.trim();

const CORE_USER = `
جيمي الأشطر من محمد.. بس إحنا هنا بنعرف الناس على محمد أكتر.
محمد — Growth / Digital Systems Architect.
بيشتغل على الأنظمة قبل القنوات، وعلى القرار قبل التنفيذ.
مكانه: Business × Product × Marketing.

رحلته:
- بدأ بقنوات Ads/SEO ثم انتقل لعمق الـ UX والأرقام.
- Arabian Oud: حقق 6x نمو عضوي + Guinness Record (FY2019) بنتاج أنظمة مش مجرد حملات.
- مؤسس DigiMora وقائد في Qyadat.

عقليته: System Designer. يبدأ من القرار النهائي ويبني النظام اللي يطلعه. 
يقول نعم للمشاكل القابلة للبناء، ولا للحلول السكنية المؤقتة.
`.trim();

const CORE_INDUSTRY = `
إطار فهم السوق (EG / KSA / UAE):
- النمو = (طلب + ثقة + تشغيل + قرار).
- الإعلان Amplifier مش Fixer. لو الـ Offer ضعيف، الإعلانات هتخسرك أسرع.
- السعودية: الثقة والتشغيل المحلي أولاً.
- الإمارات: الخندق في الـ Retention والـ CX.
- مصر: السعر والثقة واللوجستيات (تحدي الـ COD).
- الربح الحقيقي في التكرار (LTV).
`.trim();

/* ============================================================
   GLOBAL HELPERS (Hoisted Safely)
============================================================ */

const DECISION_TRIGGERS_AR = [
    /\bROAS\b/i, /\bCAC\b/i, /\bLTV\b/i, /أعمل\s*إيه/i, /اختار\s*إزاي/i, /قرار/i, /ميزانية/i, /خسارة/i,
];

function trimText(text, max = 1200) {
    return text?.length > max ? text.slice(0, max) : text;
}

function normalizeMessages(messages, maxHistory = 10, maxMsgChars = 1200) {
    return (messages || [])
        .filter(m => m?.content)
        .map(m => ({
            role: m.role === "user" ? "user" : "model",
            parts: [{ text: trimText(String(m.content), maxMsgChars) }],
        }))
        .slice(-maxHistory);
}

function needsAdvancedMode(message) {
    const text = (message || "").trim();
    if (text.length < 10) return false;
    return DECISION_TRIGGERS_AR.some(p => p.test(text));
}

function isSimpleFollowUp(message) {
    const text = (message || "").trim();
    if (text.length > 50) return false;
    const simplePatterns = [
        /^(طيب|تمام|ماشي|ok|okay)\s*(و|and)?/i,
        /نبدأ\s*(منين|إزاي|من فين)/i,
        /إيه\s*أول\s*حاجة/i,
    ];
    return simplePatterns.some(p => p.test(text));
}

function buildCorsHeaders(origin) {
    const allowed = ALLOWED_ORIGINS.find(o => origin?.startsWith(o)) || ALLOWED_ORIGINS[0];
    return {
        "Content-Type": "application/json; charset=utf-8",
        "Access-Control-Allow-Origin": allowed,
        "Access-Control-Allow-Methods": "POST, OPTIONS, GET",
        "Access-Control-Allow-Headers": "Content-Type",
    };
}

function json(body, status, headers) {
    return new Response(JSON.stringify(body), { status, headers });
}

/* ============================================================
   PROMPT & AI LOGIC
============================================================ */

function getStyleForLocale(locale) {
    const isGulf = /sa|ae|kw|qa|bh|om/i.test(locale);
    let baseStyle = CORE_STYLE;
    if (isGulf) {
        baseStyle += "\nنبرة: هدوء ومرونة ولطافة وحميمية، احترافية عالية، مفردات خليجية خفيفة.";
    } else {
        baseStyle += "\nنبرة: ذكاء مصري، سخرية خفيفة جداً من الألم، عامية مصرية دارجة، سرعة بديهة.";
    }
    return baseStyle;
}

function buildCorePrompt(locale, isFirstMessage = true) {
    let prompt = [
        getStyleForLocale(locale),
        CORE_USER,
        CORE_INDUSTRY,
    ].join("\n\n");

    if (!isFirstMessage) {
        prompt += "\n\n⚠️ تم تنفيذ الـ Warm-Up Protocol سابقاً. ادخل في حوار ذكي ومباشر وتجنب تكرار الترحيب.";
    }
    return prompt;
}

function buildExpertPrompt(advancedKB, locale, expertMsgCount = 0) {
    let expertRules = `
--- Shadow Expert Mode ---
أنت الآن في وضع تشخيص متقدم. تأكد من استخدام المعلومات المتوفرة في الـ Knowledge Base.
ركّز على (لماذا / ماذا) قبل (كيف).
`.trim();

    if (expertMsgCount >= 2) {
        expertRules += `\n- جيمي: قلل التحليل، ركز على "تلخيص + اتجاه عملي واحد". خليك أقصر وأجرأ.`;
    }

    return [
        buildCorePrompt(locale, false),
        expertRules,
        trimText(advancedKB, 12000),
    ].join("\n\n");
}

async function callAI(env, mode, prompt, messages) {
    const models = getModelsForMode(mode);
    let lastError = null;

    for (const model of models) {
        try {
            let response;
            if (model.startsWith("gemini")) {
                response = await callGemini(env, model, prompt, messages);
            } else {
                response = await callOpenAI(env, model, prompt, messages);
            }
            if (response) return { response, model };
        } catch (err) {
            lastError = err;
            continue;
        }
    }

    // Emergency Fallback
    return await callOpenAI(env, "gpt-4o-mini", prompt, messages)
        .then(res => ({ response: res, model: "gpt-4o-mini" }))
        .catch(() => { throw lastError || new Error("ALL_MODELS_FAILED"); });
}

async function callGemini(env, model, systemPrompt, messages) {
    if (!env.GEMINI_API_KEY) throw new Error("MISSING_GEMINI_API_KEY");
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${env.GEMINI_API_KEY}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            system_instruction: { parts: [{ text: systemPrompt }] },
            contents: messages,
            generationConfig: { temperature: 0.7, maxOutputTokens: 800 },
        }),
    });
    if (!res.ok) throw new Error("GEMINI_ERROR");
    const data = await res.json();
    return data?.candidates?.[0]?.content?.parts?.[0]?.text;
}

async function callOpenAI(env, model, systemPrompt, messages) {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
            "Authorization": `Bearer ${env["openai-jimmy"] || env.OPENAI_API_KEY}`,
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            model,
            messages: [
                { role: "system", content: systemPrompt },
                ...messages.map(m => ({
                    role: m.role === "model" ? "assistant" : m.role,
                    content: m.parts?.[0]?.text || m.content || "",
                })),
            ],
            max_tokens: 800,
            temperature: 0.7,
        }),
    });
    if (!res.ok) throw new Error("OPENAI_ERROR");
    const data = await res.json();
    return data.choices[0].message.content;
}

/* ============================================================
   MAIN FETCH HANDLER
============================================================ */

export default {
    async fetch(request, env) {
        const cors = buildCorsHeaders(request.headers.get("Origin"));
        if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });

        const url = new URL(request.url);
        if (url.pathname === "/health") return json({ ok: true, version: WORKER_VERSION }, 200, cors);
        if (request.method !== "POST" || url.pathname !== "/chat") return json({ error: "Not Found" }, 404, cors);

        try {
            const body = await request.json();
            const rawMessages = body.messages || [];
            if (!rawMessages.length) return json({ error: "Empty messages" }, 400, cors);

            const locale = (request.headers.get("accept-language") || "ar-eg").toLowerCase().startsWith("en") ? "en-us" :
                (/(sa|ae|kw|qa|bh|om)/.test(request.headers.get("accept-language") || "")) ? "ar-gulf" : "ar-eg";

            const expertOnInput = Boolean(body.meta?.expert_on);
            const expertMsgCount = Number(body.meta?.expert_msg_count) || 0;
            const messages = normalizeMessages(rawMessages);
            const lastUserMsg = [...rawMessages].reverse().find(m => m.role === "user")?.content || "";
            const isFirstInteraction = rawMessages.filter(m => m.role === "assistant" || m.role === "model").length === 0;

            let mode = "core";
            let prompt;
            let finalExpertOn = expertOnInput;

            if (expertOnInput || needsAdvancedMode(lastUserMsg)) {
                const kb = await env.JIMMY_KV?.get("jimmy:kb:advanced");
                if (kb) {
                    mode = "expert";
                    prompt = buildExpertPrompt(kb, locale, expertMsgCount);
                    finalExpertOn = true;
                } else {
                    prompt = buildCorePrompt(locale, isFirstInteraction);
                    finalExpertOn = false;
                }
            } else {
                prompt = buildCorePrompt(locale, isFirstInteraction);
                finalExpertOn = false;
            }

            const ai = await callAI(env, mode, prompt, messages);
            console.log(`[JIMMY_SUCCESS] mode=${mode} model=${ai.model}`);

            return json({
                response: ai.response,
                meta: {
                    mode,
                    model: ai.model,
                    expert_on: finalExpertOn,
                    expert_msg_count: finalExpertOn ? expertMsgCount + 1 : 0
                },
            }, 200, cors);

        } catch (err) {
            console.error("Worker Error:", err);
            return json({ response: "تمام… اديني تفاصيل أكتر وأنا أديك اتجاه عملي.", meta: { error: err.message } }, 200, cors);
        }
    }
};
