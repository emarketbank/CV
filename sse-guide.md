# دليل التعامل مع Jimmy SSE Protocol

هذا الدليل يشرح كيفية الاتصال بخادم `Jimmy` باستخدام بروتوكول **Server-Sent Events (SSE)** الموحد.

## 1. البروتوكول (Unified Output)

الخادم يرسل البيانات بتنسيق موحد بغض النظر عن المصدر (OpenAI, Gemini, أو رد جاهز). كل رسالة تبدأ بـ `event: <type>` وتتبعها `data: <json_or_text>`.

### أنواع الأحداث (Events):

1.  **`meta`**: تصل مرة واحدة في البداية.
    ```
    event: meta
    data: {"request_id": "req_...", "provider": "openai", "model": "gpt-5.1"}
    ```
    *نصيحة:* استخدم هذا الحدث لإظهار "Thinking..." أو "Connected".

2.  **`token`**: تصل بشكل متكرر (Streaming).
    ```
    event: token
    data: "السلام "
    
    event: token
    data: "عليكم"
    ```
    *ملاحظة:* البيانات داخل `data` تكون string (JSON escaped) يمثل جزئية من النص.

3.  **`done`**: تصل عند انتهاء الرد.
    ```
    event: done
    data: {}
    ```

4.  **`error`**: تصل في حالة حدوث خطأ أثناء البث.
    ```
    event: error
    data: {"message": "Something went wrong"}
    ```

## 2. كيفية الاتصال (Client-Side Logic)

بما أن الـ Endpoint تتطلب `POST` (لإرسال الرسائل)، لا يمكن استخدام `EventSource` التقليدي. يجب استخدام `fetch` مع `ReadableStream`.

### كود JavaScript المقترح:

```javascript
async function chatWithJimmy(messages) {
  const response = await fetch("https://jimmy.your-worker.workers.dev/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messages, language: "ar" })
  });

  if (!response.ok) throw new Error("Network error");

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    
    // معالجة الـ Events (Split by double newline)
    const parts = buffer.split("\n\n");
    buffer = parts.pop(); // احتفظ بالجزء غير المكتمل

    for (const part of parts) {
      const lines = part.split("\n");
      let eventType = null;
      let data = null;

      for (const line of lines) {
        if (line.startsWith("event: ")) eventType = line.substring(7).trim();
        else if (line.startsWith("data: ")) data = line.substring(6);
      }

      if (eventType && data) {
        handleEvent(eventType, data);
      }
    }
  }
}

function handleEvent(type, rawData) {
  if (type === "meta") {
    const meta = JSON.parse(rawData);
    console.log("Connected to:", meta.provider);
    showTypingIndicator(); // e.g., "Jimmy is typing..."
  } 
  else if (type === "token") {
    // data is a raw string inside quotes, usually simple parse is enough
    // or if the worker sends JSON encoded string:
    try {
        const text = JSON.parse(rawData); // Or simple unescape if implementation varies
        appendToChat(text);
    } catch(e) { appendToChat(rawData); } // Fallback
  } 
  else if (type === "done") {
    hideTypingIndicator();
  }
}
```

## 3. تحسينات UX

1.  **Thinking Cue:** بمجرد استلام `meta`، اظهر للمستخدم "جاري التحليل..." بدلاً من "جاري الكتابة".
2.  **Timeouts:**
    *   إذا لم يصل `meta` خلال 3 ثواني -> اعرض "جاري الاتصال...".
    *   إذا انقطع الاتصال بدون `done` -> اعرض زر "إعادة المحاولة".

## 4. الفحص السريع (Testing)

يمكنك اختبار الخادم باستخدام `curl` لرؤية الـ Events مباشرة:

```bash
curl -X POST https://your-worker-url/chat \
  -H "Content-Type: application/json" \
  -d '{"messages": [{"role": "user", "content": "مين محمد جمال؟"}]}' \
  --no-buffer
```

