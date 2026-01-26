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
    const lightboxPrev = lightbox?.querySelector('.lightbox-prev');
    const lightboxNext = lightbox?.querySelector('.lightbox-next');
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

    // ========== VIDEO GALLERY FUNCTIONALITY ==========
    const videoLightbox = document.getElementById('videoLightbox');
    const lightboxVideo = document.getElementById('lightboxVideo');
    const videoLightboxTitle = document.getElementById('videoLightboxTitle');
    const videoLightboxDesc = document.getElementById('videoLightboxDesc');
    const videoClose = videoLightbox?.querySelector('.lightbox-close');
    const videoPrev = videoLightbox?.querySelector('.video-nav-prev');
    const videoNext = videoLightbox?.querySelector('.video-nav-next');

    const videoItems = Array.from(document.querySelectorAll('.video-item'));
    let currentVideoIndex = 0;

    const openVideoLightbox = (index) => {
        if (!videoLightbox || !lightboxVideo || !videoItems[index]) return;

        currentVideoIndex = index;
        const targetItem = videoItems[currentVideoIndex];
        const sourceVideo = targetItem.querySelector('video');
        const title = targetItem.querySelector('h4').textContent;
        const desc = targetItem.querySelector('span').textContent;

        lightboxVideo.src = sourceVideo.src;
        videoLightboxTitle.textContent = title;
        videoLightboxDesc.textContent = desc;

        videoLightbox.setAttribute('aria-hidden', 'false');
        document.body.style.overflow = 'hidden';

        // Auto play
        lightboxVideo.play().catch(() => {});
    };

    const closeVideoLightbox = () => {
        if (!videoLightbox || !lightboxVideo) return;

        videoLightbox.setAttribute('aria-hidden', 'true');
        document.body.style.overflow = '';

        lightboxVideo.pause();
        lightboxVideo.currentTime = 0;
        lightboxVideo.src = ''; // Clear source to stop buffering
    };

    const navVideo = (direction) => {
        if (!videoItems.length) return;

        currentVideoIndex += direction;
        if (currentVideoIndex < 0) currentVideoIndex = videoItems.length - 1;
        if (currentVideoIndex >= videoItems.length) currentVideoIndex = 0;

        const targetItem = videoItems[currentVideoIndex];
        const sourceVideo = targetItem.querySelector('video');
        const title = targetItem.querySelector('h4').textContent;
        const desc = targetItem.querySelector('span').textContent;

        // Smooth switch
        lightboxVideo.src = sourceVideo.src;
        videoLightboxTitle.textContent = title;
        videoLightboxDesc.textContent = desc;
        lightboxVideo.play().catch(() => {});
    };

    // Event Listeners
    videoItems.forEach((item, index) => {
        item.addEventListener('click', () => openVideoLightbox(index));
    });

    videoClose?.addEventListener('click', closeVideoLightbox);
    videoPrev?.addEventListener('click', (e) => {
        e.stopPropagation();
        navVideo(-1);
    });
    videoNext?.addEventListener('click', (e) => {
        e.stopPropagation();
        navVideo(1);
    });

    // Close on background click
    videoLightbox?.addEventListener('click', (e) => {
        if (e.target === videoLightbox) closeVideoLightbox();
    });

    // Keyboard Navigation for Video
    document.addEventListener('keydown', (e) => {
        if (videoLightbox?.getAttribute('aria-hidden') === 'false') {
            if (e.key === 'Escape') closeVideoLightbox();
            if (e.key === 'ArrowRight') navVideo(1);
            if (e.key === 'ArrowLeft') navVideo(-1);
        }
    });

    // Update Tab Switching Logic
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
                closeVideoLightbox(); // Ensure video is closed/paused
            } else if (tab === 'videos') {
                if (gallerySection) gallerySection.style.display = 'none';
                if (reelsSection) reelsSection.style.display = 'block';
            }
        });
    });
});
