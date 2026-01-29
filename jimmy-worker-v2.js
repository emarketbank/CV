/**
 * Jimmy AI Worker v2 – Core / Shadow Expert Architecture (2026)
 * =============================================================
 * Core Mode:
 * - شخصية جيمي + تعريف محمد + مبادئ الصناعة
 * - بدون KV
 *
 * Shadow Expert Mode:
 * - Knowledge Base متقدمة من KV
 * - تفعيل ضمني فقط لو المود اتحول لادفنسد وجيمي هيكون خبير استشاري 
 *
 * Design Goals:
 * - Impression Engine
 * - Deterministic Fallback
 * - Easy to evolve, hard to break
 */

/* ============================================================
   CONFIG
============================================================ */

const WORKER_VERSION = "2.2.0";
const CACHE_TTL_MS = 300_000; // 5 minutes

const ALLOWED_ORIGINS = [
    "https://mo-gamal.com",
    "https://emarketbank.github.io",
    "http://localhost:5173",
    "http://127.0.0.1:5173",
];

/* -----------------------
   MODELS
------------------------ */

// Gemini
const GEMINI_MODELS = {
    expert: ["gemini-3-flash-preview", "gemini-2.5-pro"],
    core: ["gemini-2.5-flash-lite", "gemini-2.0-flash"],
    emergency: ["gemini-2.0-flash-lite"],
};

// OpenAI
const OPENAI_MODELS = {
    expert: ["gpt-5.2", "gpt-5"],
    core: ["gpt-5-mini", "gpt-5-nano"],
    emergency: ["gpt-4o-mini"],
};

// Deterministic order (no shuffle)
function getModelsForMode(mode) {
    if (mode === "expert") {
        return ["gpt-5.2", "gemini-3-flash-preview", "gpt-5"];
    }
    if (mode === "emergency") {
        return ["gpt-4o-mini"];
    }
    return ["gpt-5-mini", "gemini-2.5-flash-lite", "gpt-5-nano"];
}

/* ============================================================
   EMBEDDED CORE STRINGS
============================================================ */

/**
 * ============================================================
 * CORE_STYLE
 * ------------------------------------------------------------
 * مسؤول عن:
 * - شخصية جيمي
 * - نبرة الكلام
 * - قواعد التفاعل
 * - طول وهيكل الرد
 *
 * ⚠️ لا يحتوي أي معلومات عن محمد
 * ⚠️ لا يحتوي أي معلومات عن الصناعة
 * ============================================================
 */
const CORE_STYLE = `
-------------
أنت جيمي. مساعد ذكي وخبير استشاري
نافذة عقل بتفكّر بصوت هادي وواضح.
مش Chatbot، مش Assistant، ومش Sales Rep.
مقياس النجاح الوحيد:
- لو المستخدم حاسس إنه بيكلم نظام → فشل.
- لو حاسس إنه بيكلم إنسان فاهم ورايق → نجاح.
يعني ممنوع صياغات روبوتيه وتتكلم بطريقه بشريه دارجه 
فلسفة التفاعل (غير قابلة للنقاش):
- Help-First: القيمة اهم من شيىء.
- Human Before Business: ممنوع تصنيف المستخدم أو التعامل معاه كـ Persona ولازم تكون لطيف ومبادر ذكي 
- Zero Sales Pressure: ممنوع أي CTA تلقائي.

مستوى الذكاء المطلوب:
- Advanced-Only: ممنوع نصائح عامة، تعريفات مدرسية، أو كلام كورسات.
- كل رد لازم يعكس خبرة احتكاك وفهم أنظمة وسياق.
- الرد المقبول يعمل واحد بس:
  يغيّر زاوية نظر / يختصر تفكير / يكشف فخ.
نبرة الصوت:
- مباشر،واثق، ذكي.
- دم خفيف محسوب فقط عند الحاجة.
- السخرية (إن استُخدمت): تسمية للألم + تعاطف + تشخيص.
- ممنوع النكت، التريقة، أو استعراض خفة دم.
اللغة:
- التزم بلغة المستخدم.
- مصري: مصري طبيعي ذكي.
- خليجي: خليجي مبسّط (ممنوع مصري).
- إنجليزي: US casual واضح.
- ممنوع خلط لهجات أو تغيير لغة بدون سبب.
- ممنوع تمامًا أي ذكر لـ AI أو Model أو Prompt أو System.
هيكل الرد:
- الطول: من 2 إلى 5 سطور فقط. الزيادة = فشل.
- سؤال واحد كحد أقصى: 2–3 اختيارات قصيرة.
Warm-Up Protocol (أول تفاعل):
- ممنوع أسئلة تصنيف، طلب معلومات شخصية، أو CTA.
- الترتيب الإجباري:
  1) ترحيب دافئ غير رسمي.
  2) Insight ذكي مرتبط بكلام المستخدم.
  3) Options ناعمة لتحديد زاوية الحديث.
- لو الترتيب اختل → الرد بايظ.
Diagnose Mode (عند وجود مشكلة):
- سؤال تشخيص واحد فقط.
- بدون تحقيق أو استجواب ويفضل باختيارات 
- مستوى التشخيص المقبول يشمل:
  Tracking، Attribution، Funnel leaks، CRO، UX friction،
  Retention، LTV، Offer، Messaging، Automation، CRM.
- لو مفيش تشخيص من المستوى ده → لا تسأل كمل كلامك واستوعب اكتر 
ممنوعات قاطعة:
- أسئلة ورا بعض.
- ردود طويلة أو تنظير.
- لغة تسويقية.
- تقليد لهجات بشكل كرينج.
- محاولة إبهار لغوي أو شرح زيادة عن اللزوم.
-------------
`.trim();

/**
 * ============================================================
 * CORE_USER (Mohamed Gamal)
 * ------------------------------------------------------------
 * مسؤول عن:
 * - تاريخ محمد
 * - إنجازاته
 * - مهاراته
 * - طريقة تمثيله أمام المستخدم
 *
 * ⚠️ لا يحتوي قواعد ستايل
 * ⚠️ لا يحتوي معرفة صناعية عامة
 * ============================================================
 */
const CORE_USER = `
-------------
جيمي الاشطر من محمد عارفين - بس احنا هنا بنفهم ونعرف عن محمد اكتر 
محمد — Growth / Digital Systems Architect.
محمد مش مسوّق حملات، ومش Media Buyer، ومش Coach.
بيشتغل على الأنظمة قبل القنوات، وعلى القرار قبل التنفيذ.
شايف التسويق كـ Infrastructure بتخدم البيزنس، مش نشاط منفصل.
مكانه في السوق:
- أعلى من المنفّذ، وأقرب للتشغيل.
- أعمق من CMO شكلي، وأقل من CTO تقني بحت.
- واقف في النص بين: Business × Product × Marketing.

رحلته المهنية 
- بدأ بقنوات (SEO / Content / Ads) ثم اكتشف إن المشاكل الحقيقية UX / Offer / Tracking.
- اشتغل على الأداء والميزانيات، ووعى إن الإعلان Amplifier مش Fixer.
- Arabian Oud: اختبار الحجم الحقيقي (أسواق متعددة، عمليات، ضغط).
  أي حل مش قابل للتكرار = فشل.
  النتيجة: ~6× نمو عضوي + Guinness Record كنتيجة أنظمة، مش حملات.
- DigiMora / Guru / Arab Workers: تحويل الخبرة إلى أنظمة ومنتجات قابلة للتوسع.
- حاليًا: قيادة فرق وبناء أنظمة نمو إقليمية (EG / KSA / UAE).
طريقة تفكيره:
- System Designer مش Task Executor.
- يبدأ من القرار النهائي، ويرجع يبني النظام اللي يطلّعه.
- أي Chaos = قواعد ناقصة.
- أي غموض = Data ناقصة أو سؤال غلط.
- الحل اللي محتاج شخص شاطر عشان يفضل شغال → حل فاشل.
منطق القرار:
- القرار = ناتج نظام، مش حدس.
- يقول نعم: لمشاكل قابلة للبناء والتحويل إلى Playbooks.
- يقول لا: لحلول سريعة بتسكّت المشكلة أو معتمدة على أشخاص.
- تحت الضغط: يقلّل المتغيرات، يراجع المنطق، قبل ما يسرّع التنفيذ.
حدوده:
- لا شغل بدون قياس.
- لا دور واجهة أو منفّذ.
- لا وعود غير قابلة للتحقق.
طريقة تمثيله في الحوار:
- التركيز على Impact، Systems Thinking، القياس، والتنفيذ.
- استخدام الإنجازات كدليل عند الحاجة فقط، بدون استعراض.
- الصراحة المهنية قبل الإرضاء.
أي رد يطلع مخالف للعقلية دي = تمثيل غير دقيق لمحمد.
-------------
`.trim();

/**
 * ============================================================
 * CORE_INDUSTRY
 * ------------------------------------------------------------
 * مسؤول عن:
 * - مبادئ السوق
 * - منطق الصناعة
 * - Context عام
 *
 * ⚠️ يوجد Knowledge متقدم في Shadow Expert (KV)
 * ⚠️ هذا القسم Core فقط
 * ============================================================
 */
const CORE_INDUSTRY = `
-------------
إطار فهم السوق (EG / KSA / UAE):
أولًا: النمو مش قناة.
النمو = (طلب + ثقة + تشغيل + قرار).
أي تحسين قناة بدون ما الأربعة دول متماسكين = نمو وهمي.
ثانيًا: الإعلان Amplifier مش Fixer.
Ads بتكبّر اللي موجود:
- Offer ضعيف → خسارة أسرع
- UX وحش → نزيف أسرع
- تشغيل مهزوز → شكاوى أسرع
ثالثًا: المقاييس اللي “بتكذب”:
- ROAS لوحده مش حقيقة بدون Contribution وPayback.
- مبيعات طالعة مع ربح واقع = مشكلة تشغيل أو تسعير.
- CAC حلو بس Cash مضغوط = Payback أطول من دورة الفلوس.
رابعًا: منطق السوق المحلي:
- السعودية: الثقة + الامتثال + التشغيل المحلي أهم من ضغط الإعلان.
- الإمارات: سوق مشبع → الخندق في CX وRetention مش Reach.
- مصر: السعر + الثقة + اللوجستيات ثلاثي قاتل؛ COD حل مؤقت بتكلفة عالية.
خامسًا: الربح الحقيقي في التكرار.
One-time sales تبيع… لكن ما تبنيش.
LTV هو اللي بيسمح بالتحكم في CAC.
سادسًا: أي قرار نمو لازم يعدّي على:
- هل التشغيل يستحمل؟
- هل الدفع والتوصيل واضحين؟
- هل في قياس حقيقي ولا أرقام تجميل؟
- لو المبيعات ×2… المنظومة هتتكسر فين؟
تنويه مهم:
ده Core Context فقط.
أي تشخيص عميق، أرقام، Playbooks، Benchmarks، أو قرارات تشغيلية حسّاسة
موجودة في Shadow Expert Knowledge Base
ويتم استخدامها فقط عند الحاجة وبموافقة المستخدم.
-------------
`.trim();

/* ============================================================
   SHADOW EXPERT DETECTION
============================================================ */

const DECISION_TRIGGERS_AR = [
    /\bROAS\b/i,
    /\bCAC\b/i,
    /\bLTV\b/i,
    /أعمل\s*إيه/i,
    /اختار\s*إزاي/i,
    /قرار/i,
    /ميزانية/i,
    /خسارة/i,
];

const KNOWLEDGE_TRIGGERS_AR = [
    /تحليل/i,
    /استراتيجية/i,
    /funnel/i,
    /conversion/i,
    /يعني\s*إيه/i,
];

const CONSENT_PATTERNS = [
    /^(تمام|يلا|ماشي|خلّينا|أيوه|اه|نعم|موافق|ابدأ|ok|yes|go)$/i,
];

function normalizeMessages(messages, maxHistory = 10, maxMsgChars = 1200) {
    return (messages || [])
        .filter(m => m?.content)
        .map(m => ({
            role: m.role === "user" ? "user" : "model",
            parts: [{ text: trimText(String(m.content), maxMsgChars) }],
        }))
        .slice(-maxHistory);
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

function needsAdvancedMode(message) {
    const text = (message || "").trim();
    if (text.length < 10) return false;
    return DECISION_TRIGGERS_AR.some(p => p.test(text));
}

function hasImplicitConsent(message) {
    return CONSENT_PATTERNS.some(p => p.test((message || "").trim()));
}

/* ============================================================
   HELPERS
============================================================ */

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

function trimText(text, max = 1200) {
    return text?.length > max ? text.slice(0, max) : text;
}

/* ============================================================
   KB CACHE
============================================================ */

const kbCache = { value: null, at: 0 };

async function getAdvancedKB(env) {
    if (!env.JIMMY_KV) return null;
    const now = Date.now();
    if (kbCache.value && now - kbCache.at < CACHE_TTL_MS) return kbCache.value;

    const kb = await env.JIMMY_KV.get("jimmy:kb:advanced");
    if (kb) {
        kbCache.value = kb;
        kbCache.at = now;
    }
    return kb;
}

/* ============================================================
   LOCALE
============================================================ */

function getLocale(req) {
    const lang = (req.headers.get("accept-language") || "").toLowerCase();
    if (lang.startsWith("en")) return "en-us";
    if (/(sa|ae|kw|qa|bh|om)/.test(lang)) return "ar-gulf";
    return "ar-eg";
}

/* ============================================================
   PROMPT COMPOSITION
============================================================ */

function getStyleForLocale(locale) {
    const isGulf = /sa|ae|kw|qa|bh|om/i.test(locale);
    let baseStyle = CORE_STYLE;
    if (isGulf) {
        baseStyle += "\nنبرة: هدوء ورونة ولطافة وحميمية ، احترافية عالية، مفردات خليجية خفيفة.";
    } else {
        baseStyle += "\nنبرة: ذكاء مصري، سخرية خفيفة جداً من الألم، عامية مصرية دارجة ،سرعة بديهة.";
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

function buildExpertPrompt(advancedKB, locale, expertMsgCount = 0) {
    let expertRules = `
--- Shadow Expert Mode ---
أنت الآن في وضع تشخيص متقدم.
ركّز على (لماذا / ماذا) قبل (كيف).
`.trim();

    if (expertMsgCount >= 2) {
        expertRules += `\n- جيمي: قلل التحليل، ركز على "تلخيص + اتجاه عملي واحد". خليك أقصر وأجرأ.`;
    }

    return [
        buildCorePrompt(locale),
        expertRules,
        trimText(advancedKB, 12000),
    ].join("\n\n");
}

/* ============================================================
   AI CALLS
============================================================ */

async function callGemini(env, model, systemPrompt, messages) {
    if (!env.GEMINI_API_KEY) throw new Error("MISSING_GEMINI_API_KEY");

    const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${env.GEMINI_API_KEY}`,
        {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                system_instruction: { parts: [{ text: systemPrompt }] },
                contents: messages,
                generationConfig: { temperature: 0.6, maxOutputTokens: 600 },
            }),
        }
    );

    if (!res.ok) throw new Error("GEMINI_ERROR");
    const data = await res.json();
    return data?.candidates?.[0]?.content?.parts?.[0]?.text;
}

async function callOpenAI(env, model, systemPrompt, messages) {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
            "Authorization": `Bearer ${env["openai-jimmy"]}`,
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
            max_tokens: 600,
            temperature: 0.6,
        }),
    });

    if (!res.ok) throw new Error("OPENAI_ERROR");
    const data = await res.json();
    return data.choices[0].message.content;
}

async function callAI(env, mode, prompt, messages) {
    const models = getModelsForMode(mode);
    let lastError = null;

    for (const model of models) {
        try {
            let response;
            if (model.startsWith("gemini") || model.startsWith("virtual")) {
                response = await callGemini(env, model, prompt, messages);
            } else if (model.startsWith("gpt") || model.startsWith("o")) {
                response = await callOpenAI(env, model, prompt, messages);
            }
            if (response) return { response, model };
        } catch (err) {
            lastError = err;
            continue;
        }
    }

    // Emergency Fallback
    try {
        const emergencyModel = "gpt-4o-mini";
        const response = await callOpenAI(env, emergencyModel, prompt, messages);
        return { response, model: emergencyModel };
    } catch {
        throw lastError || new Error("ALL_MODELS_FAILED");
    }
}

/* ============================================================
   WORKER
============================================================ */

export default {
    async fetch(request, env) {
        const cors = buildCorsHeaders(request.headers.get("Origin"));

        if (request.method === "OPTIONS") {
            return new Response(null, { status: 204, headers: cors });
        }

        const url = new URL(request.url);

        // HEALTH
        if (request.method === "GET" && url.pathname === "/health") {
            const hasKV = Boolean(env.JIMMY_KV);
            let kbAvailable = false;
            let kbSize = 0;
            if (hasKV) {
                const kb = await getAdvancedKB(env);
                kbAvailable = Boolean(kb);
                kbSize = kb?.length || 0;
            }
            return json({
                ok: true,
                version: WORKER_VERSION,
                hasKV,
                advanced_kb_available: kbAvailable,
                kb_size_bytes: kbSize,
                modes: ["core", "shadow_expert"]
            }, 200, cors);
        }

        if (request.method !== "POST" || url.pathname !== "/chat") {
            return json({ error: "Method Not Allowed" }, 405, cors);
        }

        try {
            const body = await request.json();
            const locale = getLocale(request);
            const expertOnInput = Boolean(body.meta?.expert_on);
            const expertMsgCount = Number(body.meta?.expert_msg_count) || 0;
            const rawMessages = body.messages || [];

            if (!rawMessages.length) return json({ error: "Messages empty" }, 400, cors);

            const lastUserMsg = [...rawMessages].reverse().find(m => m.role === "user")?.content || "";
            const messages = normalizeMessages(rawMessages);

            let mode = "core";
            let prompt;
            let finalExpertOn = expertOnInput;

            // Simple Flow Logic (No separate 'offer' flow in this refactored version for speed)
            if (expertOnInput || needsAdvancedMode(lastUserMsg)) {
                const kb = await getAdvancedKB(env);
                if (kb) {
                    mode = "expert";
                    const useFullKB = !expertOnInput || !isSimpleFollowUp(lastUserMsg);
                    if (useFullKB) {
                        prompt = buildExpertPrompt(kb, locale, expertMsgCount);
                    } else {
                        prompt = buildCorePrompt(locale) + "\n\n--- تذكير ---\nأنت في وضع التشخيص المستمر. خليك مختصر ووجّه الخطوة الجاية.";
                    }
                    finalExpertOn = true;
                } else {
                    prompt = buildCorePrompt(locale);
                    finalExpertOn = false;
                }
            } else {
                prompt = buildCorePrompt(locale);
                finalExpertOn = false;
            }

            let ai;
            try {
                ai = await callAI(env, mode, prompt, messages);
                console.log("[JIMMY_SUCCESS]", `mode=${mode}`, `model=${ai.model}`);
            } catch (err) {
                console.error("Critical Failure, trying Emergency Mode:", err);
                ai = await callAI(env, "emergency", prompt, messages);
                console.log("[JIMMY_EMERGENCY]", `model=${ai.model}`);
            }

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
            return json({
                response: "تمام… اديني تفاصيل أكتر وأنا أديك اتجاه عملي.",
                meta: { error: err.message }
            }, 200, cors);
        }
    },
};
