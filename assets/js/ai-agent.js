/**
 * 🤖 MG-AGENT 2026 (ULTRA-MINIMALIST NEURAL DESIGN)
 * The intelligent assistant for Mohamed Gamal's portfolio.
 */

class MGAgent {
    constructor() {
        this.isOpen = false;
        this.messages = [];
        this.userLanguage = null; // Track detected language (ar/en)
        this.init();
    }

    init() {
        this.createUI();
        this.addEventListeners();
    }

    createUI() {
        const chatHTML = `
            <div class="ai-chat-container" id="aiChat">
                <div class="ai-chat-header">
                    <div class="ai-header-aurora"></div>
                    <div class="ai-avatar-wrap">
                        <div class="ai-avatar-inner">
                            <i class="ri-customer-service-2-line"></i>
                        </div>
                        <span class="ai-status-dot"></span>
                    </div>
                    <div class="ai-info">
                        <h3>كابتن جيمي | Capt. Jimmy</h3>
                        <span>مساعدك الذكي | Smart Assistant</span>
                    </div>
                    <button class="ai-close" id="closeChat" aria-label="Close Chat">
                        <i class="ri-close-line"></i>
                    </button>
                </div>
                <div class="ai-chat-messages" id="aiMessages">
                    <div class="message ai-msg">
                        <div class="msg-content">أهلاً! أنا كابتن جيمي، مساعد محمد الذكي. دوري أوصّلك له بسرعة. إزاي أقدر أساعدك؟<br><br>Hi! I'm Captain Jimmy, Mohamed's smart assistant. I'm here to connect you with him quickly. How can I help?</div>
                        <span class="msg-time">Just now</span>
                    </div>
                </div>
                <div class="ai-chat-input-area">
                    <div class="ai-input-wrapper">
                        <input type="text" id="aiInput" placeholder="Initialize inquiry...">
                        <button id="sendMsg" aria-label="Send Message">
                            <i class="ri-terminal-box-fill"></i>
                        </button>
                    </div>
                </div>
            </div>
            
            <!-- NEW NON-TRADITIONAL NEURAL CORE ICON -->
            <div class="ai-core-trigger" id="toggleChat" aria-label="Talk to AI Core">
                <div class="core-node">
                    <div class="core-inner"></div>
                    <i class="ri-sparkling-2-fill"></i>
                </div>
                <div class="core-orbit"></div>
                <div class="core-pulse"></div>
            </div>
        `;

        const div = document.createElement('div');
        div.id = 'mg-ai-root';
        div.innerHTML = chatHTML;
        document.body.appendChild(div);

        // Inject Ultra-Modern Styles
        const style = document.createElement('style');
        style.textContent = `
            :root {
                --ai-primary: #00F0FF;
                --ai-secondary: #7000FF;
                --ai-bg: rgba(8, 10, 15, 0.95);
                --ai-glass: rgba(255, 255, 255, 0.03);
                --ai-border: rgba(255, 255, 255, 0.08);
            }

            /* --- 🔮 NEW NEURAL CORE TRIGGER --- */
            .ai-core-trigger {
                position: fixed;
                bottom: 35px;
                left: 35px;
                width: 55px; /* تصغير القطر */
                height: 55px;
                z-index: 10005;
                cursor: pointer;
                display: flex;
                align-items: center;
                justify-content: center;
                transition: all 0.5s cubic-bezier(0.16, 1, 0.3, 1);
            }

            .core-node {
                position: relative;
                width: 100%;
                height: 100%;
                background: #000;
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                color: var(--ai-primary);
                font-size: 1.4rem;
                z-index: 2;
                border: 1px solid var(--ai-border);
                transition: all 0.4s ease;
                box-shadow: 0 0 20px rgba(0, 240, 255, 0.1);
            }

            .core-inner {
                position: absolute;
                inset: 3px;
                border-radius: 50%;
                background: radial-gradient(circle at 30% 30%, rgba(0, 240, 255, 0.2), transparent 70%);
                border: 1px solid rgba(255,255,255,0.05);
            }

            .core-orbit {
                position: absolute;
                inset: -8px;
                border: 1px dashed var(--ai-primary);
                border-radius: 50%;
                opacity: 0.3;
                animation: rotateOrbit 10s linear infinite;
                pointer-events: none;
            }

            @keyframes rotateOrbit {
                from { transform: rotate(0deg); }
                to { transform: rotate(360deg); }
            }

            .core-pulse {
                position: absolute;
                inset: 0;
                background: var(--ai-primary);
                border-radius: 50%;
                opacity: 0;
                filter: blur(15px);
                transition: all 0.4s ease;
            }

            .ai-core-trigger:hover .core-node {
                transform: scale(1.1);
                border-color: var(--ai-primary);
                box-shadow: 0 0 30px rgba(0, 240, 255, 0.3);
            }

            .ai-core-trigger:hover .core-pulse {
                opacity: 0.2;
                transform: scale(1.5);
            }

            .ai-core-trigger:hover .core-orbit {
                opacity: 0.6;
                inset: -12px;
                border-style: solid;
            }

            .ai-core-trigger.active .core-node {
                transform: rotate(90deg);
                background: var(--ai-secondary);
                color: #fff;
            }

            /* --- CHAT CONTAINER --- */
            .ai-chat-container {
                position: fixed;
                bottom: 105px;
                left: 35px;
                width: 380px;
                max-width: calc(100vw - 70px);
                height: 550px;
                max-height: calc(100vh - 150px);
                background: var(--ai-bg);
                backdrop-filter: blur(50px) saturate(200%);
                -webkit-backdrop-filter: blur(50px) saturate(200%);
                border-radius: 28px;
                border: 1px solid var(--ai-border);
                z-index: 10004;
                display: flex;
                flex-direction: column;
                transform: translateY(30px) scale(0.9);
                opacity: 0;
                visibility: hidden;
                transition: all 0.5s cubic-bezier(0.16, 1, 0.3, 1);
                box-shadow: 0 50px 100px rgba(0,0,0,0.8);
                overflow: hidden;
            }

            .ai-chat-container.active {
                transform: translateY(0) scale(1);
                opacity: 1;
                visibility: visible;
            }

            .ai-chat-header {
                padding: 20px 25px;
                position: relative;
                display: flex;
                align-items: center;
                gap: 15px;
                border-bottom: 1px solid var(--ai-border);
            }

            .ai-header-aurora {
                position: absolute;
                inset: 0;
                background: linear-gradient(135deg, rgba(0, 240, 255, 0.05), rgba(112, 0, 255, 0.05));
                pointer-events: none;
            }

            .ai-avatar-inner {
                width: 42px;
                height: 42px;
                background: #000;
                border: 1px solid var(--ai-primary);
                border-radius: 12px;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 1.2rem;
                color: var(--ai-primary);
                box-shadow: 0 0 15px rgba(0, 240, 255, 0.2);
            }

            .ai-status-dot {
                position: absolute;
                bottom: -2px;
                right: -2px;
                width: 10px;
                height: 10px;
                background: #00FF66;
                border: 2px solid #080a0f;
                border-radius: 50%;
            }

            .ai-info h3 { margin: 0; font-size: 1rem; font-weight: 800; color: #fff; letter-spacing: 0.5px; }
            .ai-info span { font-size: 0.7rem; color: rgba(255,255,255,0.4); font-weight: 600; text-transform: uppercase; }

            .ai-close {
                margin-left: auto;
                background: none;
                border: none;
                color: rgba(255,255,255,0.3);
                cursor: pointer;
                font-size: 1.4rem;
                transition: all 0.3s;
            }

            .ai-close:hover { color: #fff; transform: rotate(90deg); }

            .ai-chat-messages {
                flex: 1;
                padding: 25px;
                overflow-y: auto;
                display: flex;
                flex-direction: column;
                gap: 20px;
                scrollbar-width: none;
            }

            .ai-chat-messages::-webkit-scrollbar { display: none; }

            .msg-content {
                padding: 14px 18px;
                border-radius: 18px;
                font-size: 0.9rem;
                line-height: 1.6;
                max-width: 90%;
            }

            .ai-msg .msg-content { 
                background: rgba(255,255,255,0.03); 
                border: 1px solid var(--ai-border);
                color: #ccc;
                border-bottom-left-radius: 2px;
            }

            .user-msg { align-self: flex-end; }
            .user-msg .msg-content {
                background: var(--ai-primary);
                color: #000;
                font-weight: 600;
                border-bottom-right-radius: 2px;
                box-shadow: 0 10px 20px rgba(0, 240, 255, 0.1);
            }

            .ai-chat-input-area {
                padding: 20px 25px;
                background: rgba(0,0,0,0.4);
                border-top: 1px solid var(--ai-border);
            }

            .ai-input-wrapper {
                background: rgba(255,255,255,0.03);
                border: 1px solid var(--ai-border);
                border-radius: 14px;
                display: flex;
                align-items: center;
                padding: 5px 5px 5px 15px;
            }

            .ai-input-wrapper input {
                flex: 1;
                background: none;
                border: none;
                padding: 10px 0;
                color: #fff;
                font-size: 0.85rem;
                outline: none;
            }

            .ai-input-wrapper button {
                width: 38px;
                height: 38px;
                border-radius: 10px;
                border: none;
                background: var(--ai-primary);
                color: #000;
                cursor: pointer;
                transition: all 0.3s;
            }

            /* RTL Support */
            html[lang="ar"] .ai-core-trigger { left: auto; right: 35px; }
            html[lang="ar"] .ai-chat-container { left: auto; right: 35px; }
            html[lang="ar"] .ai-close { margin-left: 0; margin-right: auto; }
        `;
        document.head.appendChild(style);
    }

    addEventListeners() {
        const toggle = document.getElementById('toggleChat');
        const close = document.getElementById('closeChat');
        const chat = document.getElementById('aiChat');
        const input = document.getElementById('aiInput');
        const send = document.getElementById('sendMsg');

        toggle.addEventListener('click', () => {
            chat.classList.toggle('active');
            toggle.classList.toggle('active');
        });

        close.addEventListener('click', () => {
            chat.classList.remove('active');
            toggle.classList.remove('active');
        });

        send.addEventListener('click', () => this.handleSend());
        input.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.handleSend();
        });
    }

    detectLanguage(text) {
        // Detect Arabic characters (Unicode range)
        const arabicPattern = /[\u0600-\u06FF]/;
        return arabicPattern.test(text) ? 'ar' : 'en';
    }

    updateUILanguage(lang) {
        const placeholders = {
            ar: 'اكتب سؤالك هنا...',
            en: 'Type your question here...'
        };
        document.getElementById('aiInput').placeholder = placeholders[lang];
    }

    async handleSend() {
        const input = document.getElementById('aiInput');
        const text = input.value.trim();
        if (!text) return;

        // Detect language on first user message
        if (!this.userLanguage) {
            this.userLanguage = this.detectLanguage(text);
            this.updateUILanguage(this.userLanguage);
        }

        this.addMessage(text, 'user');
        input.value = '';

        const typingId = this.addMessage('Decrypting neural patterns...', 'ai', true);

        try {
            const workerUrl = 'https://ai-agent.arabworkerseg.workers.dev/';
            const response = await fetch(workerUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    provider: 'gemini',
                    model: 'gemini-pro',
                    messages: [{ role: 'user', content: text }]
                }),
            });

            const data = await response.json();
            this.removeMessage(typingId);
            this.addMessage(data.response, 'ai');

        } catch (e) {
            this.removeMessage(typingId);
            this.addMessage(`System Override: ${e.message}`, 'ai');
        }
    }

    addMessage(text, sender, isTyping = false) {
        const container = document.getElementById('aiMessages');
        const msg = document.createElement('div');
        msg.className = `message ${sender}-msg`;
        if (isTyping) msg.id = 'typing-' + Date.now();

        msg.innerHTML = `<div class="msg-content">${text}</div>`;

        container.appendChild(msg);
        container.scrollTop = container.scrollHeight;
        return msg.id;
    }

    removeMessage(id) {
        const msg = document.getElementById(id);
        if (msg) msg.remove();
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.mgAgent = new MGAgent();
});
