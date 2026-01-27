/* 
   🚀 ULTRA-MODERN 2026 CORE JS
   Focus: Performance-optimized motion, Smart interactions, and Depth.
*/

document.addEventListener('DOMContentLoaded', () => {
    initUltraReveal();
    initMagneticButtons();
    initPerspectiveHover();
    initGhostParallax();
    initScrollProgress();
});

/**
 * --- 🔮 ULTRA REVEAL (Intersection Observer) ---
 * Smooth entry for sections and elements with custom easing.
 */
function initUltraReveal() {
    const revealElements = document.querySelectorAll('.reveal');

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('active');
                // Opt-out of observing once revealed for performance
                observer.unobserve(entry.target);
            }
        });
    }, {
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px'
    });

    revealElements.forEach(el => observer.observe(el));
}

/**
 * --- 🧲 MAGNETIC BUTTONS ---
 * Subtle attraction to the cursor for premium feel.
 */
function initMagneticButtons() {
    const magneticBtns = document.querySelectorAll('.pulse-btn, .btn-glass-compact, .btn-connect-mini');

    magneticBtns.forEach(btn => {
        btn.addEventListener('mousemove', (e) => {
            const rect = btn.getBoundingClientRect();
            const x = e.clientX - rect.left - rect.width / 2;
            const y = e.clientY - rect.top - rect.height / 2;

            btn.style.transform = `translate(${x * 0.3}px, ${y * 0.3}px)`;
        });

        btn.addEventListener('mouseleave', () => {
            btn.style.transform = 'translate(0, 0)';
        });
    });
}

/**
 * --- 🏢 PERSPECTIVE HOVER ---
 * Adds 3D depth to cards and mockups.
 */
function initPerspectiveHover() {
    const cards = document.querySelectorAll('.ultra-card, .timeline-content, .future-card');

    cards.forEach(card => {
        card.addEventListener('mousemove', (e) => {
            const rect = card.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;

            const centerX = rect.width / 2;
            const centerY = rect.height / 2;

            const rotateX = (y - centerY) / 20;
            const rotateY = (centerX - x) / 20;

            card.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale(1.02)`;
        });

        card.addEventListener('mouseleave', () => {
            card.style.transform = 'perspective(1000px) rotateX(0deg) rotateY(0deg) scale(1)';
        });
    });
}

/**
 * --- 👻 GHOST PARALLAX ---
 * Subtle movement for background data points.
 */
function initGhostParallax() {
    const ghosts = document.querySelectorAll('.ghost-metric');

    window.addEventListener('scroll', () => {
        const scrolled = window.pageYOffset;

        ghosts.forEach(ghost => {
            const speed = parseFloat(ghost.getAttribute('data-speed')) || 0.1;
            const yPos = -(scrolled * speed);
            ghost.style.transform = `translateY(${yPos}px)`;
        });
    });
}

/**
 * --- 📈 SCROLL PROGRESS ---
 * Visual feedback for scroll depth.
 */
function initScrollProgress() {
    const progressBar = document.createElement('div');
    progressBar.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        height: 2px;
        background: var(--accent-primary);
        z-index: 9999;
        transition: width 0.1s ease-out;
    `;
    document.body.appendChild(progressBar);

    window.addEventListener('scroll', () => {
        const h = document.documentElement,
            b = document.body,
            st = 'scrollTop',
            sh = 'scrollHeight';
        const percent = (h[st] || b[st]) / ((h[sh] || b[sh]) - h.clientHeight) * 100;
        progressBar.style.width = percent + '%';
    });
}
