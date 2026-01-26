/**
 * ULTRA MODERN MOTION EFFECTS - JavaScript
 * Interactive animations and effects
 */

document.addEventListener('DOMContentLoaded', () => {
    // ============================================
    // 3. ENHANCED REVEAL ON SCROLL (BIO-FLOW)
    // ============================================

    const revealElements = document.querySelectorAll('.reveal, .stagger-item');

    const revealObserver = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
            if (entry.isIntersecting) {
                entry.target.classList.add('visible');
                
                // Bio-Flow: Add slight float-up based on scroll speed
                const rect = entry.target.getBoundingClientRect();
                const intensity = Math.min(Math.abs(window.scrollY - entry.target.offsetTop) / 1000, 1);
                entry.target.style.setProperty('--bio-intensity', intensity);
                
                revealObserver.unobserve(entry.target);
            }
        });
    }, {
        threshold: 0.15,
        rootMargin: '0px 0px -100px 0px'
    });

    revealElements.forEach(el => {
        el.style.animationPlayState = 'paused';
        revealObserver.observe(el);
    });

    // Parallax Scroll Removed for Static Ground

    // ============================================
    // 5. TEXT REVEAL ANIMATION
    // ============================================

    const splitTextElements = document.querySelectorAll('[data-text-reveal]');

    splitTextElements.forEach(el => {
        const text = el.textContent;
        el.textContent = '';

        // Split text into characters
        text.split('').forEach((char, index) => {
            const span = document.createElement('span');
            span.textContent = char === ' ' ? '\u00A0' : char;
            span.classList.add('text-reveal');
            span.style.animationDelay = `${index * 0.05}s`;
            el.appendChild(span);
        });
    });

    // ============================================
    // 6. SMOOTH PAGE TRANSITIONS
    // ============================================

    // Add page transition class on load
    document.body.classList.add('page-transition');

    // Handle navigation clicks for smooth transitions
    const navLinks = document.querySelectorAll('a[href^="/"]');

    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            const href = link.getAttribute('href');

            // Skip if external link, same page, or user intends new tab/window
            if (!href || href.startsWith('#')) return;
            if (link.target === '_blank' || link.hasAttribute('download')) return;
            if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;

            e.preventDefault();

            // Fade out
            document.body.style.opacity = '0';
            document.body.style.transform = 'translateY(-20px)';
            document.body.style.transition = 'opacity 0.3s ease, transform 0.3s ease';

            setTimeout(() => {
                window.location.href = href;
            }, 300);
        });
    });

    // ============================================
    // 7. ELASTIC BOUNCE ON CLICK
    // ============================================

    const elasticElements = document.querySelectorAll('.elastic-hover');

    elasticElements.forEach(el => {
        el.addEventListener('click', function (e) {
            this.style.animation = 'none';
            setTimeout(() => {
                this.style.animation = 'elasticBounce 0.6s cubic-bezier(0.68, -0.55, 0.265, 1.55)';
            }, 10);
        });
    });

    // ============================================
    // 8. PERFORMANCE MONITORING
    // ============================================

    // Check if user prefers reduced motion
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (prefersReducedMotion) {
        // Disable heavy animations
        document.body.classList.add('reduced-motion');
    }

});
