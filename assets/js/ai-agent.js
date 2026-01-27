/**
 * 🤖 MG-AGENT 2026
 * The intelligent assistant for Mohamed Gamal's portfolio.
 */

const AGENT_CONFIG = {
    workerUrl: 'https://mg-ai-proxy.emarketbank.workers.dev/chat',
    timeoutMs: 10000,
    maxHistory: 12,
    maxRetries: 1,
    retryDelayMs: 1500,
    storageKey: 'jimmy_chat_history',
    typingText: {
        ar: 'ثواني وبرد عليك...',
        en: 'Thinking...'
    },
    errorText: {
        ar: 'حصلت مشكلة في الاتصال.',
        en: 'Connection issue.',
        arFinal: 'الخدمة مش متاحة حالياً. جرّب كمان شوية.',
        enFinal: 'Service temporarily unavailable. Please try again later.'
    }
};

class MGAgent {
    constructor() {
        this.messages = [];
        this.userLanguage = null;
        this.isSending = false;
        this.elements = {};
        this.retryCount = 0;
        this.init();
    }

    init() {
        this.createUI();
        this.cacheElements();
        this.addEventListeners();
        this.loadFromStorage();
    }

    loadFromStorage() {
        try {
            const saved = localStorage.getItem(AGENT_CONFIG.storageKey);
            if (saved) {
                const data = JSON.parse(saved);
                this.messages = data.messages || [];
                this.userLanguage = data.language || null;
                // Re-render saved messages
                this.messages.forEach(msg => {
                    this.addMessage(msg.content, msg.role === 'user' ? 'user' : 'ai', false, true);
                });
            }
        } catch (e) {
            console.warn('Failed to load chat history:', e);
        }
    }

    saveToStorage() {
        try {
            const data = {
                messages: this.messages.slice(-AGENT_CONFIG.maxHistory),
                language: this.userLanguage
            };
            localStorage.setItem(AGENT_CONFIG.storageKey, JSON.stringify(data));
        } catch (e) {
            console.warn('Failed to save chat history:', e);
        }
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
                name: 'Captain Jimmy',
                subtitle: 'System Officer',
                welcome: "Welcome! I'm Captain Jimmy 👮‍♂️. How can I help you explore Mohamed's work?",
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

            <div class="ai-core-trigger" id="toggleChat" aria-label="Talk to Captain Jimmy">
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

    async fetchResponse(payload, attempt = 1) {
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
                if (data?.response) {
                    return { response: data.response, request_id: data.request_id, is_fallback: true };
                }
                const message = data?.error || 'Request failed.';
                throw new Error(message);
            }

            return data;
        } catch (err) {
            // Retry on timeout or server error
            if (attempt < AGENT_CONFIG.maxRetries) {
                console.warn(`Request attempt ${attempt} failed, retrying...`, err.message);
                await new Promise(r => setTimeout(r, AGENT_CONFIG.retryDelayMs * attempt));
                return this.fetchResponse(payload, attempt + 1);
            }
            throw err;
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
        this.saveToStorage();
        input.value = '';

        // Show typing indicator (Dots bubble)
        const typingId = this.addMessage('', 'ai', true);
        this.setSendingState(true);

        try {
            const data = await this.fetchResponse({ messages: this.messages, language: this.userLanguage });
            const reply = data?.response?.trim();

            if (!reply) {
                throw new Error('Empty response');
            }

            this.messages.push({ role: 'assistant', content: reply });
            this.trimHistory();
            this.removeMessage(typingId);
            this.addMessage(reply, 'ai');
            this.saveToStorage();
        } catch (err) {
            this.removeMessage(typingId);
            // Show final error message
            const errorKey = this.userLanguage === 'ar' ? 'arFinal' : 'enFinal';
            const fallback = AGENT_CONFIG.errorText[errorKey] || AGENT_CONFIG.errorText.enFinal;
            this.addMessage(fallback, 'ai');
            console.error('AI Agent error:', err.message || err);
        } finally {
            this.setSendingState(false);
        }
    }

    addMessage(text, sender, isTyping = false, skipAnimation = false) {
        const { messages } = this.elements;
        if (!messages) return null;

        const msg = document.createElement('div');
        msg.className = `message ${sender}-msg${skipAnimation ? '' : ''}`;
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

        // Add timestamp
        const time = document.createElement('span');
        time.className = 'msg-time';
        time.textContent = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

        msg.appendChild(content);
        if (!isTyping) {
            msg.appendChild(time);
        }
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
