/**
 * Floating ritual guidebook: 3D cover open + click-to-flip pages (GSAP only, no ScrollTrigger).
 * window.openGuidebookCinematic(onComplete?, { replay?: boolean })
 * window.openGuidebookReplay()
 */
(function () {
    var pageIdx = 0;
    var isOpen = false;
    var flipping = false;
    var coverDone = false;
    var replayMode = false;
    var onboardingCb = null;
    var defsCache = null;
    var overlayRef = null;

    function qs(id) {
        return document.getElementById(id);
    }

    function getRepo() {
        return qs('guidebook-demo-pages');
    }

    function stashDemos(rb) {
        var repo = getRepo();
        if (!rb || !repo) return;
        Array.prototype.slice.call(rb.childNodes).forEach(function (n) {
            if (
                n.nodeType === 1 &&
                n.classList &&
                n.classList.contains('guide-page')
            ) {
                repo.appendChild(n);
            }
        });
    }

    function clear(rb) {
        stashDemos(rb);
        while (rb && rb.firstChild) rb.removeChild(rb.firstChild);
    }

    function injectStatic(rb, html) {
        clear(rb);
        var w = document.createElement('div');
        w.className = 'guidebook-static-page ritual-font-body';
        w.innerHTML = html;
        rb.appendChild(w);
    }

    function powerMount(dataPageNum) {
        return function mount(rb) {
            var repo = getRepo();
            if (!repo) return;
            clear(rb);
            var el = repo.querySelector(
                '.guide-page[data-page="' + String(dataPageNum) + '"]',
            );
            if (el) rb.appendChild(el);
        };
    }

    function buildDefs(onboarding) {
        var onb = onboarding;
        return [
            {
                hint: 'Click “Next page” when you’re ready.',
                mount: function (rb) {
                    injectStatic(
                        rb,
                        '<p class="guide-welcome-tag ritual-font-display">∴ The guidebook speaks ∴</p>' +
                            '<p class="guide-lead"><strong>I am Angelic’s Tic Tac Toe Guidebook</strong>, bound to teach you before the veil lifts.</p>' +
                            '<p>I will flip open on my own, then advance only when <em>you</em> bid it—each page is a pact you choose to read.</p>' +
                            '<p class="guide-cta-strong">When you grasp the rituals, descend to the board.</p>',
                    );
                },
            },
            {
                hint: 'The grid’s laws.',
                mount: function (rb) {
                    injectStatic(
                        rb,
                        '<h3 class="gb-book-h ritual-font-display">Rules of the lattice</h3>' +
                            '<ul class="gb-bullet-list">' +
                            '<li>Seal a row, column, or diagonal with three of your marks to win.</li>' +
                            '<li>You wield <strong>✕</strong>; the challenger answers with <strong>◯</strong>.</li>' +
                            '<li>A filled board with no line is swallowed by the void—a draw.</li>' +
                            '</ul>',
                    );
                },
            },
            {
                hint: 'What watches from the opposite side.',
                mount: function (rb) {
                    injectStatic(
                        rb,
                            '<h3 class="gb-book-h ritual-font-display">The challenger (no change to how it fights)</h3>' +
                            '<p><strong>Lore only:</strong> the opposite side remembers rhythm, favoured cells, and pressure. Difficulty bends with triumph and defeat.</p>' +
                            '<p>Ritual camera exists to honour fair play—you are witnessed, not judged by this codex.</p>',
                    );
                },
            },
            {
                hint: 'Hint Pulse',
                mount: powerMount(4),
            },
            {
                hint: 'Board Shake',
                mount: powerMount(5),
            },
            {
                hint: 'Last Stand',
                mount: powerMount(6),
            },
            {
                hint: 'Tactical Claim · AI oath',
                mount: powerMount(7),
            },
            {
                hint: onb ? 'Then you walk onto the board alone.' : 'Close when finished.',
                mount: function (rb) {
                    injectStatic(
                        rb,
                        '<h3 class="gb-book-h ritual-font-display">The field awaits</h3>' +
                            '<p>Your <strong>sidebar</strong> holds full rituals; the <strong>bottom bar</strong> is the quick selector. Banners mark every activation.</p>' +
                            '<p class="gb-final-strong">Only the grid and your arsenal remain—that is deliberate.</p>' +
                            (onb
                                ? '<p>Press <strong>Step onto the board</strong> when the pact is sealed.</p>'
                                : ''),
                    );
                },
            },
        ];
    }

    function setHint(t) {
        var el = qs('guidebook-page-hint');
        if (el) el.textContent = t || '';
    }

    function footerFor(total) {
        var nextBtn = qs('guidebook-btn-next');
        var prevBtn = qs('guidebook-btn-prev');
        var enterBtn = qs('guidebook-btn-enter-game');
        var closeBtn = qs('guidebook-btn-close-replay');

        [
            nextBtn,
            prevBtn,
            enterBtn,
            closeBtn,
        ].forEach(function (b) {
            if (b) b.classList.add('hidden');
        });

        if (!coverDone || !overlayRef || !defsCache) return;

        var last = total - 1;
        prevBtn &&
            prevBtn.classList.toggle('hidden', pageIdx <= 0);
        nextBtn &&
            nextBtn.classList.toggle('hidden', pageIdx >= last);

        if (replayMode && pageIdx >= last) closeBtn.classList.remove('hidden');
        else if (!replayMode && pageIdx >= last) enterBtn.classList.remove('hidden');
    }

    function mountCurrent() {
        var rb = qs('guidebook-reading-body');
        if (!rb || !defsCache[pageIdx]) return;
        defsCache[pageIdx].mount(rb);
        setHint(defsCache[pageIdx].hint);
        footerFor(defsCache.length);
        if (typeof window.syncGuidebookPowerDemoPage === 'function') {
            window.syncGuidebookPowerDemoPage(pageIdx);
        }
    }

    /** @private */
    function runFlip(goForward, onDone) {
        var sheet = qs('guidebook-sheet-flip');
        var useGsap =
            typeof gsap !== 'undefined' &&
            !overlayRef.dataset.noGsap &&
            !overlayRef.dataset.reducedMotion;

        if (!useGsap || !sheet) {
            if (typeof onDone === 'function') onDone();
            flipping = false;
            return;
        }

        var out = goForward ? -92 : 92;
        var inn = goForward ? 92 : -92;

        gsap.timeline({
            defaults: { transformOrigin: '50% 50%', ease: 'power2.in' },
            onComplete: function () {
                flipping = false;
            },
        })
            .to(sheet, { rotationY: out, duration: 0.45 })
            .add(function swap() {
                if (typeof onDone === 'function') onDone();
            })
            .fromTo(sheet, { rotationY: inn }, {
                rotationY: 0,
                duration: 0.52,
                ease: 'power3.out',
            });
    }

    function goPage(delta) {
        if (!coverDone || flipping || !defsCache) return;
        var n = defsCache.length;
        var next = pageIdx + delta;
        if (next < 0 || next >= n) return;

        flipping = true;
        runFlip(delta > 0, function swap() {
            pageIdx = next;
            mountCurrent();
        });
    }

    /** @private */
    function attachListeners() {
        var ov = overlayRef;
        replaceClick(qs('guidebook-btn-next'), function () {
            goPage(1);
        });
        replaceClick(qs('guidebook-btn-prev'), function () {
            goPage(-1);
        });
        replaceClick(qs('guidebook-btn-enter-game'), function () {
            if (replayMode) return;
            if (typeof onboardingCb === 'function') {
                var fn = onboardingCb;
                onboardingCb = null;
                closeOverlay();
                fn();
            }
        });
        replaceClick(qs('guidebook-btn-close-replay'), function () {
            if (!replayMode) return;
            closeOverlay();
        });
    }

    function replaceClick(btn, handler) {
        if (!btn) return;
        var neo = btn.cloneNode(true);
        neo.id = btn.id;
        btn.parentNode.replaceChild(neo, btn);
        neo.addEventListener('click', handler);
    }

    /** @private */
    function resetDom(overlay) {
        stashDemos(qs('guidebook-reading-body'));
        [
            qs('guidebook-btn-next'),
            qs('guidebook-btn-prev'),
            qs('guidebook-btn-enter-game'),
            qs('guidebook-btn-close-replay'),
        ].forEach(function (b) {
            if (b) b.classList.add('hidden');
        });

        var cover = overlay.querySelector('.book-cover-closed-layer');
        var spread = overlay.querySelector('.book-spread-mask');
        var sheet = qs('guidebook-sheet-flip');
        var root = qs('guidebook-book-3d');
        var floatWrap = overlay.querySelector('.guidebook-float-wrap');

        /** @private */
        if (typeof gsap !== 'undefined') {
            gsap.killTweensOf([cover, spread, sheet, root, floatWrap]);
        }

        /** @private */
        if (cover) {
            cover.style.display = '';
            cover.style.opacity = '';
            cover.style.visibility = '';
            cover.style.transform = '';
        }
        if (spread) spread.style.opacity = '';
        /** @private */
        if (sheet) {
            sheet.style.transform = '';
            if (typeof gsap !== 'undefined') gsap.set(sheet, { rotationY: 0 });
            else sheet.style.transform = '';
        }
        if (root && typeof gsap !== 'undefined') {
            gsap.set(root, {
                rotationX: 0,
                rotationY: 0,
                rotationZ: 0,
                y: 0,
                scale: 1,
            });
        } else if (root) root.style.transform = '';
    }

    function closeOverlay() {
        if (typeof window.stopAllGuideDemos === 'function') {
            window.stopAllGuideDemos();
        }
        stashDemos(qs('guidebook-reading-body'));
        if (overlayRef) {
            overlayRef.classList.add('hidden');
            overlayRef.style.visibility = '';
            overlayRef.style.display = '';
            overlayRef.style.opacity = '';
            overlayRef.style.pointerEvents = '';
            overlayRef.removeAttribute('data-reduced-motion');
            overlayRef.removeAttribute('data-no-gsap');
        }
        document.documentElement.style.overflow = '';
        document.body.style.overflow = '';
        isOpen = false;
        coverDone = false;
        flipping = false;
        defsCache = null;
        overlayRef = null;
    }

    /** @private */
    function finishIntroReading() {
        coverDone = true;
        pageIdx = 0;
        mountCurrent();
        footerFor(defsCache.length);
    }

    /** @private */
    function runIntroAnimations(overlay) {
        /** @private */
        var cover = overlay.querySelector('.book-cover-closed-layer');
        /** @private */
        var spread = overlay.querySelector('.book-spread-mask');
        /** @private */
        var root = qs('guidebook-book-3d');
        /** @private */
        var floatWrap = overlay.querySelector('.guidebook-float-wrap');
        /** @private */
        var sheet = qs('guidebook-sheet-flip');

        if (
            replayMode ||
            overlay.dataset.reducedMotion ||
            overlay.dataset.noGsap ||
            typeof gsap === 'undefined'
        ) {
            if (cover) cover.style.display = 'none';
            /** @private */
            if (spread) spread.style.opacity = '1';
            finishIntroReading();
            return;
        }

        gsap.set(spread, { opacity: 0 });
        gsap.set(cover, {
            rotateY: 0,
            transformOrigin: 'left center',
            transformPerspective: 1200,
            force3D: true,
        });
        gsap.set(root, {
            rotateX: -10,
            rotateY: -18,
            rotateZ: -4,
            transformPerspective: 1400,
        });
        gsap.set(sheet, { rotationY: 0 });

        gsap.fromTo(
            floatWrap,
            { y: 54, opacity: 0 },
            { y: 0, opacity: 1, duration: 0.72, ease: 'power3.out' },
        );
        gsap.fromTo(
            root,
            { scale: 0.28 },
            { scale: 1, duration: 1.1, ease: 'power4.out', delay: 0.05 },
        );

        gsap
            .timeline({
                onComplete: finishIntroReading,
            })
            .to(
                root,
                {
                    y: -10,
                    rotationX: 4,
                    rotationY: -6,
                    duration: 1.15,
                    ease: 'sine.inOut',
                },
                '+=0.15',
            )
            .to(
                cover,
                {
                    rotateY: -118,
                    duration: 1.65,
                    ease: 'power2.inOut',
                },
                '-=0.55',
            )
            .to(spread, { opacity: 1, duration: 0.65 }, '-=1')
            .set(cover, { autoAlpha: 0 }, '-=0.35');
    }

    window.openGuidebookCinematic = function (cb, opts) {
        opts = opts || {};
        replayMode = !!opts.replay;
        onboardingCb = replayMode ? null : typeof cb === 'function' ? cb : null;

        var overlay = qs('guidebook-cinematic-overlay');
        if (!overlay) {
            if (typeof cb === 'function') cb();
            return;
        }

        overlayRef = overlay;
        defsCache = buildDefs(!replayMode);
        pageIdx = 0;
        /** @private */
        coverDone = false;
        isOpen = true;
        flipping = false;

        stashDemos(qs('guidebook-reading-body'));
        resetDom(overlay);
        clear(qs('guidebook-reading-body'));

        /** @private */
        var mq =
            typeof window.matchMedia === 'function' &&
            window.matchMedia('(prefers-reduced-motion: reduce)');
        /** @private */
        if (mq && mq.matches) overlay.dataset.reducedMotion = '1';
        /** @private */
        else delete overlay.dataset.reducedMotion;

        if (overlay.dataset.reducedMotion || typeof gsap === 'undefined')
            overlay.dataset.noGsap = '1';
        else delete overlay.dataset.noGsap;

        overlay.classList.remove('hidden');
        overlay.style.display = 'flex';
        overlay.style.visibility = 'visible';
        overlay.style.opacity = '1';
        overlay.style.pointerEvents = 'auto';
        overlay.setAttribute('aria-hidden', 'false');
        document.documentElement.style.overflow = 'hidden';
        document.body.style.overflow = 'hidden';

        setHint('');
        attachListeners();
        runIntroAnimations(overlay);
    };

    window.openGuidebookReplay = function () {
        window.openGuidebookCinematic(null, { replay: true });
    };

    /** @private */
    document.addEventListener('DOMContentLoaded', function () {
        replaceClick(qs('guidebook-reopen-btn'), function () {
            if (typeof window.openGuidebookReplay === 'function') {
                window.openGuidebookReplay();
            }
        });
    });
})();
