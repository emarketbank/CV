/**
 * PREMIUM HEADER - JavaScript
 * Interactive header with navigation and mobile menu
 */

document.addEventListener('DOMContentLoaded', () => {
    // ============================================
    // 1. STICKY HEADER ON SCROLL
    // ============================================

    const header = document.querySelector('.site-header');
    let lastScroll = 0;
    let ticking = false;

    const updateHeader = () => {
        const currentScroll = window.pageYOffset;

        if (currentScroll > 50) {
            header?.classList.add('scrolled');
        } else {
            header?.classList.remove('scrolled');
        }

        lastScroll = currentScroll;
        ticking = false;
    };

    window.addEventListener('scroll', () => {
        if (!ticking) {
            window.requestAnimationFrame(updateHeader);
            ticking = true;
        }
    }, { passive: true });

    // ============================================
    // 2. ACTIVE LINK DETECTION
    // ============================================

    const navLinks = document.querySelectorAll('.nav-link');
    const currentPath = window.location.pathname;

    navLinks.forEach(link => {
        const linkPath = new URL(link.href).pathname;

        // Check if current page matches link
        if (currentPath === linkPath ||
            (currentPath.includes(linkPath) && linkPath !== '/')) {
            link.classList.add('active');
        }

        // Update indicator position
        if (link.classList.contains('active')) {
            updateIndicator(link);
        }
    });

    // ============================================
    // 3. ANIMATED INDICATOR
    // ============================================

    const indicator = document.querySelector('.nav-indicator');

    function updateIndicator(activeLink) {
        if (!indicator || !activeLink) return;

        const linkRect = activeLink.getBoundingClientRect();
        const navRect = activeLink.closest('.header-nav').getBoundingClientRect();

        const left = linkRect.left - navRect.left;
        const width = linkRect.width;

        indicator.style.left = `${left}px`;
        indicator.style.width = `${width}px`;
    }

    // Update indicator on hover
    navLinks.forEach(link => {
        link.addEventListener('mouseenter', () => {
            updateIndicator(link);
        });
    });

    // Reset to active link on mouse leave
    const headerNav = document.querySelector('.header-nav');
    headerNav?.addEventListener('mouseleave', () => {
        const activeLink = document.querySelector('.nav-link.active');
        updateIndicator(activeLink);
    });

    // ============================================
    // 4. MOBILE MENU TOGGLE
    // ============================================

    const mobileToggle = document.querySelector('.mobile-menu-toggle');
    const mobileNav = document.querySelector('.header-nav');
    let mobileOverlay = document.querySelector('.mobile-overlay');

    // Create overlay if it doesn't exist
    if (!mobileOverlay && mobileToggle) {
        mobileOverlay = document.createElement('div');
        mobileOverlay.className = 'mobile-overlay';
        document.body.appendChild(mobileOverlay);
    }

    const toggleMobileMenu = () => {
        mobileToggle?.classList.toggle('active');
        mobileNav?.classList.toggle('mobile-open');
        mobileOverlay?.classList.toggle('active');
        document.body.style.overflow = mobileNav?.classList.contains('mobile-open') ? 'hidden' : '';
    };

    mobileToggle?.addEventListener('click', toggleMobileMenu);
    mobileOverlay?.addEventListener('click', toggleMobileMenu);

    // Close mobile menu on link click
    navLinks.forEach(link => {
        link.addEventListener('click', () => {
            if (window.innerWidth <= 768) {
                toggleMobileMenu();
            }
        });
    });

    // Close mobile menu on escape key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && mobileNav?.classList.contains('mobile-open')) {
            toggleMobileMenu();
        }
    });

    // ============================================
    // 5. SMOOTH SCROLL TO SECTIONS
    // ============================================

    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            const href = link.getAttribute('href');

            // Only smooth scroll for same-page anchors
            if (href && href.startsWith('#')) {
                e.preventDefault();
                const target = document.querySelector(href);

                if (target) {
                    const headerHeight = header?.offsetHeight || 80;
                    const targetPosition = target.offsetTop - headerHeight - 20;

                    window.scrollTo({
                        top: targetPosition,
                        behavior: 'smooth'
                    });
                }
            }
        });
    });

    // ============================================
    // 6. RESIZE HANDLER
    // ============================================

    let resizeTimeout;
    window.addEventListener('resize', () => {
        clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(() => {
            // Close mobile menu if window is resized to desktop
            if (window.innerWidth > 768 && mobileNav?.classList.contains('mobile-open')) {
                toggleMobileMenu();
            }

            // Update indicator position
            const activeLink = document.querySelector('.nav-link.active');
            updateIndicator(activeLink);
        }, 250);
    });

    // ============================================
    // 7. MAGNETIC HOVER EFFECT (Optional)
    // ============================================

    if (window.innerWidth > 768) {
        navLinks.forEach(link => {
            link.addEventListener('mousemove', (e) => {
                const rect = link.getBoundingClientRect();
                const x = e.clientX - rect.left;
                const y = e.clientY - rect.top;

                const centerX = rect.width / 2;
                const centerY = rect.height / 2;

                const deltaX = (x - centerX) / centerX;
                const deltaY = (y - centerY) / centerY;

                // Subtle magnetic pull (max 3px)
                const moveX = deltaX * 3;
                const moveY = deltaY * 3;

                link.style.transform = `translate(${moveX}px, ${moveY}px)`;
            });

            link.addEventListener('mouseleave', () => {
                link.style.transform = 'translate(0, 0)';
            });
        });
    }

    console.log('✨ Premium Header initialized');
});
