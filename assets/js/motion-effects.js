/**
 * ULTRA MODERN MOTION EFFECTS - JavaScript
 * Interactive animations and effects
 */

document.addEventListener('DOMContentLoaded', () => {
    // ============================================
    // 1. MAGNETIC HOVER EFFECT
    // ============================================

    const magneticCards = document.querySelectorAll('.magnetic-card, .magnetic-glow');

    magneticCards.forEach(card => {
        card.addEventListener('mousemove', (e) => {
            const rect = card.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;

            const centerX = rect.width / 2;
            const centerY = rect.height / 2;

            const deltaX = (x - centerX) / centerX;
            const deltaY = (y - centerY) / centerY;

            // Magnetic pull effect (max 15px movement)
            const moveX = deltaX * 15;
            const moveY = deltaY * 15;

            card.style.transform = `translate(${moveX}px, ${moveY}px) scale(1.02)`;

            // Update glow position for magnetic-glow elements
            if (card.classList.contains('magnetic-glow')) {
                const glow = card.querySelector('::after') || card;
                card.style.setProperty('--mouse-x', `${x}px`);
                card.style.setProperty('--mouse-y', `${y}px`);
            }
        });

        card.addEventListener('mouseleave', () => {
            card.style.transform = 'translate(0, 0) scale(1)';
        });
    });

    // Enhanced magnetic glow with CSS custom properties
    const magneticGlowElements = document.querySelectorAll('.magnetic-glow');
    magneticGlowElements.forEach(el => {
        el.addEventListener('mousemove', (e) => {
            const rect = el.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;

            el.style.setProperty('--mouse-x', `${x}px`);
            el.style.setProperty('--mouse-y', `${y}px`);
        });
    });

    // ============================================
    // 2. 3D TILT EFFECT
    // ============================================

    const tiltElements = document.querySelectorAll('.tilt-3d');

    tiltElements.forEach(el => {
        el.addEventListener('mousemove', (e) => {
            const rect = el.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;

            const centerX = rect.width / 2;
            const centerY = rect.height / 2;

            const rotateX = ((y - centerY) / centerY) * -10; // Max 10deg
            const rotateY = ((x - centerX) / centerX) * 10;

            el.style.transform = `
                perspective(1000px) 
                rotateX(${rotateX}deg) 
                rotateY(${rotateY}deg) 
                scale3d(1.02, 1.02, 1.02)
            `;
        });

        el.addEventListener('mouseleave', () => {
            el.style.transform = 'perspective(1000px) rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)';
        });
    });

    // ============================================
    // 3. ENHANCED REVEAL ON SCROLL
    // ============================================

    const revealElements = document.querySelectorAll('.reveal-modern, .reveal-clip, .stagger-item');

    const revealObserver = new IntersectionObserver((entries) => {
        entries.forEach((entry, index) => {
            if (entry.isIntersecting) {
                // Add stagger delay for multiple items
                setTimeout(() => {
                    entry.target.classList.add('visible');
                    entry.target.style.animationPlayState = 'running';
                }, index * 50); // 50ms stagger

                revealObserver.unobserve(entry.target);
            }
        });
    }, {
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px'
    });

    revealElements.forEach(el => {
        el.style.animationPlayState = 'paused';
        revealObserver.observe(el);
    });

    // ============================================
    // 4. PARALLAX SCROLL EFFECT
    // ============================================

    const parallaxElements = document.querySelectorAll('.parallax-float, .ambient-morph');

    let ticking = false;

    const updateParallax = () => {
        const scrolled = window.pageYOffset;

        parallaxElements.forEach((el, index) => {
            const speed = el.dataset.speed || 0.5;
            const direction = index % 2 === 0 ? 1 : -1;
            const yPos = -(scrolled * speed * direction * 0.3);

            el.style.transform = `translateY(${yPos}px)`;
        });

        ticking = false;
    };

    window.addEventListener('scroll', () => {
        if (!ticking) {
            window.requestAnimationFrame(updateParallax);
            ticking = true;
        }
    }, { passive: true });

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

            // Skip if external link or same page
            if (!href || href.startsWith('#')) return;

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
        console.log('Reduced motion mode enabled');
    }

    // GPU acceleration hints for animated elements
    const animatedElements = document.querySelectorAll('.magnetic-card, .tilt-3d, .parallax-float');
    animatedElements.forEach(el => {
        el.classList.add('gpu-accelerated');
    });

    // ============================================
    // 9. CURSOR TRAIL EFFECT (Optional)
    // ============================================

    if (!prefersReducedMotion && window.innerWidth > 768) {
        const cursorTrail = [];
        const trailLength = 20;

        // Create trail elements
        for (let i = 0; i < trailLength; i++) {
            const trail = document.createElement('div');
            trail.className = 'cursor-trail';
            trail.style.cssText = `
                position: fixed;
                width: ${20 - i}px;
                height: ${20 - i}px;
                border-radius: 50%;
                background: radial-gradient(circle, rgba(43, 155, 155, ${0.3 - i * 0.015}), transparent);
                pointer-events: none;
                z-index: 9999;
                transition: transform 0.1s ease-out;
            `;
            document.body.appendChild(trail);
            cursorTrail.push({ el: trail, x: 0, y: 0 });
        }

        let mouseX = 0, mouseY = 0;

        document.addEventListener('mousemove', (e) => {
            mouseX = e.clientX;
            mouseY = e.clientY;
        });

        const animateTrail = () => {
            let x = mouseX;
            let y = mouseY;

            cursorTrail.forEach((trail, index) => {
                trail.el.style.left = `${x - trail.el.offsetWidth / 2}px`;
                trail.el.style.top = `${y - trail.el.offsetHeight / 2}px`;

                const nextTrail = cursorTrail[index + 1] || cursorTrail[0];
                x += (nextTrail.x - x) * 0.3;
                y += (nextTrail.y - y) * 0.3;

                trail.x = x;
                trail.y = y;
            });

            requestAnimationFrame(animateTrail);
        };

        animateTrail();
    }

    console.log('✨ Ultra Modern Motion Effects initialized');
});
