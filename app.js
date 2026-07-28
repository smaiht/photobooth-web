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
        firstHourOld: document.querySelector("[data-first-hour-old]"),
        extraHourPrice: document.querySelector("[data-extra-hour-price]"),
        extraHourOld: document.querySelector("[data-extra-hour-old]"),
        discountBanner: document.querySelector("[data-discount-banner]"),
        discountCopy: document.querySelector("[data-discount-copy]"),
        hoursMinus: document.querySelector("[data-hours-minus]"),
        hoursPlus: document.querySelector("[data-hours-plus]"),
        hoursOutput: document.querySelector("[data-hours-output]"),
        totalPrice: document.querySelector("[data-total-price]"),
        totalOld: document.querySelector("[data-total-old]"),
        priceBreakdown: document.querySelector("[data-price-breakdown]"),
        bookingHoursLink: document.querySelector("[data-booking-hours]"),
        bookingHoursSelect: document.querySelector("[data-booking-hours-select]"),
        bookingPrice: document.querySelector("[data-booking-price]"),
        bookingDate: document.querySelector("#booking-date"),
        bookingForm: document.querySelector("[data-booking-form]"),
        formStatus: document.querySelector("[data-form-status]")
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

        if (elements.extraHourPrice) {
            elements.extraHourPrice.textContent = formatMoney(effective.additionalHour);
        }

        if (elements.firstHourOld) {
            elements.firstHourOld.textContent = formatMoney(pricing.firstHour);
            setHidden(elements.firstHourOld, effective.firstHourDiscount === 0);
        }

        if (elements.extraHourOld) {
            elements.extraHourOld.textContent = formatMoney(pricing.additionalHour);
            setHidden(elements.extraHourOld, effective.additionalHourDiscount === 0);
        }

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
        if (elements.bookingPrice) elements.bookingPrice.textContent = formatMoney(result.total);

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
            elements.bookingHoursLink.textContent = `Проверить дату на ${selectedHours} ${hourWord(selectedHours)}`;
        }

        if (elements.bookingHoursSelect) {
            elements.bookingHoursSelect.value = String(selectedHours);
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

    function populateHoursSelect() {
        if (!elements.bookingHoursSelect) return;

        elements.bookingHoursSelect.replaceChildren();
        for (let hours = pricing.minHours; hours <= pricing.maxHours; hours += 1) {
            const option = document.createElement("option");
            option.value = String(hours);
            option.textContent = `${hours} ${hourWord(hours)}`;
            elements.bookingHoursSelect.append(option);
        }
    }

    function changeHours(nextHours) {
        selectedHours = clamp(nextHours, pricing.minHours, pricing.maxHours);
        renderSelectedHours();
    }

    function setupPricing() {
        populateHoursSelect();
        renderBasePrices();
        renderSelectedHours();

        elements.hoursMinus?.addEventListener("click", () => changeHours(selectedHours - 1));
        elements.hoursPlus?.addEventListener("click", () => changeHours(selectedHours + 1));
        elements.bookingHoursSelect?.addEventListener("change", (event) => {
            changeHours(Number(event.currentTarget.value));
        });
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

    function setFormStatus(message, kind = "info") {
        if (!elements.formStatus) return;
        elements.formStatus.textContent = message;
        elements.formStatus.dataset.status = kind;
    }

    function setupContacts() {
        document.querySelectorAll("[data-direct-contact]").forEach((link) => {
            const type = link.dataset.directContact;
            const url = contactUrl(type);

            const phoneLabel = String(SITE_CONFIG.contacts.phoneLabel || "").trim();
            if (type === "phone" && phoneLabel) {
                link.textContent = phoneLabel;
            }

            if (!url) {
                link.classList.add("is-missing");
                link.setAttribute("aria-disabled", "true");
                link.title = "Контакт пока не указан в настройках сайта";
                link.addEventListener("click", (event) => {
                    event.preventDefault();
                    setFormStatus("Этот контакт пока не настроен. Добавьте ссылку в начале app.js.", "warning");
                });
                return;
            }

            link.href = url;
            if (type !== "phone") {
                link.target = "_blank";
                link.rel = "noopener noreferrer";
            }
        });

        document.querySelectorAll("[data-submit-contact]").forEach((button) => {
            const type = button.dataset.submitContact;
            if (contactUrl(type)) return;

            button.classList.add("is-missing");
            button.title = "Ссылка пока не указана в настройках сайта";
            const note = button.querySelector("small");
            if (note) note.textContent = "ссылка пока не указана";
        });
    }

    function localIsoDate(date) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, "0");
        const day = String(date.getDate()).padStart(2, "0");
        return `${year}-${month}-${day}`;
    }

    function formatBookingDate(value) {
        const [year, month, day] = value.split("-").map(Number);
        if (!year || !month || !day) return value;
        return new Intl.DateTimeFormat("ru-RU", {
            day: "numeric",
            month: "long",
            year: "numeric"
        }).format(new Date(year, month - 1, day));
    }

    function buildBookingRequest(form) {
        const data = new FormData(form);
        const hours = Number(data.get("hours"));
        const result = calculatePrice(hours);

        return [
            "Здравствуйте! Хочу уточнить, свободна ли фотобудка SO.GL.",
            "",
            `Дата: ${formatBookingDate(String(data.get("date")))}`,
            `Город: ${data.get("city")}`,
            `Событие: ${data.get("event")}`,
            `Продолжительность: ${hours} ${hourWord(hours)}`,
            `Предварительная стоимость: ${formatMoney(result.total)}`,
            "",
            "Подскажите, пожалуйста, свободна ли эта дата?"
        ].join("\n");
    }

    async function copyText(text) {
        if (navigator.clipboard && window.isSecureContext) {
            await navigator.clipboard.writeText(text);
            return;
        }

        const temporary = document.createElement("textarea");
        temporary.value = text;
        temporary.setAttribute("readonly", "");
        temporary.style.position = "fixed";
        temporary.style.opacity = "0";
        document.body.append(temporary);
        temporary.select();
        const copied = document.execCommand("copy");
        temporary.remove();
        if (!copied) throw new Error("Clipboard copy failed");
    }

    function setupBookingForm() {
        if (elements.bookingDate) elements.bookingDate.min = localIsoDate(new Date());
        if (!elements.bookingForm) return;

        elements.bookingForm.addEventListener("submit", async (event) => {
            event.preventDefault();
            if (!elements.bookingForm.reportValidity()) return;

            const type = event.submitter?.dataset.submitContact || "telegram";
            const url = contactUrl(type);
            const contactName = type === "vk" ? "ВКонтакте" : "Telegram";
            const request = buildBookingRequest(elements.bookingForm);
            const copyPromise = copyText(request);

            if (url) window.open(url, "_blank", "noopener,noreferrer");

            try {
                await copyPromise;
                if (url) {
                    setFormStatus(`Запрос скопирован. Вставьте его в открывшийся чат ${contactName}.`, "success");
                } else {
                    setFormStatus(`Запрос скопирован, но ссылка на ${contactName} пока не указана в app.js.`, "warning");
                }
            } catch (error) {
                setFormStatus("Не получилось скопировать запрос. Проверьте разрешение браузера на доступ к буферу обмена.", "error");
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
    }

    setupPricing();
    setupNavigation();
    setupMobileCallToAction();
    setupVideos();
    setupContacts();
    setupBookingForm();
    setupRevealAnimations();
    setupPageMetadata();
})();
