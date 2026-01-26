/**
 * ULTRA 2026 - ARCHITECTURAL MOTION 2.0
 * Kinetic Character Morphing + Cybernetic Flash
 */

class ArchitectMotion {
    constructor() {
        this.scrambleChars = '!<>-_\/[]{}—=+*^?#________';
        this.eyebrow = document.querySelector('.hero-eyebrow');
        this.tagline = document.querySelector('.tagline');
        
        if (this.eyebrow) this.initElement(this.eyebrow, 500);
        if (this.tagline) this.initElement(this.tagline, 1200);
    }

    initElement(el, startDelay) {
        const originalText = el.innerText;
        el.innerText = '';
        el.style.opacity = '1';
        el.style.visibility = 'visible';
        
        // Break text into spans
        const charSpans = originalText.split('').map(char => {
            const span = document.createElement('span');
            span.style.display = 'inline-block';
            span.style.minWidth = char === ' ' ? '0.3em' : 'auto';
            span.innerText = char;
            span.style.opacity = '0';
            el.appendChild(span);
            return {
                span: span,
                char: char,
                revealed: false
            };
        });

        setTimeout(() => {
            charSpans.forEach((obj, index) => {
                const delay = Math.random() * 800 + (index * 30); // Random stagger
                this.animateChar(obj, delay);
            });
        }, startDelay);
    }

    animateChar(obj, delay) {
        const duration = 600; // Scramble duration
        let start = null;

        const step = (timestamp) => {
            if (!start) start = timestamp;
            const elapsed = timestamp - start;

            if (elapsed < delay) {
                requestAnimationFrame(step);
                return;
            }

            const progress = (elapsed - delay) / duration;

            if (progress < 1) {
                obj.span.style.opacity = '1';
                obj.span.innerText = this.scrambleChars[Math.floor(Math.random() * this.scrambleChars.length)];
                obj.span.className = 'scrambling-char';
                requestAnimationFrame(step);
            } else {
                obj.span.innerText = obj.char;
                obj.span.className = 'char-flash';
                obj.revealed = true;
            }
        };

        requestAnimationFrame(step);
    }
}

/**
 * 🌀 INFINITE DRAGGABLE MARQUEE ENGINE
 * Supports: Touch, Mouse, Velocity, Inertia
 */
class DraggableMarquee {
    constructor(element) {
        this.container = element;
        this.track = element.querySelector('.marquee-track');
        if (!this.track) return;

        // Config
        this.baseSpeed = parseFloat(element.dataset.speed) || -0.5; // Negative = left, Positive = right
        this.speed = this.baseSpeed;
        this.pos = 0;
        this.isDragging = false;
        this.startX = 0;
        this.lastX = 0;
        this.velocity = 0;
        this.rafId = null;

        // Clone content for seamless loop if not already duplicated enough
        this.ensureContentWidth();

        this.initEvents();
        this.animate();
    }

    ensureContentWidth() {
        // Simple duplication to ensure we have enough width to scroll
        // In a production app, we might measure and clone dynamically until fill
        // For now, assuming HTML has at least 1 set of duplicates (Group 1 + Group 2)
        const trackWidth = this.track.scrollWidth;
        const containerWidth = this.container.offsetWidth;
        
        if (trackWidth < containerWidth * 2) {
            this.track.innerHTML += this.track.innerHTML;
        }
    }

    initEvents() {
        // Mouse Events
        this.container.addEventListener('mousedown', (e) => this.startDrag(e.clientX));
        window.addEventListener('mousemove', (e) => this.onDrag(e.clientX));
        window.addEventListener('mouseup', () => this.endDrag());

        // Touch Events
        this.container.addEventListener('touchstart', (e) => this.startDrag(e.touches[0].clientX));
        window.addEventListener('touchmove', (e) => this.onDrag(e.touches[0].clientX));
        window.addEventListener('touchend', () => this.endDrag());
        
        // Pause animation on CSS side to let JS take over full control?
        // Actually, we will use transform in JS, so we should disable CSS animation if it exists
        this.track.style.animation = 'none';
    }

    startDrag(x) {
        this.isDragging = true;
        this.startX = x;
        this.lastX = x;
        this.container.style.cursor = 'grabbing';
        this.velocity = 0;
    }

    onDrag(x) {
        if (!this.isDragging) return;
        const delta = x - this.lastX;
        this.lastX = x;
        this.pos += delta;
        this.velocity = delta; // Capture instant velocity
    }

    endDrag() {
        this.isDragging = false;
        this.container.style.cursor = 'grab';
    }

    animate() {
        if (!this.isDragging) {
            // Apply friction/inertia to return to base speed
            this.velocity *= 0.95; // Decay
            
            // Blend velocity back to base speed
            if (Math.abs(this.velocity) < Math.abs(this.baseSpeed)) {
               this.velocity = this.velocity * 0.95 + this.baseSpeed * 0.05;
            }
            
            this.pos += this.velocity;
        }

        // Infinite Loop Logic (Wrap Around)
        const trackWidth = this.track.scrollWidth / 2; // Assuming content is doubled
        
        // Normalize position
        if (this.pos <= -trackWidth) {
            this.pos += trackWidth;
        } else if (this.pos > 0) {
            this.pos -= trackWidth;
        }

        this.track.style.transform = `translateX(${this.pos}px)`;
        this.rafId = requestAnimationFrame(() => this.animate());
    }
}

document.addEventListener('DOMContentLoaded', () => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    
    new ArchitectMotion();

    // Initialize Marquees
    const marquees = document.querySelectorAll('.marquee-container');
    marquees.forEach(m => new DraggableMarquee(m));
});