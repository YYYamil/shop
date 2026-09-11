document.documentElement.classList.add('js');

document.addEventListener('DOMContentLoaded', () => {
    const year = document.getElementById('year');
    if (year) year.textContent = new Date().getFullYear();

    const header = document.querySelector('.site-header');
    const navToggle = document.getElementById('navToggle');
    const siteNav = document.getElementById('siteNav');

    const closeMenu = () => {
        if (!header || !navToggle) return;
        header.classList.remove('menu-open');
        navToggle.setAttribute('aria-expanded', 'false');
        navToggle.setAttribute('aria-label', 'Abrir menú');
    };

    navToggle?.addEventListener('click', () => {
        const isOpen = header.classList.toggle('menu-open');
        navToggle.setAttribute('aria-expanded', String(isOpen));
        navToggle.setAttribute('aria-label', isOpen ? 'Cerrar menú' : 'Abrir menú');
    });

    siteNav?.querySelectorAll('a').forEach((link) => link.addEventListener('click', closeMenu));
    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') closeMenu();
    });

    document.querySelectorAll('a[href^="#"]').forEach((anchor) => {
        anchor.addEventListener('click', (event) => {
            const targetId = anchor.getAttribute('href');
            const target = targetId ? document.querySelector(targetId) : null;
            if (!target) return;
            event.preventDefault();
            target.scrollIntoView({ behavior: 'smooth', block: 'start' });
            window.history.replaceState(null, '', targetId);
        });
    });

    document.querySelectorAll('.faq-question').forEach((button) => {
        button.addEventListener('click', () => {
            const isExpanded = button.getAttribute('aria-expanded') === 'true';
            document.querySelectorAll('.faq-question').forEach((otherButton) => {
                const answerId = otherButton.getAttribute('aria-controls');
                const answer = answerId ? document.getElementById(answerId) : null;
                otherButton.setAttribute('aria-expanded', 'false');
                if (answer) answer.hidden = true;
            });

            if (!isExpanded) {
                const answerId = button.getAttribute('aria-controls');
                const answer = answerId ? document.getElementById(answerId) : null;
                button.setAttribute('aria-expanded', 'true');
                if (answer) answer.hidden = false;
            }
        });
    });

    const heroCarousel = document.getElementById('heroCarousel');
    if (heroCarousel) {
        const slidesTrack = heroCarousel.querySelector('.hero__slides');
        const slides = Array.from(heroCarousel.querySelectorAll('.hero__image'));
        const dotsContainer = heroCarousel.querySelector('.hero__carousel-dots');
        const previousButton = heroCarousel.querySelector('[data-hero-prev]');
        const nextButton = heroCarousel.querySelector('[data-hero-next]');
        const captionTitle = document.getElementById('heroCaptionTitle');
        const captionText = document.getElementById('heroCaptionText');
        const noteTitle = document.getElementById('heroNoteTitle');
        const interval = Number(heroCarousel.dataset.interval) || 4200;
        const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
        let activeIndex = 0;
        let autoplayId = null;

        slides.forEach((slide, index) => {
            const dot = document.createElement('button');
            dot.type = 'button';
            dot.setAttribute('role', 'tab');
            dot.setAttribute('aria-label', `Ver ejemplo ${slide.dataset.title || index + 1}`);
            dot.setAttribute('aria-controls', `hero-slide-${index + 1}`);
            dot.dataset.heroDot = String(index);
            slide.id = `hero-slide-${index + 1}`;
            dotsContainer?.appendChild(dot);
        });
        const dots = Array.from(heroCarousel.querySelectorAll('[data-hero-dot]'));

        const setSlide = (nextIndex) => {
            activeIndex = (nextIndex + slides.length) % slides.length;
            const activeSlide = slides[activeIndex];
            if (activeSlide) activeSlide.loading = 'eager';
            if (slidesTrack) slidesTrack.style.transform = `translate3d(-${activeIndex * 100}%, 0, 0)`;

            slides.forEach((slide, index) => {
                slide.setAttribute('aria-hidden', String(index !== activeIndex));
            });
            dots.forEach((dot, index) => {
                const isActive = index === activeIndex;
                dot.classList.toggle('is-active', isActive);
                dot.setAttribute('aria-selected', String(isActive));
                dot.setAttribute('tabindex', isActive ? '0' : '-1');
            });
            if (captionTitle) captionTitle.textContent = activeSlide?.dataset.title || '';
            if (captionText) captionText.textContent = activeSlide?.dataset.caption || '';
            if (noteTitle) noteTitle.textContent = activeSlide?.dataset.title || '';
        };

        const scheduleAutoplay = () => {
            if (reduceMotion.matches || document.hidden || slides.length < 2) return;
            autoplayId = window.setTimeout(() => {
                setSlide(activeIndex + 1);
                scheduleAutoplay();
            }, interval);
        };

        const setAutoplay = (isRunning) => {
            if (autoplayId) window.clearTimeout(autoplayId);
            autoplayId = null;
            if (isRunning) scheduleAutoplay();
        };

        previousButton?.addEventListener('click', () => {
            setSlide(activeIndex - 1);
            setAutoplay(true);
        });
        nextButton?.addEventListener('click', () => {
            setSlide(activeIndex + 1);
            setAutoplay(true);
        });
        dots.forEach((dot, index) => dot.addEventListener('click', () => {
            setSlide(index);
            setAutoplay(true);
        }));
        heroCarousel.addEventListener('keydown', (event) => {
            if (event.key === 'ArrowLeft') {
                event.preventDefault();
                setSlide(activeIndex - 1);
                setAutoplay(true);
            }
            if (event.key === 'ArrowRight') {
                event.preventDefault();
                setSlide(activeIndex + 1);
                setAutoplay(true);
            }
        });
        document.addEventListener('visibilitychange', () => setAutoplay(!document.hidden));
        reduceMotion.addEventListener?.('change', () => setAutoplay(!reduceMotion.matches));

        setSlide(0);
        setAutoplay(true);
    }

    const carousel = document.getElementById('adminCarousel');
    if (carousel) {
        const track = document.getElementById('adminCarouselTrack');
        const slides = Array.from(carousel.querySelectorAll('.admin__slide'));
        const dotsContainer = carousel.querySelector('.admin__carousel-dots');
        const previousButton = carousel.querySelector('[data-carousel-prev]');
        const nextButton = carousel.querySelector('[data-carousel-next]');
        const currentLabel = document.getElementById('adminCarouselCurrent');
        const totalLabel = document.getElementById('adminCarouselTotal');
        const interval = Number(carousel.dataset.interval) || 5200;

        slides.forEach((slide, index) => {
            const dot = document.createElement('button');
            const slideName = slide.getAttribute('aria-label')?.replace(/^\\d+ de \\d+:\\s*/, '') || `Imagen ${index + 1}`;
            dot.type = 'button';
            dot.setAttribute('role', 'tab');
            dot.setAttribute('aria-label', `Ver ${slideName}`);
            dot.setAttribute('aria-controls', slide.id);
            dot.dataset.carouselDot = String(index);
            dotsContainer?.appendChild(dot);
        });
        const dots = Array.from(carousel.querySelectorAll('[data-carousel-dot]'));
        if (totalLabel) totalLabel.textContent = String(slides.length).padStart(2, '0');
        const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
        let activeIndex = 0;
        let autoplayId = null;
        let pointerStartX = null;

        const setAutoplay = (isRunning) => {
            if (autoplayId) window.clearInterval(autoplayId);
            autoplayId = null;
            if (isRunning && carousel.dataset.autoplay === 'true' && !reduceMotion.matches && slides.length > 1) {
                autoplayId = window.setInterval(() => setSlide(activeIndex + 1), interval);
            }
        };

        const setSlide = (nextIndex) => {
            activeIndex = (nextIndex + slides.length) % slides.length;
            const activeImage = slides[activeIndex]?.querySelector('img');
            if (activeImage) activeImage.loading = 'eager';
            track.style.transform = `translate3d(-${activeIndex * 100}%, 0, 0)`;

            slides.forEach((slide, index) => {
                const isActive = index === activeIndex;
                slide.classList.toggle('is-active', isActive);
                slide.setAttribute('aria-hidden', String(!isActive));
            });

            dots.forEach((dot, index) => {
                const isActive = index === activeIndex;
                dot.classList.toggle('is-active', isActive);
                dot.setAttribute('aria-selected', String(isActive));
                dot.setAttribute('tabindex', isActive ? '0' : '-1');
            });

            if (currentLabel) currentLabel.textContent = String(activeIndex + 1).padStart(2, '0');
        };

        previousButton?.addEventListener('click', () => {
            setSlide(activeIndex - 1);
            setAutoplay(true);
        });
        nextButton?.addEventListener('click', () => {
            setSlide(activeIndex + 1);
            setAutoplay(true);
        });
        dots.forEach((dot, index) => dot.addEventListener('click', () => {
            setSlide(index);
            setAutoplay(true);
        }));

        carousel.addEventListener('keydown', (event) => {
            if (event.key === 'ArrowLeft') {
                event.preventDefault();
                setSlide(activeIndex - 1);
                setAutoplay(true);
            }
            if (event.key === 'ArrowRight') {
                event.preventDefault();
                setSlide(activeIndex + 1);
                setAutoplay(true);
            }
        });

        carousel.addEventListener('pointerdown', (event) => {
            pointerStartX = event.clientX;
            carousel.classList.add('is-dragging');
        });
        carousel.addEventListener('pointerup', (event) => {
            if (pointerStartX === null) return;
            const distance = event.clientX - pointerStartX;
            if (Math.abs(distance) > 42) {
                setSlide(activeIndex + (distance < 0 ? 1 : -1));
                setAutoplay(true);
            }
            pointerStartX = null;
            carousel.classList.remove('is-dragging');
            setAutoplay(true);
        });
        carousel.addEventListener('pointercancel', () => {
            pointerStartX = null;
            carousel.classList.remove('is-dragging');
            setAutoplay(true);
        });
        document.addEventListener('visibilitychange', () => setAutoplay(!document.hidden));
        reduceMotion.addEventListener?.('change', () => setAutoplay(!reduceMotion.matches));

        setSlide(0);
        setAutoplay(true);
    }

    const revealItems = document.querySelectorAll('.reveal');
    if ('IntersectionObserver' in window) {
        const observer = new IntersectionObserver((entries, observerInstance) => {
            entries.forEach((entry) => {
                if (!entry.isIntersecting) return;
                entry.target.classList.add('is-visible');
                observerInstance.unobserve(entry.target);
            });
        }, { threshold: 0.12, rootMargin: '0px 0px -30px' });
        revealItems.forEach((item) => observer.observe(item));
    } else {
        revealItems.forEach((item) => item.classList.add('is-visible'));
    }

    (async function cargarPlanDesdeConfig() {
        try {
            const response = await fetch('/api/saas/info-publica', { headers: { Accept: 'application/json' } });
            if (!response.ok) return;
            const data = await response.json();
            const config = data?.config;
            if (!config) return;

            const price = Number(config.precioMensualArs);
            if (Number.isFinite(price)) {
                const priceElement = document.getElementById('planPrecioDestacado');
                if (priceElement) priceElement.textContent = '$' + price.toLocaleString('es-AR', { maximumFractionDigits: 0 });
            }
            if (config.planNombre) {
                const planName = document.getElementById('planNombreDestacado');
                if (planName) planName.textContent = config.planNombre;
            }
        } catch (error) {
            // La landing conserva el valor de respaldo si la configuración no está disponible.
        }
    })();
});
