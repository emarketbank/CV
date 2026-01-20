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

    const galleryItems = Array.from(document.querySelectorAll('.gallery-item'));
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (!prefersReducedMotion && 'IntersectionObserver' in window) {
        const revealObserver = new IntersectionObserver((entries, observer) => {
            entries.forEach((entry, index) => {
                if (entry.isIntersecting) {
                    const delay = Math.min(index * 40, 200);
                    setTimeout(() => {
                        entry.target.classList.add('visible');
                        observer.unobserve(entry.target);
                    }, delay);
                }
            });
        }, { root: null, rootMargin: '0px', threshold: 0.1 });

        galleryItems.forEach(el => revealObserver.observe(el));
    } else {
        galleryItems.forEach(el => el.classList.add('visible'));
    }

    const lightbox = document.getElementById('lightbox');
    const lightboxImg = document.getElementById('lightboxImg');
    const lightboxClose = document.querySelector('.lightbox-close');
    const lightboxPrev = document.querySelector('.lightbox-prev');
    const lightboxNext = document.querySelector('.lightbox-next');
    const images = galleryItems
        .map(item => item.querySelector('img'))
        .filter(Boolean);
    let currentImageIndex = 0;

    const openLightbox = (index) => {
        if (!lightbox || !lightboxImg || !images.length) {
            return;
        }

        currentImageIndex = index;
        lightboxImg.src = images[currentImageIndex].src;
        lightbox.classList.add('active');
        lightbox.setAttribute('aria-hidden', 'false');
        document.body.style.overflow = 'hidden';
    };

    const closeLightbox = () => {
        if (!lightbox) {
            return;
        }

        lightbox.classList.remove('active');
        lightbox.setAttribute('aria-hidden', 'true');
        document.body.style.overflow = '';
    };

    const navLightbox = (direction) => {
        if (!images.length || !lightboxImg) {
            return;
        }

        currentImageIndex += direction;
        if (currentImageIndex < 0) {
            currentImageIndex = images.length - 1;
        }
        if (currentImageIndex >= images.length) {
            currentImageIndex = 0;
        }
        lightboxImg.src = images[currentImageIndex].src;
    };

    galleryItems.forEach((item, index) => {
        item.addEventListener('click', () => openLightbox(index));
    });

    lightboxClose?.addEventListener('click', closeLightbox);
    lightboxPrev?.addEventListener('click', () => navLightbox(-1));
    lightboxNext?.addEventListener('click', () => navLightbox(1));

    lightbox?.addEventListener('click', (e) => {
        if (e.target === lightbox) {
            closeLightbox();
        }
    });

    document.addEventListener('keydown', (e) => {
        if (!lightbox?.classList.contains('active')) {
            return;
        }

        if (e.key === 'Escape') {
            closeLightbox();
        }
        if (e.key === 'ArrowRight') {
            navLightbox(1);
        }
        if (e.key === 'ArrowLeft') {
            navLightbox(-1);
        }
    });

    const contactModal = document.getElementById('contactModal');
    const contactFab = document.querySelector('.contact-fab');
    const modalClose = document.querySelector('.modal-close');

    const showContactModal = () => {
        if (!contactModal) {
            return;
        }

        contactModal.classList.add('show');
        contactModal.setAttribute('aria-hidden', 'false');
        document.body.style.overflow = 'hidden';
    };

    const hideContactModal = () => {
        if (!contactModal) {
            return;
        }

        contactModal.classList.remove('show');
        contactModal.setAttribute('aria-hidden', 'true');
        document.body.style.overflow = '';
    };

    contactFab?.addEventListener('click', showContactModal);
    modalClose?.addEventListener('click', hideContactModal);

    contactModal?.addEventListener('click', (e) => {
        if (e.target === contactModal) {
            hideContactModal();
        }
    });

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && contactModal?.classList.contains('show')) {
            hideContactModal();
        }
    });

    // ========== TAB SWITCHING ==========
    const tabBtns = document.querySelectorAll('.tab-btn');
    const gallerySection = document.querySelector('.gallery-section');
    const reelsSection = document.getElementById('reelsSection');

    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            // Update active tab
            tabBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            const tab = btn.dataset.tab;

            if (tab === 'images') {
                if (gallerySection) gallerySection.style.display = 'block';
                if (reelsSection) reelsSection.style.display = 'none';
                // Pause all videos
                pauseAllVideos();
            } else if (tab === 'videos') {
                if (gallerySection) gallerySection.style.display = 'none';
                if (reelsSection) reelsSection.style.display = 'block';
            }
        });
    });

    // ========== VIDEO REELS FUNCTIONALITY ==========
    const reelItems = document.querySelectorAll('.reel-item');
    const reelsScroll = document.getElementById('reelsScroll');
    let currentlyPlaying = null;

    // Pause all videos helper
    const pauseAllVideos = () => {
        reelItems.forEach(item => {
            const video = item.querySelector('video');
            if (video) {
                video.pause();
                item.classList.remove('playing');
            }
        });
        currentlyPlaying = null;
    };

    // Play/Pause on tap
    reelItems.forEach(item => {
        const video = item.querySelector('video');
        const playBtn = item.querySelector('.reel-play-btn');

        const togglePlay = () => {
            if (!video) return;

            if (video.paused) {
                // Pause any other playing video first
                pauseAllVideos();
                video.muted = false;
                video.play().catch(() => {
                    // Autoplay blocked, keep muted
                    video.muted = true;
                    video.play();
                });
                item.classList.add('playing');
                currentlyPlaying = video;
            } else {
                video.pause();
                item.classList.remove('playing');
                currentlyPlaying = null;
            }
        };

        playBtn?.addEventListener('click', togglePlay);
        video?.addEventListener('click', togglePlay);
    });

    // Auto-pause on scroll (play visible video)
    if (reelsScroll && 'IntersectionObserver' in window) {
        const reelObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                const video = entry.target.querySelector('video');
                if (!video) return;

                if (!entry.isIntersecting) {
                    video.pause();
                    entry.target.classList.remove('playing');
                    if (currentlyPlaying === video) {
                        currentlyPlaying = null;
                    }
                }
            });
        }, { 
            root: reelsScroll, 
            threshold: 0.5 
        });

        reelItems.forEach(item => reelObserver.observe(item));
    }

    // Hide scroll indicator after first scroll
    const scrollIndicator = document.querySelector('.scroll-indicator');
    if (reelsScroll && scrollIndicator) {
        reelsScroll.addEventListener('scroll', () => {
            scrollIndicator.style.opacity = '0';
            scrollIndicator.style.pointerEvents = 'none';
        }, { once: true });
    }
});

