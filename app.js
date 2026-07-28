/*
 * SO.GL site settings
 *
 * This is the only block that normally needs editing before publication.
 * Discounts are specified in rubles. Set both values to 0 to hide the sale UI.
 * Contact and video values should be full public URLs.
 */
const SITE_CONFIG = Object.freeze({
    pricing: Object.freeze({
        firstHour: 3000,
        additionalHour: 2000,
        firstHourDiscount: 0,
        additionalHourDiscount: 0,
        minHours: 1,
        maxHours: 8,
        defaultHours: 2
    }),
    contacts: Object.freeze({
        telegram: "",
        vk: "",
        max: "",
        phoneHref: "",
        phoneLabel: ""
    }),
    media: Object.freeze({
        heroVideo: "",
        botVideo: ""
    })
});

(() => {
    "use strict";

    const moneyFormatter = new Intl.NumberFormat("ru-RU", {
        maximumFractionDigits: 0,
        style: "currency",
        currency: "RUB"
    });

    const pricing = normalizePricing(SITE_CONFIG.pricing);
    let selectedHours = pricing.defaultHours;

    const elements = {
        header: document.querySelector("[data-header]"),
        menuToggle: document.querySelector("[data-menu-toggle]"),
        nav: document.querySelector("[data-nav]"),
        firstHourPrices: document.querySelectorAll("[data-first-hour-price]"),
        firstHourOldPrices: document.querySelectorAll("[data-first-hour-old]"),
        extraHourPrices: document.querySelectorAll("[data-extra-hour-price]"),
        extraHourOldPrices: document.querySelectorAll("[data-extra-hour-old]"),
        discountBanner: document.querySelector("[data-discount-banner]"),
        discountCopy: document.querySelector("[data-discount-copy]"),
        hoursMinus: document.querySelector("[data-hours-minus]"),
        hoursPlus: document.querySelector("[data-hours-plus]"),
        hoursOutput: document.querySelector("[data-hours-output]"),
        totalPrice: document.querySelector("[data-total-price]"),
        totalOld: document.querySelector("[data-total-old]"),
        priceBreakdown: document.querySelector("[data-price-breakdown]"),
        bookingHoursLink: document.querySelector("[data-booking-hours]"),
        contactStatus: document.querySelector("[data-contact-status]"),
        businessSchema: document.querySelector("[data-business-schema]")
    };

    function finiteNumber(value, fallback = 0) {
        const number = Number(value);
        return Number.isFinite(number) ? number : fallback;
    }

    function clamp(value, minimum, maximum) {
        return Math.min(Math.max(value, minimum), maximum);
    }

    function normalizePricing(source) {
        const minHours = Math.max(1, Math.round(finiteNumber(source.minHours, 1)));
        const maxHours = Math.max(minHours, Math.round(finiteNumber(source.maxHours, 8)));

        return {
            firstHour: Math.max(0, finiteNumber(source.firstHour, 3000)),
            additionalHour: Math.max(0, finiteNumber(source.additionalHour, 2000)),
            firstHourDiscount: Math.max(0, finiteNumber(source.firstHourDiscount)),
            additionalHourDiscount: Math.max(0, finiteNumber(source.additionalHourDiscount)),
            minHours,
            maxHours,
            defaultHours: clamp(
                Math.round(finiteNumber(source.defaultHours, minHours)),
                minHours,
                maxHours
            )
        };
    }

    function formatMoney(value) {
        return moneyFormatter.format(Math.round(value)).replace(/\u00a0/g, " ");
    }

    function hourWord(hours) {
        const absolute = Math.abs(hours) % 100;
        const lastDigit = absolute % 10;

        if (absolute > 10 && absolute < 20) return "часов";
        if (lastDigit === 1) return "час";
        if (lastDigit >= 2 && lastDigit <= 4) return "часа";
        return "часов";
    }

    function nextHourWord(hours) {
        return hours === 1 ? "следующий час" : `следующих ${hourWord(hours)}`;
    }

    function effectivePrices() {
        const firstHourDiscount = Math.min(pricing.firstHour, pricing.firstHourDiscount);
        const additionalHourDiscount = Math.min(
            pricing.additionalHour,
            pricing.additionalHourDiscount
        );

        return {
            firstHour: pricing.firstHour - firstHourDiscount,
            additionalHour: pricing.additionalHour - additionalHourDiscount,
            firstHourDiscount,
            additionalHourDiscount
        };
    }

    function calculatePrice(hours) {
        const safeHours = clamp(Math.round(hours), pricing.minHours, pricing.maxHours);
        const additionalHours = Math.max(0, safeHours - 1);
        const effective = effectivePrices();

        return {
            hours: safeHours,
            additionalHours,
            original: pricing.firstHour + pricing.additionalHour * additionalHours,
            total: effective.firstHour + effective.additionalHour * additionalHours,
            ...effective
        };
    }

    function setHidden(element, hidden) {
        if (element) element.hidden = hidden;
    }

    function renderBasePrices() {
        const effective = effectivePrices();

        elements.firstHourPrices.forEach((element) => {
            element.textContent = formatMoney(effective.firstHour);
        });

        elements.extraHourPrices.forEach((element) => {
            element.textContent = formatMoney(effective.additionalHour);
        });

        elements.firstHourOldPrices.forEach((element) => {
            element.textContent = formatMoney(pricing.firstHour);
            setHidden(element, effective.firstHourDiscount === 0);
        });

        elements.extraHourOldPrices.forEach((element) => {
            element.textContent = formatMoney(pricing.additionalHour);
            setHidden(element, effective.additionalHourDiscount === 0);
        });

        const hasDiscount = effective.firstHourDiscount > 0 || effective.additionalHourDiscount > 0;
        setHidden(elements.discountBanner, !hasDiscount);

        if (hasDiscount && elements.discountCopy) {
            const parts = [];
            if (effective.firstHourDiscount > 0) {
                parts.push(`−${formatMoney(effective.firstHourDiscount)} на первый час`);
            }
            if (effective.additionalHourDiscount > 0) {
                parts.push(`−${formatMoney(effective.additionalHourDiscount)} на каждый следующий час`);
            }
            elements.discountCopy.textContent = parts.join(" и ");
        }
    }

    function renderSelectedHours() {
        const result = calculatePrice(selectedHours);
        selectedHours = result.hours;

        if (elements.hoursOutput) {
            elements.hoursOutput.value = `${selectedHours} ${hourWord(selectedHours)}`;
            elements.hoursOutput.textContent = `${selectedHours} ${hourWord(selectedHours)}`;
        }

        if (elements.totalPrice) elements.totalPrice.textContent = formatMoney(result.total);

        if (elements.totalOld) {
            const hasDiscount = result.original > result.total;
            elements.totalOld.textContent = formatMoney(result.original);
            setHidden(elements.totalOld, !hasDiscount);
        }

        if (elements.priceBreakdown) {
            if (result.additionalHours === 0) {
                elements.priceBreakdown.textContent = `${formatMoney(result.firstHour)} за первый час`;
            } else if (result.additionalHours === 1) {
                elements.priceBreakdown.textContent = `${formatMoney(result.firstHour)} за первый час + ${formatMoney(result.additionalHour)} за следующий`;
            } else {
                elements.priceBreakdown.textContent = `${formatMoney(result.firstHour)} за первый час + ${formatMoney(result.additionalHour)} × ${result.additionalHours} ${nextHourWord(result.additionalHours)}`;
            }
        }

        if (elements.bookingHoursLink) {
            elements.bookingHoursLink.textContent = `Уточнить дату на ${selectedHours} ${hourWord(selectedHours)}`;
        }

        const atMinimum = selectedHours <= pricing.minHours;
        const atMaximum = selectedHours >= pricing.maxHours;

        if (elements.hoursMinus) {
            elements.hoursMinus.disabled = atMinimum;
            elements.hoursMinus.setAttribute("aria-disabled", String(atMinimum));
        }
        if (elements.hoursPlus) {
            elements.hoursPlus.disabled = atMaximum;
            elements.hoursPlus.setAttribute("aria-disabled", String(atMaximum));
        }
    }

    function changeHours(nextHours) {
        selectedHours = clamp(nextHours, pricing.minHours, pricing.maxHours);
        renderSelectedHours();
    }

    function setupPricing() {
        renderBasePrices();
        renderSelectedHours();

        elements.hoursMinus?.addEventListener("click", () => changeHours(selectedHours - 1));
        elements.hoursPlus?.addEventListener("click", () => changeHours(selectedHours + 1));
    }

    function closeMenu({ restoreFocus = false } = {}) {
        if (!elements.nav || !elements.menuToggle) return;
        elements.nav.classList.remove("is-open");
        elements.header?.classList.remove("has-open-nav");
        elements.menuToggle.setAttribute("aria-expanded", "false");
        elements.menuToggle.querySelector(".menu-toggle__label").textContent = "Меню";
        document.body.classList.remove("nav-open");
        if (restoreFocus) elements.menuToggle.focus();
    }

    function openMenu() {
        if (!elements.nav || !elements.menuToggle) return;
        elements.nav.classList.add("is-open");
        elements.header?.classList.add("has-open-nav");
        elements.menuToggle.setAttribute("aria-expanded", "true");
        elements.menuToggle.querySelector(".menu-toggle__label").textContent = "Закрыть";
        document.body.classList.add("nav-open");
    }

    function setupNavigation() {
        const updateHeader = () => {
            elements.header?.classList.toggle("is-scrolled", window.scrollY > 16);
        };

        elements.menuToggle?.addEventListener("click", () => {
            const isOpen = elements.menuToggle.getAttribute("aria-expanded") === "true";
            if (isOpen) closeMenu();
            else openMenu();
        });

        elements.nav?.querySelectorAll("a").forEach((link) => {
            link.addEventListener("click", () => closeMenu());
        });

        document.addEventListener("keydown", (event) => {
            if (event.key === "Escape" && elements.nav?.classList.contains("is-open")) {
                closeMenu({ restoreFocus: true });
            }
        });

        window.addEventListener("resize", () => {
            if (window.innerWidth > 820) closeMenu();
        });
        window.addEventListener("scroll", updateHeader, { passive: true });
        updateHeader();
    }

    function setupMobileCallToAction() {
        const mobileCallToAction = document.querySelector("[data-mobile-cta]");
        const heroBookingLink = document.querySelector("[data-hero-booking-link]");
        const bookingSection = document.querySelector("#booking");

        if (!mobileCallToAction || !heroBookingLink || !bookingSection) return;
        if (!("IntersectionObserver" in window)) {
            mobileCallToAction.classList.add("is-visible");
            return;
        }

        let heroLinkVisible = true;
        let bookingVisible = false;
        const render = () => {
            mobileCallToAction.classList.toggle(
                "is-visible",
                !heroLinkVisible && !bookingVisible
            );
        };

        const observer = new IntersectionObserver((entries) => {
            entries.forEach((entry) => {
                if (entry.target === heroBookingLink) heroLinkVisible = entry.isIntersecting;
                if (entry.target === bookingSection) bookingVisible = entry.isIntersecting;
            });
            render();
        }, { threshold: 0.08 });

        observer.observe(heroBookingLink);
        observer.observe(bookingSection);
        render();
    }

    function setupVideos() {
        const sources = {
            hero: String(SITE_CONFIG.media.heroVideo || "").trim(),
            bot: String(SITE_CONFIG.media.botVideo || "").trim()
        };

        document.querySelectorAll("[data-config-video]").forEach((video) => {
            const source = sources[video.dataset.configVideo];
            if (!source) return;

            const container = video.closest(".video-frame, .phone-shell");
            const control = container?.querySelector("[data-video-control]");
            const label = control?.querySelector("[data-video-control-label]");

            const renderPlaybackState = () => {
                const isPaused = video.paused;
                if (label) label.textContent = isPaused ? "Включить" : "Пауза";
                if (control) {
                    control.setAttribute(
                        "aria-label",
                        isPaused ? "Воспроизвести видео" : "Приостановить видео"
                    );
                }
            };

            video.src = source;
            video.autoplay = true;
            video.muted = true;
            video.load();
            if (control) control.hidden = false;

            video.addEventListener("play", renderPlaybackState);
            video.addEventListener("pause", renderPlaybackState);
            video.addEventListener("canplay", () => {
                video.play().catch(renderPlaybackState);
            }, { once: true });
            video.addEventListener("error", () => {
                if (control) control.hidden = true;
            }, { once: true });

            control?.addEventListener("click", () => {
                if (video.paused) video.play().catch(renderPlaybackState);
                else video.pause();
            });

            renderPlaybackState();
        });
    }

    function contactUrl(type) {
        if (type === "phone") return String(SITE_CONFIG.contacts.phoneHref || "").trim();
        return String(SITE_CONFIG.contacts[type] || "").trim();
    }

    function setContactStatus(message, kind = "info") {
        if (!elements.contactStatus) return;
        elements.contactStatus.textContent = message;
        elements.contactStatus.dataset.status = kind;
    }

    function setupContacts() {
        document.querySelectorAll("[data-direct-contact]").forEach((link) => {
            const type = link.dataset.directContact;
            const url = contactUrl(type);

            const phoneLabel = String(SITE_CONFIG.contacts.phoneLabel || "").trim();
            if (type === "phone" && phoneLabel) {
                const label = link.querySelector("[data-contact-label]");
                if (label) label.textContent = phoneLabel;
                else if (!link.hasAttribute("data-contact-static-label")) link.textContent = phoneLabel;
                link.setAttribute("aria-label", `Позвонить по номеру ${phoneLabel}`);
            }

            if (!url) {
                link.classList.add("is-missing");
                link.title = "Контакт пока не указан в настройках сайта";
                link.addEventListener("click", (event) => {
                    setContactStatus("Этот контакт пока не настроен. Добавьте ссылку в начале app.js.", "warning");
                    if (link.closest(".contact-card")) event.preventDefault();
                });
                if (link.closest(".contact-card")) link.setAttribute("aria-disabled", "true");
                return;
            }

            link.href = url;
            if (type !== "phone") {
                link.target = "_blank";
                link.rel = "noopener noreferrer";
            }
        });
    }

    function setupRevealAnimations() {
        const targets = document.querySelectorAll("[data-reveal]");
        const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

        if (!("IntersectionObserver" in window) || reducedMotion) {
            targets.forEach((target) => target.classList.add("is-visible"));
            return;
        }

        document.documentElement.classList.add("reveal-ready");
        const pendingTargets = new Set(targets);
        let animationFrame = 0;

        const revealTarget = (target) => {
            target.classList.add("is-visible");
            pendingTargets.delete(target);
            observer.unobserve(target);

            if (pendingTargets.size === 0) {
                window.removeEventListener("scroll", revealPassedTargets);
                window.removeEventListener("resize", revealPassedTargets);
            }
        };

        const observer = new IntersectionObserver((entries) => {
            entries.forEach((entry) => {
                if (!entry.isIntersecting) return;
                revealTarget(entry.target);
            });
        }, {
            rootMargin: "0px 0px -8%",
            threshold: 0.08
        });

        function revealPassedTargets() {
            if (animationFrame) return;
            animationFrame = window.requestAnimationFrame(() => {
                animationFrame = 0;
                const revealLine = window.innerHeight * 0.92;
                pendingTargets.forEach((target) => {
                    if (target.getBoundingClientRect().top < revealLine) revealTarget(target);
                });
            });
        }

        targets.forEach((target) => observer.observe(target));
        window.addEventListener("scroll", revealPassedTargets, { passive: true });
        window.addEventListener("resize", revealPassedTargets);
        revealPassedTargets();
    }

    function setupPageMetadata() {
        document.querySelectorAll("[data-current-year]").forEach((element) => {
            element.textContent = String(new Date().getFullYear());
        });

        if (!elements.businessSchema) return;

        try {
            const schema = JSON.parse(elements.businessSchema.textContent);
            const phone = contactUrl("phone").replace(/^tel:/i, "").split(/[?;]/)[0].trim();
            const sameAs = ["telegram", "vk", "max"]
                .map((type) => contactUrl(type))
                .filter(Boolean);

            if (phone) schema.telephone = phone;
            if (sameAs.length > 0) schema.sameAs = sameAs;
            elements.businessSchema.textContent = JSON.stringify(schema);
        } catch (error) {
            // Keep the static schema untouched if it cannot be parsed.
        }
    }

    setupPricing();
    setupNavigation();
    setupMobileCallToAction();
    setupVideos();
    setupContacts();
    setupRevealAnimations();
    setupPageMetadata();
})();
