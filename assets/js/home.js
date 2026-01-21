document.addEventListener('DOMContentLoaded', () => {
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
});
