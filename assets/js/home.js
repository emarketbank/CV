document.addEventListener('DOMContentLoaded', () => {
    /* --- SCROLL PROGRESS & ANIMATIONS --- */
    const progressLine = document.getElementById('progressLine');
    let scrollTicking = false;

    const updateProgress = () => {
        if (!progressLine) {
            scrollTicking = false;
            return;
        }

        const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
        const scrolled = maxScroll > 0 ? (window.scrollY / maxScroll) * 100 : 0;
        progressLine.style.width = `${scrolled}%`;
        scrollTicking = false;
    };

    const handleScroll = () => {
        if (!scrollTicking) {
            scrollTicking = true;
            window.requestAnimationFrame(updateProgress);
        }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    updateProgress();

    const revealTargets = document.querySelectorAll('.reveal, .timeline-content, .skill-item, .stagger-item');
    if ('IntersectionObserver' in window) {
        const revealObserver = new IntersectionObserver((entries, observer) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('visible');
                    observer.unobserve(entry.target);
                }
            });
        }, { root: null, rootMargin: '0px', threshold: 0.15 });

        revealTargets.forEach(el => revealObserver.observe(el));
    } else {
        revealTargets.forEach(el => el.classList.add('visible'));
    }

    /* --- PARALLAX EFFECT --- */
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!prefersReducedMotion) {
        const ambients = document.querySelectorAll('.ambient');
        if (ambients.length) {
            let mouseTicking = false;
            let mouseX = 0;
            let mouseY = 0;

            const applyParallax = () => {
                const x = (mouseX / window.innerWidth - 0.5) * 15;
                const y = (mouseY / window.innerHeight - 0.5) * 15;

                ambients.forEach((amb, i) => {
                    const speed = (i + 1) * 0.3;
                    amb.style.transform = `translate(${x * speed}px, ${y * speed}px)`;
                });

                mouseTicking = false;
            };

            document.addEventListener('mousemove', (e) => {
                mouseX = e.clientX;
                mouseY = e.clientY;

                if (!mouseTicking) {
                    mouseTicking = true;
                    window.requestAnimationFrame(applyParallax);
                }
            });
        }
    }

    /* --- VIDEO LOGIC --- */
    const videoScreen = document.getElementById('videoScreen');
    const video = document.getElementById('showreelVideo');
    const overlay = document.getElementById('pauseOverlay');

    const toggleVideo = () => {
        if (!video) {
            return;
        }

        if (video.paused) {
            video.play();
            overlay?.classList.remove('show');
        } else {
            video.pause();
            overlay?.classList.add('show');
        }
    };

    if (videoScreen) {
        videoScreen.addEventListener('click', toggleVideo);
    }

    if (video && overlay) {
        video.addEventListener('play', () => overlay.classList.remove('show'));
        video.addEventListener('pause', () => overlay.classList.add('show'));
    }

    /* --- CONTACT MODAL --- */
    const contactModal = document.getElementById('contactModal');
    const contactFab = document.querySelector('.contact-fab');
    const modalClose = document.querySelector('.modal-close');

    const showContactModal = () => {
        if (!contactModal) {
            return;
        }

        contactModal.classList.add('show');
        contactModal.setAttribute('aria-hidden', 'false');
    };

    const hideContactModal = () => {
        if (!contactModal) {
            return;
        }

        contactModal.classList.remove('show');
        contactModal.setAttribute('aria-hidden', 'true');
    };

    if (contactFab) {
        contactFab.addEventListener('click', showContactModal);
    }

    if (modalClose) {
        modalClose.addEventListener('click', hideContactModal);
    }

    if (contactModal) {
        contactModal.addEventListener('click', (e) => {
            if (e.target === contactModal) {
                hideContactModal();
            }
        });
    }

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            hideContactModal();
        }
    });

    /* --- ULTRA 2026 INTERACTION LOGIC (CUSTOM CURSOR) --- */
    const cursorDot = document.querySelector('[data-cursor-dot]');
    const cursorOutline = document.querySelector('[data-cursor-outline]');
    const ambientLight = document.getElementById('ambientLight');
    
    // Only activate on non-touch devices
    if (window.matchMedia("(hover: hover) and (pointer: fine)").matches) {
        if (cursorDot && cursorOutline && ambientLight) {
            window.addEventListener('mousemove', function(e) {
                const posX = e.clientX;
                const posY = e.clientY;

                // Dot moves instantly
                cursorDot.style.left = `${posX}px`;
                cursorDot.style.top = `${posY}px`;

                // Outline moves with lag
                cursorOutline.animate({
                    left: `${posX}px`,
                    top: `${posY}px`
                }, { duration: 500, fill: "forwards" });

                // Ambient Light follows smoothly
                ambientLight.animate({
                    left: `${posX}px`,
                    top: `${posY}px`
                }, { duration: 4000, fill: "forwards" }); // Very slow drift
            });

            // Hover States
            document.querySelectorAll('a, button').forEach(el => {
                el.addEventListener('mouseenter', () => document.body.classList.add('hovering'));
                el.addEventListener('mouseleave', () => document.body.classList.remove('hovering'));
            });
        }
    }

    /* --- SPOTLIGHT EFFECT LOGIC --- */
    const spotlightCards = document.querySelectorAll('.stat-card, .future-card, .industry-card, .client-item, .hero-card, .proof-item, .edu-row');
    
    spotlightCards.forEach(card => {
        card.classList.add('spotlight-card'); // Ensure CSS class is applied
        
        card.addEventListener('mousemove', (e) => {
            const rect = card.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            
            card.style.setProperty('--mouse-x', `${x}px`);
            card.style.setProperty('--mouse-y', `${y}px`);
        });
    });

    /* --- MAGNETIC ELEMENTS LOGIC --- */
    const magneticElements = document.querySelectorAll('.magnetic-card, .btn-primary, .btn-ghost');
    
    magneticElements.forEach(el => {
        el.addEventListener('mousemove', (e) => {
            const rect = el.getBoundingClientRect();
            const x = e.clientX - rect.left - rect.width / 2;
            const y = e.clientY - rect.top - rect.height / 2;
            
            // Intensity of the pull
            const intensity = 0.2; 
            
            el.style.transform = `translate(${x * intensity}px, ${y * intensity}px)`;
        });
        
        el.addEventListener('mouseleave', () => {
            el.style.transform = 'translate(0px, 0px)';
        });
    /* --- DRAGGABLE INFINITE MARQUEE (PHYSICS BASED) --- */
    const track = document.querySelector('.marquee-track');
    const container = document.querySelector('.marquee-container');

    if (track && container) {
        let currentPos = 0;
        let isDragging = false;
        let startX = 0;
        let prevPos = 0;
        let animationId;
        
        // Configuration
        const baseSpeed = 0.5; // Auto-scroll speed
        let speed = baseSpeed;
        let velocity = 0;
        
        // Calculate the width of one set of items (half the track since we duplicated)
        // We assume the track has 2 identical sets of items
        const getHalfWidth = () => track.scrollWidth / 2;
        let halfWidth = getHalfWidth();

        // Recalculate on resize
        window.addEventListener('resize', () => {
            halfWidth = getHalfWidth();
        });

        // Main Animation Loop
        const animate = () => {
            // Apply velocity or base speed
            if (!isDragging) {
                // Decay velocity back to base speed (Inertia)
                speed += (baseSpeed - speed) * 0.05;
                currentPos -= speed;
            }

            // Infinite Loop Logic
            // If we've scrolled past the first set, reset to 0 (seamless jump)
            if (currentPos <= -halfWidth) {
                currentPos += halfWidth;
                prevPos += halfWidth; // Adjust drag reference
            } else if (currentPos > 0) {
                currentPos -= halfWidth;
                prevPos -= halfWidth;
            }

            // Apply Transform
            track.style.transform = `translateX(${currentPos}px)`;

            animationId = requestAnimationFrame(animate);
        };

        // Start Animation
        animationId = requestAnimationFrame(animate);

        // --- Drag Events (Mouse & Touch) ---

        const startDrag = (x) => {
            isDragging = true;
            startX = x;
            prevPos = currentPos;
            track.style.cursor = 'grabbing';
            // Cancel inertia smoothing temporarily
            speed = 0; 
        };

        const moveDrag = (x) => {
            if (!isDragging) return;
            const diff = x - startX;
            currentPos = prevPos + diff;
            
            // Calculate velocity for inertia
            // Simple way: track movement per frame (or rough approximation)
            // Here we just let the position update directly
        };

        const endDrag = (x) => {
            if (!isDragging) return;
            isDragging = false;
            track.style.cursor = 'grab';
            
            // Calculate throw velocity based on the last movement
            // Ideally we'd track points, but for this "feel":
            // We just let the animate loop pull 'speed' back to 'baseSpeed'
            // To add a "throw", we could calculate the diff from the last few frames.
            // For now, smooth return to base speed feels high-end.
            
            // Optional: Calculate 'speed' based on drag release to give it a "push"
            // speed = (lastDiff) * friction... (Simplification for robustness)
        };

        // Mouse Events
        container.addEventListener('mousedown', (e) => {
            e.preventDefault(); // Prevent text selection
            startDrag(e.pageX);
        });

        window.addEventListener('mousemove', (e) => {
            moveDrag(e.pageX);
        });

        window.addEventListener('mouseup', (e) => {
            endDrag(e.pageX);
        });

        // Touch Events
        container.addEventListener('touchstart', (e) => {
            startDrag(e.touches[0].pageX);
        });

        window.addEventListener('touchmove', (e) => {
            moveDrag(e.touches[0].pageX);
        });

        window.addEventListener('touchend', () => {
            endDrag(0); // x not needed for logic, just state change
        });
    }
});