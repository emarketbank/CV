/**
 * 🤖 MG-AGENT 2026
 * The intelligent assistant for Mohamed Gamal's portfolio.
 */

const AGENT_CONFIG = {
    workerUrl: 'https://mg-ai-proxy.emarketbank.workers.dev/chat',
    timeoutMs: 9000,
    maxHistory: 12,
    typingText: {
        ar: 'ثواني وبرد عليك...',
        en: 'Thinking...'
    },
    errorText: {
        ar: 'حصلت مشكلة مؤقتة. جرّب تاني بعد لحظة.',
        en: 'Something went wrong. Please try again in a moment.'
    }
};

class MGAgent {
    constructor() {
        this.messages = [];
        this.userLanguage = null;
        this.isSending = false;
        this.elements = {};
        this.init();
    }

    init() {
        this.createUI();
        this.cacheElements();
        this.addEventListeners();
    }

    createUI() {
        if (document.getElementById('mg-ai-root')) {
            return;
        }

        const pageLang = document.documentElement.lang === 'ar' ? 'ar' : 'en';
        const isArabic = pageLang === 'ar';

        const branding = {
            ar: {
                name: 'كابتن جيمي',
                subtitle: 'ضابط النظام الذكي',
                welcome: 'أهلاً! أنا كابتن جيمي 👮‍♂️. اؤمرني، حابب تعرف إيه عن خبرات محمد؟',
                placeholder: 'اسألني عن الخبرات، المشاريع، أو طريقة العمل...',
                time: 'الآن'
            },
            en: {
                name: 'Captain Jemy',
                subtitle: 'System Officer',
                welcome: "Welcome! I'm Captain Jemy 👮‍♂️. How can I help you explore Mohamed's work?",
                placeholder: 'Ask about experience, skills, or projects...',
                time: 'Just now'
            }
        };

        const brand = isArabic ? branding.ar : branding.en;
        this.userLanguage = isArabic ? 'ar' : 'en';

        const chatHTML = `
            <div class="ai-chat-container" id="aiChat">
                <div class="ai-chat-header">
                    <div class="ai-header-aurora"></div>
                    <div class="ai-avatar-wrap">
                        <div class="ai-avatar-inner">
                            <img src="https://raw.githubusercontent.com/emarketbank/CV/refs/heads/main/assets/images/Cjimmy.png" alt="${brand.name}">
                        </div>
                        <span class="ai-status-dot"></span>
                    </div>
                    <div class="ai-info">
                        <h3>${brand.name}</h3>
                        <span>${brand.subtitle}</span>
                    </div>
                    <button class="ai-close" id="closeChat" aria-label="Close Chat">
                        <i class="ri-close-line"></i>
                    </button>
                </div>
                <div class="ai-chat-messages" id="aiMessages">
                    <div class="message ai-msg">
                        <div class="msg-content">${brand.welcome}</div>
                        <span class="msg-time">${brand.time}</span>
                    </div>
                </div>
                <div class="ai-chat-input-area">
                    <div class="ai-input-wrapper">
                        <input type="text" id="aiInput" placeholder="${brand.placeholder}">
                        <button id="sendMsg" aria-label="Send Message">
                            <i class="ri-send-plane-fill"></i>
                        </button>
                    </div>
                </div>
            </div>

            <div class="ai-core-trigger" id="toggleChat" aria-label="Talk to Captain Jemy">
                <div class="core-node">
                    <div class="core-inner"></div>
                    <img src="https://raw.githubusercontent.com/emarketbank/CV/refs/heads/main/assets/images/Cjimmy.png" alt="AI Agent">
                </div>
                <div class="core-orbit"></div>
                <div class="core-pulse"></div>
            </div>
        `;

        const root = document.createElement('div');
        root.id = 'mg-ai-root';
        root.innerHTML = chatHTML;
        document.body.appendChild(root);
    }

    cacheElements() {
        this.elements = {
            toggle: document.getElementById('toggleChat'),
            close: document.getElementById('closeChat'),
            chat: document.getElementById('aiChat'),
            input: document.getElementById('aiInput'),
            send: document.getElementById('sendMsg'),
            messages: document.getElementById('aiMessages')
        };
    }

    addEventListeners() {
        const { toggle, close, input, send } = this.elements;

        if (!toggle || !close || !input || !send) {
            return;
        }

        toggle.addEventListener('click', () => this.toggleChat());
        close.addEventListener('click', () => this.closeChat());

        send.addEventListener('click', () => this.handleSend());
        input.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.handleSend();
        });

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.closeChat();
            }
        });
    }

    toggleChat() {
        const { chat, toggle } = this.elements;
        if (!chat || !toggle) return;

        chat.classList.toggle('active');
        toggle.classList.toggle('active');
    }

    closeChat() {
        const { chat, toggle } = this.elements;
        if (!chat || !toggle) return;

        chat.classList.remove('active');
        toggle.classList.remove('active');
    }

    detectLanguage(text) {
        const arabicPattern = /[\u0600-\u06FF]/;
        return arabicPattern.test(text) ? 'ar' : 'en';
    }

    updateUILanguage(lang) {
        const placeholders = {
            ar: 'اكتب سؤالك هنا...',
            en: 'Type your question here...'
        };
        const { input } = this.elements;
        if (input) {
            input.placeholder = placeholders[lang] || placeholders.en;
        }
    }

    trimHistory() {
        if (this.messages.length > AGENT_CONFIG.maxHistory) {
            this.messages = this.messages.slice(-AGENT_CONFIG.maxHistory);
        }
    }

    setSendingState(isSending) {
        this.isSending = isSending;
        const { input, send } = this.elements;

        if (input) input.disabled = isSending;
        if (send) send.disabled = isSending;
    }

    async fetchResponse(payload) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), AGENT_CONFIG.timeoutMs);

        try {
            const res = await fetch(AGENT_CONFIG.workerUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                signal: controller.signal,
                body: JSON.stringify(payload)
            });

            let data = null;
            try {
                data = await res.json();
            } catch (err) {
                if (!res.ok) {
                    throw new Error('Empty response from server.');
                }
            }

            if (!res.ok) {
                const message = data?.error || data?.response || 'Request failed.';
                throw new Error(message);
            }

            return data;
        } finally {
            clearTimeout(timeoutId);
        }
    }

    async handleSend() {
        const { input } = this.elements;
        if (!input || this.isSending) return;

        const text = input.value.trim();
        if (!text) return;

        const detectedLang = this.detectLanguage(text);
        if (detectedLang !== this.userLanguage) {
            this.userLanguage = detectedLang;
            this.updateUILanguage(detectedLang);
        }

        this.messages.push({ role: 'user', content: text });
        this.trimHistory();
        this.addMessage(text, 'user');
        input.value = '';

        // Show typing indicator (Dots bubble)
        const typingId = this.addMessage('', 'ai', true);
        this.setSendingState(true);

        try {
            const data = await this.fetchResponse({ messages: this.messages });
            const reply = data?.response?.trim();

            if (!reply) {
                throw new Error('Empty response');
            }

            this.messages.push({ role: 'assistant', content: reply });
            this.trimHistory();
            this.removeMessage(typingId);
            this.addMessage(reply, 'ai');
        } catch (err) {
            this.removeMessage(typingId);
            const fallback = AGENT_CONFIG.errorText[this.userLanguage] || AGENT_CONFIG.errorText.en;
            this.addMessage(fallback, 'ai');
            console.error('AI Agent error:', err.message || err);
        } finally {
            this.setSendingState(false);
        }
    }

    addMessage(text, sender, isTyping = false) {
        const { messages } = this.elements;
        if (!messages) return null;

        const msg = document.createElement('div');
        msg.className = `message ${sender}-msg`;
        if (isTyping) {
            msg.id = `typing-${Date.now()}`;
        }

        const content = document.createElement('div');
        content.className = 'msg-content';

        if (isTyping) {
            content.className += ' typing-dots';
            content.innerHTML = '<span></span><span></span><span></span>';
        } else {
            content.textContent = text;
        }

        msg.appendChild(content);
        messages.appendChild(msg);
        messages.scrollTop = messages.scrollHeight;
        return msg.id || null;
    }

    removeMessage(id) {
        if (!id) return;
        const msg = document.getElementById(id);
        if (msg) msg.remove();
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.mgAgent = new MGAgent();
});
