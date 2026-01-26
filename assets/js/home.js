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

    /* --- COUNTER ANIMATION (STATS) --- */
    const statNumbers = document.querySelectorAll('.stat-number, .proof-number');

    const animateValue = (obj, start, end, duration, suffix = '') => {
        let startTimestamp = null;
        const step = (timestamp) => {
            if (!startTimestamp) startTimestamp = timestamp;
            const progress = Math.min((timestamp - startTimestamp) / duration, 1);
            
            // Easing function: easeOutQuart
            const easeProgress = 1 - Math.pow(1 - progress, 4);
            
            // Handle float vs int
            let current;
            if (end % 1 !== 0) {
                 current = (easeProgress * (end - start) + start).toFixed(1);
            } else {
                 current = Math.floor(easeProgress * (end - start) + start);
            }
            
            obj.innerHTML = current + suffix;
            if (progress < 1) {
                window.requestAnimationFrame(step);
            }
        };
        window.requestAnimationFrame(step);
    };

    const statObserver = new IntersectionObserver((entries, observer) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const el = entry.target;
                const rawText = el.innerText;
                
                // Parse number and suffix (e.g., "5M" -> 5, "M"; "6x" -> 6, "x")
                const match = rawText.match(/([\d\.]+)(.*)/);
                
                if (match) {
                    const value = parseFloat(match[1]);
                    const suffix = match[2];
                    
                    // Don't animate if already animated or invalid
                    if (!isNaN(value)) {
                        animateValue(el, 0, value, 2000, suffix);
                    }
                }
                
                observer.unobserve(el);
            }
        });
    }, { threshold: 0.5 });

    statNumbers.forEach(el => statObserver.observe(el));

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

    /* --- BACK TO TOP LOGIC --- */
    const backToTop = document.getElementById('backToTop');
    if (backToTop) {
        window.addEventListener('scroll', () => {
            if (window.scrollY > 400) {
                backToTop.classList.add('visible');
            } else {
                backToTop.classList.remove('visible');
            }
        }, { passive: true });

        backToTop.addEventListener('click', () => {
            window.scrollTo({ top: 0, behavior: 'smooth' });
        });
    }

    /* --- ULTRA 2026 INTERACTION LOGIC (CUSTOM CURSOR) --- */
    const cursorDot = document.querySelector('[data-cursor-dot]');
    const cursorOutline = document.querySelector('[data-cursor-outline]');
    
    // Only activate on non-touch devices
    if (window.matchMedia("(hover: hover) and (pointer: fine)").matches) {
        if (cursorDot && cursorOutline) {
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

            });

            // Hover States
            document.querySelectorAll('a, button').forEach(el => {
                el.addEventListener('mouseenter', () => document.body.classList.add('hovering'));
                el.addEventListener('mouseleave', () => document.body.classList.remove('hovering'));
            });
        }
    }

    /* --- STORY SECTION: SCRUB TEXT & GHOST METRICS --- */
    const scrubTexts = document.querySelectorAll('.scrub-text');
    const ghostMetrics = document.querySelectorAll('.ghost-metric');
    
    // 1. Text Scrubbing (Illumination)
    const scrubObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('in-view');
            } else {
                entry.target.classList.remove('in-view');
            }
        });
    }, { threshold: 0.5 });

    scrubTexts.forEach(text => scrubObserver.observe(text));

    window.addEventListener('scroll', () => {
        const scrollY = window.scrollY;
        const vh = window.innerHeight;

        scrubTexts.forEach(text => {
            const rect = text.getBoundingClientRect();
            const centerPoint = rect.top + rect.height / 2;
            
            // If the text is near the center of the viewport, illuminate it
            if (centerPoint > vh * 0.3 && centerPoint < vh * 0.7) {
                text.classList.add('active');
            } else {
                text.classList.remove('active');
            }
        });

        // 2. Ghost Metrics Parallax
        ghostMetrics.forEach(metric => {
            const speed = parseFloat(metric.getAttribute('data-speed')) || 0.1;
            const yOffset = (scrollY * speed);
            metric.style.transform = `translateY(${yOffset}px)`;
        });
    });


    /* --- DRAGGABLE INFINITE MARQUEE (PHYSICS BASED - ULTRA SMOOTH) --- */
    const marqueeContainers = document.querySelectorAll('.marquee-container');

    marqueeContainers.forEach(container => {
        const track = container.querySelector('.marquee-track');
        if (!track) return;

        // State
        let currentPos = 0;
        let isDragging = false;
        let startX = 0;
        let lastX = 0;
        let dragOffset = 0;
        
        // Read speed from data attribute, fallback to default
        const baseSpeed = parseFloat(container.getAttribute('data-speed')) || -1.0;
        let speed = baseSpeed; 
        
        let velocity = 0;
        const friction = 0.96;
        let rafId;

        // Calculate Widths
        const getHalfWidth = () => {
            return track.getBoundingClientRect().width / 2;
        };
        let halfWidth = getHalfWidth();

        window.addEventListener('resize', () => {
            halfWidth = getHalfWidth();
        });

        // Animation Loop
        const animate = () => {
            if (!isDragging) {
                const targetSpeed = baseSpeed;
                speed += (targetSpeed - speed) * 0.05;
                currentPos += speed;
            }

            // Infinite Loop Logic
            if (currentPos <= -halfWidth) {
                currentPos += halfWidth;
                dragOffset += halfWidth; 
            } else if (currentPos > 0) {
                currentPos -= halfWidth;
                dragOffset -= halfWidth;
            }

            track.style.transform = `translateX(${currentPos}px)`;
            rafId = requestAnimationFrame(animate);
        };

        rafId = requestAnimationFrame(animate);

        // Interaction
        const handleStart = (x) => {
            isDragging = true;
            startX = x;
            lastX = x;
            dragOffset = currentPos;
            velocity = 0;
            container.style.cursor = 'grabbing';
        };

        const handleMove = (x) => {
            if (!isDragging) return;
            const diff = x - startX;
            currentPos = dragOffset + diff;
            velocity = x - lastX;
            lastX = x;
        };

        const handleEnd = () => {
            if (!isDragging) return;
            isDragging = false;
            container.style.cursor = 'grab';
            speed = velocity;
            if (speed > 25) speed = 25;
            if (speed < -25) speed = -25;
        };

        container.addEventListener('mousedown', (e) => {
            e.preventDefault();
            handleStart(e.pageX);
        });
        window.addEventListener('mousemove', (e) => handleMove(e.pageX));
        window.addEventListener('mouseup', handleEnd);

        container.addEventListener('touchstart', (e) => {
            handleStart(e.touches[0].pageX);
        }, { passive: true });
        window.addEventListener('touchmove', (e) => {
            handleMove(e.touches[0].pageX);
        }, { passive: true });
        window.addEventListener('touchend', handleEnd);
    });
});
