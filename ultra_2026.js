/**
 * ULTRA 2026 INTERACTION SCRIPT
 * -----------------------------
 * Focus: Performance, Smoothness, and "Luminous" Interactions.
 * 
 * Rules:
 * 1. Intersection Observer for scroll-triggered entrances.
 * 2. Mouse move events throttled for the ambient background subtle parallax.
 * 3. Minimal DOM manipulation.
 */

document.addEventListener('DOMContentLoaded', () => {
    initScrollRevelations();
    initAmbientFollow();
    initVoidParticles();
    initSpotlightEffect();
    initVideoScroll();
    initSloganLab();
});

/**
 * SLOGAN LOGIC (Quantum Decrypt)
 * Handles the 'shuffling' text effect for the main slogan.
 */
function initSloganLab() {
    const decryptEl = document.querySelector('.effect-decrypt');
    if (!decryptEl) return;

    const originalText = decryptEl.getAttribute('data-text');
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789/<>[]{}";
    let interval;
    
    function startDecrypt() {
        let iteration = 0;
        clearInterval(interval);
        
        interval = setInterval(() => {
            decryptEl.innerText = originalText
                .split("")
                .map((letter, index) => {
                    if(index < iteration) return originalText[index];
                    return chars[Math.floor(Math.random() * chars.length)];
                })
                .join("");
            
            if(iteration >= originalText.length) clearInterval(interval);
            iteration += 1/3;
        }, 30);
    }
    
    startDecrypt();
    setInterval(startDecrypt, 8000); // Shuffle every 8 seconds for a premium feel
}


/**
 * SPOTLIGHT EFFECT
 * Tracks mouse position over glass panels to create a flashlight effect on borders and background.
 */
function initSpotlightEffect() {
    const panels = document.querySelectorAll('.glass-panel');

    panels.forEach(panel => {
        // Create the spotlight overlay element if it doesn't exist
        if (!panel.querySelector('.spotlight-overlay')) {
            const overlay = document.createElement('div');
            overlay.classList.add('spotlight-overlay');
            panel.appendChild(overlay);
        }

        panel.addEventListener('mousemove', (e) => {
            const rect = panel.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;

            // Set CSS variables for the gradient position
            panel.style.setProperty('--mouse-x', `${x}px`);
            panel.style.setProperty('--mouse-y', `${y}px`);
        });
    });
}

/**
 * VIDEO SCROLL EXPANSION
 * Expands the cinematic video container from 90% to 100% width as it scrolls into view.
 */
function initVideoScroll() {
    const videoSection = document.querySelector('.cinema-container');
    if (!videoSection) return;

    window.addEventListener('scroll', () => {
        const rect = videoSection.getBoundingClientRect();
        const windowHeight = window.innerHeight;
        
        // Calculate how far the element is from the center of the viewport
        // Range: 0 (center) to 1 (edge)
        const distanceToCenter = rect.top + rect.height / 2 - windowHeight / 2;
        const normalize = Math.max(0, 1 - Math.abs(distanceToCenter) / (windowHeight / 1.5));

        // Scale from 0.9 to 1.0 based on scroll position
        const scale = 0.9 + (normalize * 0.1);
        
        // Clamp scale between 0.9 and 1.0
        const finalScale = Math.min(Math.max(scale, 0.9), 1.0);
        
        videoSection.style.transform = `scale(${finalScale})`;
        
        // Optional: Adjust Border Radius (40px -> 20px)
        const borderRadius = 40 - (normalize * 20);
        videoSection.style.borderRadius = `${borderRadius}px`;
    });
}

/**
 * Handles the "Reveal on Scroll" logic using IntersectionObserver.
 * Elements drift up and fade in when they enter the viewport.
 */
function initScrollRevelations() {
    const observerOptions = {
        root: null,
        rootMargin: '0px',
        threshold: 0.15 // Trigger when 15% of the element is visible
    };

    const observer = new IntersectionObserver((entries, observer) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('is-visible');
                observer.unobserve(entry.target); // Only animate once
            }
        });
    }, observerOptions);

    // Select elements to reveal
    const revealElements = document.querySelectorAll('.reveal-on-scroll, .glass-panel, .ultra-section-header');

    revealElements.forEach((el, index) => {
        // Add a base style for the animation start state via JS to keep CSS clean if JS fails
        // el.classList.add('reveal-on-scroll'); // Ensure class exists if not present
        
        observer.observe(el);
    });

    // Add specific class for the "is-visible" state
    const style = document.createElement('style');
    style.innerHTML = `
        .is-visible {
            opacity: 1 !important;
            transform: translateY(0) !important;
        }
    `;
    document.head.appendChild(style);
}

/**
 * Creates a subtle "Ambient Follow" effect for the background glow.
 * It moves multiple orbs slightly opposite to the mouse to create depth.
 */
function initAmbientFollow() {
    const orbs = document.querySelectorAll('.glow-orb');
    if (orbs.length === 0) return;

    let mouseX = 0;
    let mouseY = 0;

    // Store current positions for each orb
    // We'll use a weak map or just attach to element for simplicity in this specific context
    const orbState = Array.from(orbs).map(() => ({ x: 0, y: 0 }));

    // Throttle mouse move
    document.addEventListener('mousemove', (e) => {
        mouseX = e.clientX;
        mouseY = e.clientY;
    });

    // Smooth animation loop
    function animate() {
        // Ease the movement
        const ease = 0.05;

        // Calculate distance from center (0 to 1)
        const xPercent = (mouseX / window.innerWidth) - 0.5;
        const yPercent = (mouseY / window.innerHeight) - 0.5;

        orbs.forEach((orb, index) => {
            // Different movement factors for depth perception
            // Index 0: -50 (Close/Fast)
            // Index 1: -30 (Mid)
            // Index 2: -80 (Deep/Fast)
            const factors = [-50, -30, -80];
            const factor = factors[index % factors.length];

            const targetX = xPercent * factor;
            const targetY = yPercent * factor;

            orbState[index].x += (targetX - orbState[index].x) * ease;
            orbState[index].y += (targetY - orbState[index].y) * ease;

            orb.style.transform = `translate(${orbState[index].x}px, ${orbState[index].y}px)`;
        });

        requestAnimationFrame(animate);
    }

    animate();
}

/**
 * ULTRA 2026 VOID PARTICLES
 * -------------------------
 * Renders a deep field of floating particles on Canvas.
 * Optimized for performance (requestAnimationFrame + offscreen rendering concepts).
 */
function initVoidParticles() {
    const canvas = document.getElementById('void-canvas');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    let width, height;
    let particles = [];

    // Configuration
    const particleCount = 120; // Enough for detail, low enough for perf
    const connectionDistance = 100;

    // Mouse state for parallax
    let mouse = { x: 0, y: 0 };
    let targetMouse = { x: 0, y: 0 };

    function resize() {
        width = window.innerWidth;
        height = window.innerHeight;
        canvas.width = width;
        canvas.height = height;
    }

    window.addEventListener('resize', resize);
    resize();

    // Mouse tracking
    document.addEventListener('mousemove', (e) => {
        targetMouse.x = e.clientX;
        targetMouse.y = e.clientY;
    });

    // Particle Class
    class Particle {
        constructor() {
            this.x = Math.random() * width;
            this.y = Math.random() * height;
            this.vx = (Math.random() - 0.5) * 0.2; // Slow drift X
            this.vy = (Math.random() - 0.5) * 0.2; // Slow drift Y
            this.size = Math.random() * 1.5 + 0.5; // vary size
            this.alpha = Math.random() * 0.5 + 0.1; // vary opacity
            this.depth = Math.random() * 0.5 + 0.5; // Depth factor (0.5 to 1.0)
        }

        update() {
            // Mouse parallax influence based on depth (closer = moves more)
            // We smooth the mouse movement separately, here we just use the smoothed value
            const parallaxX = (mouse.x - width / 2) * 0.02 * this.depth;
            const parallaxY = (mouse.y - height / 2) * 0.02 * this.depth;

            // Update position
            this.x += this.vx;
            this.y += this.vy;

            // Wrap around screen
            if (this.x < 0) this.x = width;
            if (this.x > width) this.x = 0;
            if (this.y < 0) this.y = height;
            if (this.y > height) this.y = 0;
        }

        draw() {
            // Apply Parallax offset during draw only (keeps logic clean)
            // 'mouse' is the smoothed mouse position
            const offsetX = (mouse.x - width / 2) * 0.05 * this.depth;
            const offsetY = (mouse.y - height / 2) * 0.05 * this.depth;

            ctx.beginPath();
            ctx.arc(this.x + offsetX, this.y + offsetY, this.size, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(255, 255, 255, ${this.alpha})`;
            ctx.fill();
        }
    }

    // Init Particles
    for (let i = 0; i < particleCount; i++) {
        particles.push(new Particle());
    }

    // Animation Loop
    function animate() {
        ctx.clearRect(0, 0, width, height);

        // Smooth mouse
        mouse.x += (targetMouse.x - mouse.x) * 0.05;
        mouse.y += (targetMouse.y - mouse.y) * 0.05;

        // Draw and Update
        particles.forEach(p => {
            p.update();
            p.draw();
        });

        // Optional: Connect nearby particles (Constellation effect)
        // Only connect if really close to keep "Void" feel and not "Net"
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
        ctx.lineWidth = 0.5;

        // Simple O(N^2) checks are fine for < 150 particles
        for (let i = 0; i < particles.length; i++) {
            for (let j = i + 1; j < particles.length; j++) {
                const p1 = particles[i];
                const p2 = particles[j];

                // Effective positions including parallax
                const p1x = p1.x + ((mouse.x - width / 2) * 0.05 * p1.depth);
                const p1y = p1.y + ((mouse.y - height / 2) * 0.05 * p1.depth);
                const p2x = p2.x + ((mouse.x - width / 2) * 0.05 * p2.depth);
                const p2y = p2.y + ((mouse.y - height / 2) * 0.05 * p2.depth);

                const dx = p1x - p2x;
                const dy = p1y - p2y;
                const dist = Math.sqrt(dx * dx + dy * dy);

                if (dist < connectionDistance) {
                    ctx.beginPath();
                    // Fade line based on distance
                    const alpha = 1 - (dist / connectionDistance);
                    ctx.strokeStyle = `rgba(255, 255, 255, ${alpha * 0.15})`;
                    ctx.moveTo(p1x, p1y);
                    ctx.lineTo(p2x, p2y);
                    ctx.stroke();
                }
            }
        }

        requestAnimationFrame(animate);
    }

    animate();
}
