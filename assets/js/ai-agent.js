/**
 * 🌌 THE DARK PRISM AGENT - 2026 EDITION
 * Logic for the Ultra-Modern Console
 */

const PRISM_CONFIG = {
    workerUrl: 'https://mg-ai-proxy.emarketbank.workers.dev/chat',
    requestTimeoutMs: 12000,
    maxHistory: 12,
    maxInputChars: 2500,
    texts: {
        en: {
            status: "SYSTEM READY",
            placeholder: "Ask Jimmy...",
            welcome: "Command Line Active. Accessing Mohamed's neural database...",
            error: "ERR_CONNECTION_LOST"
        },
        ar: {
            status: "النظام جاهز",
            placeholder: "اسأل جيمي...",
            welcome: "تم تفعيل سطر الأوامر. جاري استدعاء بيانات محمد...",
            error: "خطأ في الاتصال"
        }
    }
};

class PrismAgent {
    constructor() {
        this.isOpen = false;
        this.lang = document.documentElement.lang === 'ar' ? 'ar' : 'en';
        this.messages = [];
        this.isSending = false;
        this.init();
    }

    init() {
        // Dev warning for file:// protocol
        if (location.protocol === 'file:' || location.origin === 'null') {
            console.warn('[Jimmy] ⚠️ Running from file:// — Chat API blocked (CORS). Use a local server: npx serve');
        }
        this.render();
        this.cacheDOM();
        this.bindEvents();
        this.loadHistory();
    }

    render() {
        const txt = PRISM_CONFIG.texts[this.lang];

        const html = `
            <div id="mg-neural-backdrop"></div>
            
            <div id="aiTrigger" class="console-trigger">
                <img src="assets/images/jimmy-icon222222.png" alt="AI">
            </div>

            <div id="aiConsole" class="ai-console-container">
                <div class="console-header">
                    <div class="console-brand-wrapper">
                        <img src="assets/images/jimmy-icon222222.png" class="header-avatar" alt="AI">
                        <div class="header-info">
                            <span class="header-name">CAPTAIN JIMMY</span>
                            <span class="header-status"><span class="status-beacon"></span>AI ASSISTANT</span>
                        </div>
                    </div>
                    <button id="btnClose" class="console-close">
                        <i class="ri-close-line"></i>
                    </button>
                </div>

                <div id="consoleMsgs" class="console-messages">
                    <!-- Stream -->
                </div>

                <div class="console-input-area">
                    <div class="input-capsule">
                        <span class="input-prompt">->_</span>
                        <input type="text" id="consoleInput" class="console-input" placeholder="${txt.placeholder}" autocomplete="off">
                        <span class="return-hint">↵ Enter</span>
                    </div>
                </div>
            </div>
        `;

        const root = document.createElement('div');
        root.id = 'mg-prism-root';
        root.innerHTML = html;
        document.body.appendChild(root);
    }

    cacheDOM() {
        this.ui = {
            backdrop: document.getElementById('mg-neural-backdrop'),
            trigger: document.getElementById('aiTrigger'),
            console: document.getElementById('aiConsole'),
            close: document.getElementById('btnClose'),
            input: document.getElementById('consoleInput'),
            msgs: document.getElementById('consoleMsgs')
        };
    }

    bindEvents() {
        this.ui.trigger.addEventListener('click', () => this.toggle(true));
        this.ui.close.addEventListener('click', () => this.toggle(false));
        this.ui.backdrop.addEventListener('click', () => this.toggle(false));

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.isOpen) this.toggle(false);
        });

        this.ui.input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') this.handleSubmit();
        });

        // Focus Trap: Keep input focused unless closing
        this.ui.input.addEventListener('blur', () => {
            if (this.isOpen) {
                setTimeout(() => {
                    if (this.isOpen && document.activeElement !== this.ui.close) {
                        this.ui.input.focus();
                    }
                }, 150);
            }
        });
    }

    toggle(open) {
        this.isOpen = open;
        const { console: win, backdrop, trigger, input } = this.ui;

        if (open) {
            win.classList.add('active');
            backdrop.classList.add('active');
            trigger.classList.add('hidden');
            document.body.style.overflow = 'hidden';

            if (this.messages.length === 0) {
                this.addMessage('ai', PRISM_CONFIG.texts[this.lang].welcome);
            }

            setTimeout(() => input.focus(), 100);

        } else {
            win.classList.remove('active');
            backdrop.classList.remove('active');
            trigger.classList.remove('hidden');
            document.body.style.overflow = '';
        }
    }

    handleSubmit() {
        if (this.isSending) return;
        const raw = this.ui.input.value.trim();
        const text = this.trimInput(raw);
        if (!text) return;

        this.ui.input.value = '';
        this.addMessage('user', text);
        this.showTyping();
        this.fetchResponse();
    }

    trimInput(text) {
        const limit = PRISM_CONFIG.maxInputChars || 2500;
        if (!text) return '';
        return text.length > limit ? text.slice(0, limit) : text;
    }

    trimHistory() {
        const maxHistory = PRISM_CONFIG.maxHistory || 12;
        const keep = Math.max(maxHistory * 2, maxHistory);
        if (this.messages.length > keep) {
            this.messages = this.messages.slice(-keep);
        }
    }

    buildPayload() {
        const maxHistory = PRISM_CONFIG.maxHistory || 12;
        const maxChars = PRISM_CONFIG.maxInputChars || 2500;
        const ignore = new Set([
            PRISM_CONFIG.texts.en.error,
            PRISM_CONFIG.texts.ar.error,
            PRISM_CONFIG.texts.en.welcome,
            PRISM_CONFIG.texts.ar.welcome
        ]);

        const cleaned = this.messages
            .filter(m => !ignore.has(m.content))
            .map(m => ({
                role: m.role === 'user' ? 'user' : 'assistant',
                content: (m.content || '').toString().slice(0, maxChars)
            }))
            .filter(m => m.content.trim().length > 0);

        return cleaned.slice(-maxHistory);
    }


    setSending(isSending) {
        this.isSending = isSending;
        if (this.ui && this.ui.input) {
            this.ui.input.disabled = isSending;
        }
    }


    addMessage(role, text) {
        // Remove typing if exists
        const typing = document.getElementById('consoleTyping');
        if (typing) typing.remove();

        const isUser = role === 'user';
        const icon = isUser ? '<i class="ri-user-smile-line"></i>' : '<i class="ri-cpu-line"></i>';

        const html = `
            <div class="console-msg msg-${role}">
                <div class="msg-avatar ${isUser ? 'icon-user' : 'icon-ai'}">${icon}</div>
                <div class="msg-content">${this.formatText(text)}</div>
            </div>
        `;

        this.ui.msgs.insertAdjacentHTML('beforeend', html);
        this.scrollToBottom();

        this.messages.push({ role, content: text });
        this.trimHistory();
        this.saveHistory();
    }

    showTyping() {
        const html = `
            <div id="consoleTyping" class="console-msg msg-ai">
                <div class="msg-avatar icon-ai"><i class="ri-cpu-line"></i></div>
                <div class="msg-content typing-block">
                    <span></span><span></span><span></span>
                </div>
            </div>
        `;
        this.ui.msgs.insertAdjacentHTML('beforeend', html);
        this.scrollToBottom();
    }

    scrollToBottom() {
        this.ui.msgs.scrollTop = this.ui.msgs.scrollHeight;
    }

    formatText(text) {
        // Basic formatting for nice text blocks
        return text.replace(/\n/g, '<br>');
    }

    async fetchResponse() {
        if (this.isSending) return;
        this.setSending(true);

        const payload = this.buildPayload();
        if (!payload.length) {
            this.setSending(false);
            this.addMessage('ai', PRISM_CONFIG.texts[this.lang].error);
            return;
        }

        const controller = new AbortController();
        const timeoutMs = PRISM_CONFIG.requestTimeoutMs || 25000;
        const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

        try {
            const res = await fetch(PRISM_CONFIG.workerUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    messages: payload,
                    language: this.lang
                }),
                signal: controller.signal
            });

            if (!res.ok) {
                throw new Error(`HTTP ${res.status}`);
            }

            // SSE Stream consumption
            const reader = res.body.getReader();
            const decoder = new TextDecoder();
            let buffer = '';
            let fullText = '';

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop() || '';

                for (const line of lines) {
                    if (line.startsWith('event:')) continue;
                    if (line.startsWith(':')) continue; // ping/comment
                    if (line.startsWith('data: ')) {
                        const data = line.slice(6);
                        if (data === '{}') continue; // done event
                        try {
                            const parsed = JSON.parse(data);
                            if (typeof parsed === 'string') {
                                fullText += parsed;
                            } else if (parsed && parsed.message) {
                                fullText += ' [' + parsed.message + ']';
                            }
                        } catch { }
                    }
                }
            }

            if (fullText.trim()) {
                this.addMessage('ai', fullText.trim());
            } else {
                throw new Error('empty_response');
            }

        } catch (e) {
            console.error('[Jimmy] Fetch error:', e);
            this.addMessage('ai', PRISM_CONFIG.texts[this.lang].error);
        } finally {
            clearTimeout(timeoutId);
            this.setSending(false);
        }
    }


    saveHistory() {
        localStorage.setItem('mg_prism_history', JSON.stringify(this.messages));
    }

    loadHistory() {
        const saved = localStorage.getItem('mg_prism_history');
        if (!saved) return;
        try {
            const parsed = JSON.parse(saved);
            if (Array.isArray(parsed)) {
                this.messages = parsed;
                this.trimHistory();
            }
        } catch (e) {
            localStorage.removeItem('mg_prism_history');
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.prismAgent = new PrismAgent();
});
