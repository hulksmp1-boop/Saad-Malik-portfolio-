/* =============================================================
   SAAD MALIK — PORTFOLIO  |  script.js  |  PART A of 3
   -------------------------------------------------------------
   PART A  (this file): site data, setup, loader, navigation,
                        mobile menu, GSAP + ScrollTrigger, scroll
                        reveals, skills, live playground,
                        "Currently Exploring" list.
   PART B  (next):      Three.js 3D computer, particles, mouse
                        interaction, responsive rendering.
   PART C  (after B):   custom cursor, experiment cards (magnetic,
                        tilt, particles, easing), project cards,
                        contact links, error handling.

   HOW THE PARTS COMBINE
   Each part is its own self-contained block (an IIFE). Parts talk
   to each other through one shared object, window.SM. To build the
   final file, paste Part A, then Part B, then Part C into ONE
   script.js, in that order, with nothing in between.
   ============================================================= */


/* =============================================================
   SITE DATA  —  THE ONLY PLACE YOU NEED TO EDIT TO ADD CONTENT
   ============================================================= */
const SITE_DATA = {

  /* ---------- CONTACT (used by Part C) ----------
     Leave a value as "" and the page keeps its "Placeholder"
     badge. Fill it in and the links + badges update by themselves.
       email:     "name@example.com"
       instagram: "your_username"      (no @ and no URL)            */
  contact: {
    email: "",
    instagram: ""
  },

  /* ---------- CURRENTLY EXPLORING ----------
     One object per card. Add, remove or reword freely.            */
  exploring: [
    {
      title: "Three.js & WebGL",
      note: "Learning how scenes, cameras, lights and materials come together to build 3D worlds in the browser."
    },
    {
      title: "GSAP Animation",
      note: "Practising timelines, easing and ScrollTrigger to make interfaces feel smooth and intentional."
    },
    {
      title: "React.js",
      note: "Going deeper into components, state and how to structure larger front-end applications."
    },
    {
      title: "Node.js & APIs",
      note: "Building back-end routes and connecting them to a front end to complete the full-stack picture."
    }
  ],

  /* ---------- PROJECTS (rendered by Part C) ----------
     Empty array  = the "Projects Coming Soon" slots stay visible.
     Add objects  = real project cards replace the slots.

     Copy this template INSIDE the [ ] below, remove the // marks,
     and fill in your own real details. Only "title" is required.

       {
         title: "Project name",
         description: "One or two honest sentences about what it is.",
         tech: ["HTML", "CSS", "JavaScript"],
         image: "assets/project-name.jpg",     // optional
         live: "https://your-live-link",       // optional
         repo: "https://github.com/you/repo"   // optional
       },

     Separate several projects with commas.                        */
  projects: [
  ]
};


/* =============================================================
   PART A
   ============================================================= */
(function () {
  "use strict";

  /* -----------------------------------------------------------
     A1. SHARED SETUP — helpers, events, module registry
     ----------------------------------------------------------- */
  const SM = (window.SM = window.SM || {});
  const root = document.documentElement;
  const reducedMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");

  const $ = (selector, scope) => (scope || document).querySelector(selector);
  const $$ = (selector, scope) => Array.from((scope || document).querySelectorAll(selector));

  SM.$ = $;
  SM.$$ = $$;
  SM.hasGSAP = false;
  SM.prefersReducedMotion = () => reducedMotionQuery.matches;
  SM.hasFinePointer = () => window.matchMedia("(hover: hover) and (pointer: fine)").matches;

  function debounce(fn, wait) {
    let timer = null;
    return function () {
      const args = arguments;
      clearTimeout(timer);
      timer = setTimeout(function () { fn.apply(null, args); }, wait);
    };
  }
  SM.debounce = debounce;

  /* Tiny event bus. Events that already happened (like "loaded")
     fire immediately for anyone who subscribes late. */
  const listeners = {};
  SM.flags = {};
  SM.on = function (name, fn) {
    (listeners[name] = listeners[name] || []).push(fn);
    if (SM.flags[name]) { fn(); }
  };
  SM.emit = function (name) {
    SM.flags[name] = true;
    (listeners[name] || []).slice().forEach(function (fn) {
      try { fn(); } catch (error) { console.error("[SM] listener for '" + name + "' failed:", error); }
    });
  };

  /* Scroll lock (used by the loader and the mobile menu) */
  let scrollLocks = 0;
  SM.lockScroll = function () {
    scrollLocks += 1;
    root.style.overflow = "hidden";
    document.body.style.overflow = "hidden";
  };
  SM.unlockScroll = function () {
    scrollLocks = Math.max(0, scrollLocks - 1);
    if (scrollLocks === 0) {
      root.style.overflow = "";
      document.body.style.overflow = "";
    }
  };

  /* Module registry. Every feature registers itself with a name, an
     order number and a function. boot() runs them in order, and one
     failing module can never stop the others. */
  const modules = [];
  SM.register = function (name, order, fn) {
    modules.push({ name: name, order: order, fn: fn });
  };

  function boot() {
    modules
      .slice()
      .sort(function (a, b) { return a.order - b.order; })
      .forEach(function (mod) {
        try {
          mod.fn();
        } catch (error) {
          console.error("[SM] module '" + mod.name + "' failed:", error);
        }
      });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    /* Wait one microtask so Part B and Part C (same file) can register first */
    Promise.resolve().then(boot);
  }


  /* -----------------------------------------------------------
     A2. CORE — icons, footer year, GSAP check, the "js" class
     Order 10
     -----------------------------------------------------------
     CSS hides reveal elements only when <html> has the class "js".
     We add that class ONLY after GSAP + ScrollTrigger are confirmed,
     so if a CDN fails the page simply stays fully visible. */
  function splitHeroTitle() {
    $$(".hero__word[data-split]").forEach(function (word) {
      if (word.dataset.splitDone) { return; }
      const text = word.textContent.trim();
      word.textContent = "";

      /* Screen readers read the real word; the letters are decoration */
      const readable = document.createElement("span");
      readable.className = "sr-only";
      readable.textContent = text;
      word.appendChild(readable);

      Array.from(text).forEach(function (letter) {
        const span = document.createElement("span");
        span.className = "char";
        span.setAttribute("aria-hidden", "true");
        span.textContent = letter;
        word.appendChild(span);
      });
      word.dataset.splitDone = "true";
    });
  }

  /* style.css hides elements with transforms (.js .exp, .js .project-card ...).
     Once an element has been revealed we add ".is-in" and these rules take
     over. They also restore the project-card hover lift, which the original
     ".js .project-card" rule would otherwise cancel (same specificity,
     declared later in style.css). */
  function injectRuntimePatch() {
    if (document.getElementById("sm-runtime-patch")) { return; }
    const style = document.createElement("style");
    style.id = "sm-runtime-patch";
    style.textContent =
      ".js [data-reveal].is-in, .js .exp.is-in, .js .explore.is-in, .js .slot.is-in," +
      " .js .project-card.is-in, .js .playground.is-in { opacity: 1; transform: none; }\n" +
      ".js .project-card.is-in:hover { transform: translateY(-6px); }";
    document.head.appendChild(style);
  }

  SM.register("core", 10, function () {
    const year = $("#year");
    if (year) { year.textContent = String(new Date().getFullYear()); }

    try {
      if (window.lucide && typeof window.lucide.createIcons === "function") {
        window.lucide.createIcons();
      }
    } catch (error) {
      console.warn("[SM] Lucide icons could not be created:", error);
    }

    SM.hasGSAP = typeof window.gsap !== "undefined" && typeof window.ScrollTrigger !== "undefined";

    if (SM.hasGSAP) {
      window.gsap.registerPlugin(window.ScrollTrigger);
      window.gsap.config({ nullTargetWarn: false });
      window.ScrollTrigger.config({ ignoreMobileResize: true });
      splitHeroTitle();
      injectRuntimePatch();
      root.classList.add("js");
    } else {
      console.warn("[SM] GSAP or ScrollTrigger did not load. The page will show without animations.");
    }
  });


  /* -----------------------------------------------------------
     A3. LOADER
     Order 20
     -----------------------------------------------------------
     Counts 000 -> 100 over ~1.2s (and waits for fonts, max 2.5s),
     fades out, adds .is-done, then emits "loaded". */
  SM.register("loader", 20, function () {
    const loader = $("#loader");
    const countEl = $("#loader-count");
    const fill = $("#loader-fill");

    if (!loader) {
      SM.emit("loaded");
      return;
    }

    const reduced = SM.prefersReducedMotion();
    const minDuration = reduced ? 200 : 1200;
    const startTime = performance.now();
    let finished = false;
    let assetsReady = false;

    SM.lockScroll();

    const fontsReady = document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve();
    Promise.race([
      fontsReady,
      new Promise(function (resolve) { setTimeout(resolve, 2500); })
    ]).then(function () { assetsReady = true; });

    function render(progress) {
      if (countEl) { countEl.textContent = String(Math.round(progress * 100)).padStart(3, "0"); }
      if (fill) { fill.style.transform = "scaleX(" + progress + ")"; }
    }

    function finish() {
      if (finished) { return; }
      finished = true;
      render(1);

      function done() {
        loader.classList.add("is-done");
        SM.unlockScroll();
        SM.emit("loaded");
      }

      if (SM.hasGSAP && !reduced) {
        window.gsap.to(loader, { opacity: 0, duration: 0.6, ease: "power2.inOut", onComplete: done });
      } else {
        done();
      }
    }

    function frame(now) {
      if (finished) { return; }
      const t = Math.min((now - startTime) / minDuration, 1);
      const eased = 1 - Math.pow(1 - t, 3);
      render(assetsReady ? eased : Math.min(eased, 0.9));

      if (t >= 1 && assetsReady) {
        finish();
      } else {
        requestAnimationFrame(frame);
      }
    }

    requestAnimationFrame(frame);

    /* Failsafe: the loader can never trap a visitor, even if the tab is
       in the background and animation frames are paused. */
    setTimeout(finish, 6000);
  });


  /* -----------------------------------------------------------
     A4. NAVIGATION — active link, sliding indicator
     Order 30
     ----------------------------------------------------------- */
  SM.register("navigation", 30, function () {
    const links = $$(".nav__link");
    const allNavLinks = $$("[data-nav]");
    const indicator = $("#nav-indicator");
    const list = $("#nav-list");
    const sectionIds = links.map(function (link) { return link.dataset.nav; });
    let currentId = "home";

    function moveIndicator(instant) {
      if (!indicator || !list) { return; }
      const active = links.find(function (link) { return link.dataset.nav === currentId; }) || links[0];
      /* On mobile the pill is display:none, so there is nothing to measure */
      if (!active || !active.offsetWidth) { return; }

      const x = list.offsetLeft + active.offsetLeft;
      if (instant) { indicator.style.transition = "none"; }
      indicator.style.width = active.offsetWidth + "px";
      indicator.style.transform = "translateX(" + x + "px)";
      if (instant) {
        void indicator.offsetWidth;          /* force a reflow so the jump is applied first */
        indicator.style.transition = "";
      }
    }

    function setActive(id) {
      if (!id || id === currentId) { return; }
      currentId = id;
      allNavLinks.forEach(function (link) {
        const isActive = link.dataset.nav === id;
        link.classList.toggle("is-active", isActive);
        if (isActive) {
          link.setAttribute("aria-current", "true");
        } else {
          link.removeAttribute("aria-current");
        }
      });
      moveIndicator(false);
    }

    /* Highlight the section crossing a thin band near the middle of the screen */
    if ("IntersectionObserver" in window) {
      const observer = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) { setActive(entry.target.id); }
        });
      }, { rootMargin: "-45% 0px -54% 0px", threshold: 0 });

      sectionIds.forEach(function (id) {
        const section = document.getElementById(id);
        if (section) { observer.observe(section); }
      });
    }

    /* At the very bottom of the page, always highlight Contact */
    let ticking = false;
    window.addEventListener("scroll", function () {
      if (ticking) { return; }
      ticking = true;
      requestAnimationFrame(function () {
        ticking = false;
        if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4) {
          setActive("contact");
        }
      });
    }, { passive: true });

    window.addEventListener("resize", debounce(function () { moveIndicator(true); }, 120));
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(function () { moveIndicator(true); });
    }
    moveIndicator(true);
  });


  /* -----------------------------------------------------------
     A5. MOBILE MENU
     Order 40
     ----------------------------------------------------------- */
  SM.register("mobile-menu", 40, function () {
    const toggle = $("#nav-toggle");
    const menu = $("#mobile-menu");
    if (!toggle || !menu) { return; }

    const menuLinks = $$(".menu__link", menu);
    const note = $(".menu__note", menu);
    const animated = note ? menuLinks.concat([note]) : menuLinks;
    const pageParts = [$("#main"), $(".footer")].filter(Boolean);
    const desktopQuery = window.matchMedia("(min-width: 901px)");
    let isOpen = false;

    function setPageInert(value) {
      pageParts.forEach(function (part) {
        if (value) { part.setAttribute("inert", ""); } else { part.removeAttribute("inert"); }
      });
    }

    function openMenu() {
      isOpen = true;
      menu.hidden = false;
      toggle.setAttribute("aria-expanded", "true");
      toggle.setAttribute("aria-label", "Close menu");
      SM.lockScroll();
      setPageInert(true);

      if (SM.hasGSAP && !SM.prefersReducedMotion()) {
        window.gsap.fromTo(animated,
          { opacity: 0, y: 36 },
          { opacity: 1, y: 0, duration: 0.7, ease: "power3.out", stagger: 0.07, delay: 0.1, clearProps: "opacity,transform" }
        );
      }
    }

    function closeMenu(returnFocus) {
      if (!isOpen) { return; }
      isOpen = false;
      menu.hidden = true;
      toggle.setAttribute("aria-expanded", "false");
      toggle.setAttribute("aria-label", "Open menu");
      SM.unlockScroll();
      setPageInert(false);

      if (SM.hasGSAP) {
        window.gsap.killTweensOf(animated);
        window.gsap.set(animated, { clearProps: "opacity,transform" });
      }
      if (returnFocus) { toggle.focus(); }
    }

    toggle.addEventListener("click", function () {
      if (isOpen) { closeMenu(false); } else { openMenu(); }
    });

    menuLinks.forEach(function (link) {
      link.addEventListener("click", function () { closeMenu(false); });
    });

    const logo = $(".nav__logo");
    if (logo) { logo.addEventListener("click", function () { closeMenu(false); }); }

    document.addEventListener("keydown", function (event) {
      if (!isOpen) { return; }

      if (event.key === "Escape") {
        event.preventDefault();
        closeMenu(true);
        return;
      }

      /* Keep keyboard focus cycling between the button and the menu links */
      if (event.key === "Tab") {
        const last = menuLinks[menuLinks.length - 1];
        if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          toggle.focus();
        } else if (event.shiftKey && document.activeElement === toggle) {
          event.preventDefault();
          last.focus();
        }
      }
    });

    /* If the window grows to desktop size while the menu is open, close it */
    const onBreakpoint = function (event) { if (event.matches) { closeMenu(false); } };
    if (desktopQuery.addEventListener) {
      desktopQuery.addEventListener("change", onBreakpoint);
    } else if (desktopQuery.addListener) {
      desktopQuery.addListener(onBreakpoint);
    }
  });


  /* -----------------------------------------------------------
     A6. CURRENTLY EXPLORING — rendered from SITE_DATA.exploring
     Order 50 (runs BEFORE scroll animations so the cards get revealed)
     ----------------------------------------------------------- */
  SM.register("exploring", 50, function () {
    const list = $("#exploring-list");
    if (!list) { return; }

    const items = Array.isArray(SITE_DATA.exploring) ? SITE_DATA.exploring : [];
    const valid = items.filter(function (item) { return item && item.title; });
    list.textContent = "";

    if (!valid.length) {
      list.style.display = "none";
      const heading = list.previousElementSibling;
      if (heading && heading.classList.contains("subhead")) { heading.style.display = "none"; }
      return;
    }

    valid.forEach(function (item) {
      const li = document.createElement("li");
      li.className = "explore";

      const title = document.createElement("h4");
      title.className = "explore__title";
      title.textContent = item.title;
      li.appendChild(title);

      if (item.note) {
        const note = document.createElement("p");
        note.className = "explore__note";
        note.textContent = item.note;
        li.appendChild(note);
      }
      list.appendChild(li);
    });
  });


  /* -----------------------------------------------------------
     A7. SKILLS — chip selection + pointer "pull"
     Order 60
     ----------------------------------------------------------- */
  SM.register("skills", 60, function () {
    const field = $("#skills-field");
    const titleEl = $("#skill-title");
    const noteEl = $("#skill-note");
    if (!field || !titleEl || !noteEl) { return; }

    const chips = $$(".chip", field);
    if (!chips.length) { return; }

    let current = chips.find(function (chip) { return chip.classList.contains("is-active"); }) || chips[0];
    chips.forEach(function (chip) { chip.setAttribute("aria-pressed", String(chip === current)); });

    function select(chip) {
      if (!chip || chip === current) { return; }
      current = chip;

      chips.forEach(function (item) {
        const isActive = item === chip;
        item.classList.toggle("is-active", isActive);
        item.setAttribute("aria-pressed", String(isActive));
      });

      titleEl.textContent = chip.dataset.skill || "";
      noteEl.textContent = chip.dataset.note || "";

      if (SM.hasGSAP && !SM.prefersReducedMotion()) {
        window.gsap.fromTo([titleEl, noteEl],
          { opacity: 0, y: 10 },
          { opacity: 1, y: 0, duration: 0.45, ease: "power3.out", stagger: 0.06, overwrite: "auto", clearProps: "opacity,transform" }
        );
      }
    }

    chips.forEach(function (chip) {
      chip.addEventListener("click", function () { select(chip); });
      chip.addEventListener("focus", function () { select(chip); });
      chip.addEventListener("mouseenter", function () {
        if (SM.hasFinePointer()) { select(chip); }
      });
    });

    /* Chips lean gently toward the pointer (mouse only, motion allowed) */
    if (SM.hasGSAP && SM.hasFinePointer() && !SM.prefersReducedMotion()) {
      const gsap = window.gsap;
      const items = $$(":scope > li", field);
      const REACH = 170;     /* px: how close the pointer must be */
      const PULL = 12;       /* px: maximum movement */

      const movers = items.map(function (li) {
        return {
          el: li,
          x: gsap.quickTo(li, "x", { duration: 0.6, ease: "power3.out" }),
          y: gsap.quickTo(li, "y", { duration: 0.6, ease: "power3.out" })
        };
      });

      field.addEventListener("pointermove", function (event) {
        movers.forEach(function (mover) {
          const rect = mover.el.getBoundingClientRect();
          /* subtract the current offset so we measure from the resting position */
          const centerX = rect.left + rect.width / 2 - Number(gsap.getProperty(mover.el, "x"));
          const centerY = rect.top + rect.height / 2 - Number(gsap.getProperty(mover.el, "y"));
          const dx = event.clientX - centerX;
          const dy = event.clientY - centerY;
          const distance = Math.hypot(dx, dy);
          const strength = Math.max(0, 1 - distance / REACH);
          mover.x(distance ? (dx / distance) * PULL * strength : 0);
          mover.y(distance ? (dy / distance) * PULL * strength : 0);
        });
      });

      field.addEventListener("pointerleave", function () {
        movers.forEach(function (mover) { mover.x(0); mover.y(0); });
      });
    }
  });


  /* -----------------------------------------------------------
     A8. PLAYGROUND — live HTML/CSS/JS editor
     Order 70
     -----------------------------------------------------------
     The preview is an <iframe sandbox="allow-scripts"> fed through
     srcdoc, so code typed here can never touch the portfolio page. */
  const PLAYGROUND_PRESETS = {

    orb: {
      html: [
        '<div class="scene">',
        '  <div class="orb" id="orb"></div>',
        '  <p class="label">Move your pointer</p>',
        '</div>'
      ].join("\n"),
      css: [
        '.scene {',
        '  position: relative;',
        '  display: grid;',
        '  place-items: center;',
        '  width: 100%;',
        '  height: 100%;',
        '  overflow: hidden;',
        '}',
        '',
        '.orb {',
        '  --x: 50%;',
        '  --y: 40%;',
        '  --hue: 220;',
        '  width: 160px;',
        '  height: 160px;',
        '  border-radius: 50%;',
        '  background: radial-gradient(circle at var(--x) var(--y),',
        '    hsl(var(--hue) 100% 78%),',
        '    hsl(var(--hue) 90% 48%) 45%,',
        '    #0a1020 100%);',
        '  box-shadow: 0 0 80px hsl(var(--hue) 100% 55% / 0.55);',
        '  animation: breathe 4s ease-in-out infinite;',
        '}',
        '',
        '@keyframes breathe {',
        '  50% { transform: scale(1.08); }',
        '}',
        '',
        '.label {',
        '  position: absolute;',
        '  bottom: 1rem;',
        '  margin: 0;',
        '  font: 12px monospace;',
        '  opacity: 0.6;',
        '}'
      ].join("\n"),
      js: [
        "const orb = document.getElementById('orb');",
        "let targetX = 50, targetY = 40;",
        "let x = 50, y = 40;",
        "",
        "window.addEventListener('pointermove', (event) => {",
        "  targetX = (event.clientX / window.innerWidth) * 100;",
        "  targetY = (event.clientY / window.innerHeight) * 100;",
        "});",
        "",
        "function loop() {",
        "  x += (targetX - x) * 0.08;",
        "  y += (targetY - y) * 0.08;",
        "  orb.style.setProperty('--x', x + '%');",
        "  orb.style.setProperty('--y', y + '%');",
        "  orb.style.setProperty('--hue', 200 + x * 0.6);",
        "  requestAnimationFrame(loop);",
        "}",
        "loop();"
      ].join("\n")
    },

    typing: {
      html: [
        '<h1>',
        '  <span id="text"></span><span class="caret"></span>',
        '</h1>'
      ].join("\n"),
      css: [
        'body {',
        '  display: grid;',
        '  place-items: center;',
        '}',
        '',
        'h1 {',
        '  margin: 0;',
        '  font: 700 clamp(2rem, 9vw, 3.5rem) system-ui, sans-serif;',
        '  letter-spacing: -0.03em;',
        '}',
        '',
        '.caret {',
        '  display: inline-block;',
        '  width: 3px;',
        '  height: 0.9em;',
        '  margin-left: 6px;',
        '  vertical-align: -0.08em;',
        '  background: #6fa0ff;',
        '  animation: blink 1s steps(1) infinite;',
        '}',
        '',
        '@keyframes blink {',
        '  50% { opacity: 0; }',
        '}'
      ].join("\n"),
      js: [
        "const words = ['Build.', 'Break.', 'Learn.', 'Repeat.'];",
        "const el = document.getElementById('text');",
        "let wordIndex = 0;",
        "let charIndex = 0;",
        "let deleting = false;",
        "",
        "function tick() {",
        "  const word = words[wordIndex];",
        "  el.textContent = word.slice(0, charIndex);",
        "",
        "  if (!deleting && charIndex === word.length) {",
        "    deleting = true;",
        "    setTimeout(tick, 1100);",
        "    return;",
        "  }",
        "  if (deleting && charIndex === 0) {",
        "    deleting = false;",
        "    wordIndex = (wordIndex + 1) % words.length;",
        "    setTimeout(tick, 300);",
        "    return;",
        "  }",
        "",
        "  charIndex += deleting ? -1 : 1;",
        "  setTimeout(tick, deleting ? 60 : 110);",
        "}",
        "",
        "tick();"
      ].join("\n")
    },

    flip: {
      html: [
        '<button class="card" id="card" type="button" aria-label="Flip the card">',
        '  <span class="face front">Front<small>click to flip</small></span>',
        '  <span class="face back">Back<small>CSS 3D + JS</small></span>',
        '</button>'
      ].join("\n"),
      css: [
        'body {',
        '  display: grid;',
        '  place-items: center;',
        '  perspective: 900px;',
        '}',
        '',
        '.card {',
        '  position: relative;',
        '  width: 220px;',
        '  height: 140px;',
        '  padding: 0;',
        '  border: 0;',
        '  background: none;',
        '  cursor: pointer;',
        '  transform-style: preserve-3d;',
        '  transition: transform 0.7s cubic-bezier(0.22, 1, 0.36, 1);',
        '}',
        '',
        '.card.flipped {',
        '  transform: rotateY(180deg);',
        '}',
        '',
        '.face {',
        '  position: absolute;',
        '  inset: 0;',
        '  display: grid;',
        '  place-content: center;',
        '  border-radius: 14px;',
        '  color: #fff;',
        '  font: 600 22px system-ui, sans-serif;',
        '  text-align: center;',
        '  backface-visibility: hidden;',
        '  -webkit-backface-visibility: hidden;',
        '}',
        '',
        '.face small {',
        '  display: block;',
        '  margin-top: 6px;',
        '  font: 400 12px monospace;',
        '  opacity: 0.75;',
        '}',
        '',
        '.front {',
        '  background: linear-gradient(145deg, #2f6bff, #0e1830);',
        '  border: 1px solid rgba(111, 160, 255, 0.4);',
        '}',
        '',
        '.back {',
        '  background: linear-gradient(145deg, #0e1830, #6fa0ff);',
        '  transform: rotateY(180deg);',
        '}'
      ].join("\n"),
      js: [
        "const card = document.getElementById('card');",
        "",
        "card.addEventListener('click', () => {",
        "  card.classList.toggle('flipped');",
        "});"
      ].join("\n")
    }
  };

  SM.register("playground", 70, function () {
    const playground = $("#playground");
    const frame = $("#pg-frame");
    if (!playground || !frame) { return; }

    const statusEl = $("#pg-status");
    const tabList = $(".playground__tabs", playground);
    const tabs = $$(".tab", playground);
    const panes = $$(".pane", playground);
    const presetButtons = $$("[data-preset]", playground);
    const runButton = $("#pg-run");
    const resetButton = $("#pg-reset");
    const inputs = {
      html: $("#code-html"),
      css: $("#code-css"),
      js: $("#code-js")
    };
    if (!inputs.html || !inputs.css || !inputs.js) { return; }

    let currentPreset = "orb";
    let started = false;       /* the preview loads once the playground is near the viewport */
    let hadError = false;
    let timer = null;

    function setStatus(text) {
      if (statusEl) { statusEl.textContent = text; }
    }

    /* ---------- Build the document shown in the preview ---------- */
    function buildDocument() {
      const css = inputs.css.value.replace(/<\/style/gi, "<\\/style");
      const js = inputs.js.value.replace(/<\/script/gi, "<\\/script");

      return "<!DOCTYPE html><html><head><meta charset=\"utf-8\">" +
        "<meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">" +
        "<style>html,body{margin:0;height:100%;background:#070b16;color:#e8eeff;" +
        "font-family:system-ui,-apple-system,'Segoe UI',sans-serif}</style>" +
        "<style>" + css + "</style></head><body>" +
        inputs.html.value +
        "<script>window.addEventListener('error',function(e){" +
        "parent.postMessage({source:'sm-playground',type:'error',message:String(e.message||'Script error')},'*');});<\/script>" +
        "<script>" + js + "<\/script></body></html>";
    }

    function run() {
      clearTimeout(timer);
      if (!started) { return; }
      hadError = false;
      setStatus("Updating…");
      frame.srcdoc = buildDocument();
    }

    frame.addEventListener("load", function () {
      if (started && !hadError) { setStatus("Running"); }
    });

    window.addEventListener("message", function (event) {
      if (event.source !== frame.contentWindow) { return; }
      const data = event.data;
      if (data && data.source === "sm-playground" && data.type === "error") {
        hadError = true;
        setStatus("Error: " + String(data.message).slice(0, 60));
      }
    });

    function scheduleRun() {
      setStatus("Typing…");
      clearTimeout(timer);
      timer = setTimeout(run, 450);
    }

    /* ---------- Presets, reset, run ---------- */
    function loadPreset(name) {
      const preset = PLAYGROUND_PRESETS[name];
      if (!preset) { return; }
      currentPreset = name;
      inputs.html.value = preset.html;
      inputs.css.value = preset.css;
      inputs.js.value = preset.js;
      presetButtons.forEach(function (button) {
        button.classList.toggle("is-active", button.dataset.preset === name);
      });
      run();
    }

    presetButtons.forEach(function (button) {
      button.addEventListener("click", function () { loadPreset(button.dataset.preset); });
    });
    if (resetButton) { resetButton.addEventListener("click", function () { loadPreset(currentPreset); }); }
    if (runButton) { runButton.addEventListener("click", run); }

    /* ---------- Tabs (HTML / CSS / JS), with arrow-key support ---------- */
    function activateTab(name, moveFocus) {
      tabs.forEach(function (tab) {
        const isActive = tab.dataset.tab === name;
        tab.classList.toggle("is-active", isActive);
        tab.setAttribute("aria-selected", String(isActive));
        tab.tabIndex = isActive ? 0 : -1;
        if (isActive && moveFocus) { tab.focus(); }
      });
      panes.forEach(function (pane) {
        const isActive = pane.id === "pane-" + name;
        pane.hidden = !isActive;
        pane.classList.toggle("is-active", isActive);
      });
    }

    tabs.forEach(function (tab) {
      tab.addEventListener("click", function () { activateTab(tab.dataset.tab, false); });
    });

    if (tabList) {
      tabList.addEventListener("keydown", function (event) {
        const index = tabs.findIndex(function (tab) { return tab.getAttribute("aria-selected") === "true"; });
        let next = -1;
        if (event.key === "ArrowRight") { next = (index + 1) % tabs.length; }
        if (event.key === "ArrowLeft") { next = (index - 1 + tabs.length) % tabs.length; }
        if (event.key === "Home") { next = 0; }
        if (event.key === "End") { next = tabs.length - 1; }
        if (next >= 0) {
          event.preventDefault();
          activateTab(tabs[next].dataset.tab, true);
        }
      });
    }

    /* ---------- Editor behaviour ----------
       Tab inserts two spaces (like a code editor). To avoid trapping
       keyboard users: press Escape first, and the next Tab moves focus
       out of the editor normally. Shift+Tab always moves focus. */
    let escapePressed = false;
    Object.keys(inputs).forEach(function (key) {
      const area = inputs[key];

      area.addEventListener("input", scheduleRun);

      area.addEventListener("keydown", function (event) {
        if (event.key === "Escape") { escapePressed = true; return; }

        if (event.key === "Tab" && !escapePressed &&
            !event.shiftKey && !event.ctrlKey && !event.metaKey && !event.altKey) {
          event.preventDefault();
          area.setRangeText("  ", area.selectionStart, area.selectionEnd, "end");
          scheduleRun();
          return;
        }

        if (["Shift", "Control", "Alt", "Meta", "Tab"].indexOf(event.key) === -1) {
          escapePressed = false;
        }
      });

      area.addEventListener("blur", function () { escapePressed = false; });
    });

    /* ---------- Start ---------- */
    loadPreset("orb");   /* fills the editors; the preview waits until `started` */

    function start() {
      if (started) { return; }
      started = true;
      run();
    }

    if ("IntersectionObserver" in window) {
      const observer = new IntersectionObserver(function (entries) {
        if (entries.some(function (entry) { return entry.isIntersecting; })) {
          start();
          observer.disconnect();
        }
      }, { rootMargin: "300px 0px" });
      observer.observe(playground);
    } else {
      start();
    }
  });


  /* -----------------------------------------------------------
     A9. SCROLL ANIMATIONS (GSAP + ScrollTrigger)
     Order 80
     -----------------------------------------------------------
     Everything below only runs when GSAP is available. Every reveal
     goes through onView(), which also has a "rescue" pass so nothing
     can stay hidden if ScrollTrigger misses an element. */
  SM.register("scroll-animations", 80, function () {
    const revealSelector = "[data-reveal], .exp, .explore, .slot, .project-card, .playground";
    const revealTargets = Array.from(new Set($$(revealSelector)));

    /* No GSAP -> nothing was hidden (no "js" class). Done. */
    if (!SM.hasGSAP) { return; }

    /* Reduced motion -> show everything immediately, no animation */
    if (SM.prefersReducedMotion()) {
      revealTargets.forEach(function (el) { el.classList.add("is-in"); });
      return;
    }

    const gsap = window.gsap;
    const ScrollTrigger = window.ScrollTrigger;
    const pending = [];

    /* Play `play()` once when `el` scrolls into view */
    function onView(el, play, start) {
      if (!el) { return; }
      let done = false;
      const run = function () {
        if (done) { return; }
        done = true;
        play();
      };
      pending.push({ el: el, run: run, isDone: function () { return done; } });
      ScrollTrigger.create({ trigger: el, start: start || "top 88%", once: true, onEnter: run });
    }
    SM.onView = onView;

    /* --- Cards, panels and [data-reveal] blocks --- */
    function revealItem(el) {
      const siblings = el.parentElement ? Array.prototype.slice.call(el.parentElement.children) : [el];
      const stagger = Math.min(siblings.indexOf(el), 3) * 0.08;

      /* style.css puts a CSS transition on transform for some of these
         (.exp, .project-card). Turn it off while GSAP drives the motion. */
      el.style.transition = "none";
      gsap.to(el, {
        opacity: 1,
        y: 0,
        duration: 0.9,
        delay: stagger,
        ease: "power3.out",
        onComplete: function () {
          el.classList.add("is-in");                         /* takes over the final state */
          gsap.set(el, { clearProps: "opacity,transform" });
          el.style.transition = "";
        }
      });
    }
    revealTargets.forEach(function (el) {
      onView(el, function () { revealItem(el); }, "top 90%");
    });

    /* --- Masked line reveals for big headings (.line > .line__inner) --- */
    $$(".display").forEach(function (heading) {
      const lines = $$(".line__inner", heading);
      if (!lines.length) { return; }
      onView(heading, function () {
        gsap.fromTo(lines,
          { yPercent: 110, y: 0 },
          { yPercent: 0, y: 0, duration: 1.1, ease: "power4.out", stagger: 0.12 }
        );
      }, "top 85%");
    });

    /* --- Section tags, titles and intros --- */
    $$(".section__tag").forEach(function (tag) {
      gsap.set(tag, { opacity: 0, x: -14 });
      onView(tag, function () {
        gsap.to(tag, { opacity: 1, x: 0, duration: 0.8, ease: "power3.out" });
      }, "top 90%");
    });
    $$(".section__title, .section__intro").forEach(function (el) {
      gsap.set(el, { opacity: 0, y: 36 });
      onView(el, function () {
        gsap.to(el, { opacity: 1, y: 0, duration: 1, ease: "power3.out" });
      }, "top 90%");
    });

    /* --- Skill chips float up one after another --- */
    const field = $("#skills-field");
    const chipItems = field ? $$(":scope > li", field) : [];
    if (chipItems.length) {
      /* yPercent (not y) so it never fights with the pointer "pull" effect */
      gsap.set(chipItems, { opacity: 0, yPercent: 60 });
      onView(field, function () {
        gsap.to(chipItems, { opacity: 1, yPercent: 0, duration: 0.9, ease: "power3.out", stagger: 0.08 });
      }, "top 85%");
    }

    /* --- Scroll-linked effects --- */
    const heroTitle = $(".hero__title");
    if (heroTitle) {
      gsap.to(heroTitle, {
        yPercent: -14,
        ease: "none",
        scrollTrigger: { trigger: ".hero", start: "top top", end: "bottom top", scrub: true }
      });
    }
    $$(".about__crosshair").forEach(function (mark, index) {
      gsap.to(mark, {
        rotation: index % 2 === 0 ? 90 : -90,
        ease: "none",
        scrollTrigger: { trigger: "#about", start: "top bottom", end: "bottom top", scrub: true }
      });
    });

    /* --- Keep trigger positions correct as the page settles --- */
    function rescue() {
      pending.forEach(function (item) {
        if (!item.isDone() && item.el.getBoundingClientRect().top < window.innerHeight * 0.92) {
          item.run();
        }
      });
    }

    SM.on("loaded", function () {
      ScrollTrigger.refresh();
      setTimeout(rescue, 1500);

      /* If the URL has a #section, jump to it now that the layout is final */
      if (window.location.hash.length > 1) {
        const target = document.getElementById(decodeURIComponent(window.location.hash.slice(1)));
        if (target) { target.scrollIntoView(); }
      }
    });
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(function () { ScrollTrigger.refresh(); });
    }
    window.addEventListener("load", function () {
      ScrollTrigger.refresh();
      setTimeout(rescue, 800);
    });
  });


  /* -----------------------------------------------------------
     A10. HERO INTRO — runs once the loader has finished
     Order 85
     ----------------------------------------------------------- */
  SM.register("hero-intro", 85, function () {
    if (!SM.hasGSAP || SM.prefersReducedMotion()) { return; }
    const gsap = window.gsap;

    SM.on("loaded", function () {
      const chars = $$(".hero__word .char");
      const content = $$(".hero__content > *");
      const extras = $$(".hero__scroll, .hero__hint");

      const timeline = gsap.timeline({ delay: 0.1, defaults: { ease: "power3.out" } });

      if (chars.length) {
        timeline.fromTo(chars,
          { yPercent: 110, y: 0 },
          { yPercent: 0, y: 0, duration: 1.2, ease: "power4.out", stagger: 0.055 },
          0
        );
      }
      if (content.length) {
        timeline.fromTo(content,
          { opacity: 0, y: 26 },
          { opacity: 1, y: 0, duration: 0.9, stagger: 0.1 },
          0.5
        );
      }
      if (extras.length) {
        timeline.to(extras, { opacity: 1, duration: 0.9 }, 1.1);
      }

      SM.emit("hero-intro-started");
    });
  });

}());

/* ===== END OF PART A — paste Part B directly below this line ===== */
