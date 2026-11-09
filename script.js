/* =============================================================
   SAAD MALIK — PORTFOLIO  |  script.js  (final, combined)
   -------------------------------------------------------------
   SITE_DATA ........ the only place you edit content:
                      contact (Gmail / Instagram), exploring, projects
   PART A ........... setup, loader, navigation, mobile menu,
                      exploring list, skills, playground,
                      scroll animations, hero intro
   PART B ........... Three.js 3D computer in the hero
   PART C ........... custom cursor, smooth scrolling, magnetic
                      buttons, card effects, particle + easing demos,
                      project cards, contact links, hero integration,
                      safety net

   Each part is an IIFE that registers modules on window.SM.
   Modules run in order: A 10-85, project cards 55, B 90, C 100-200.
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
    email: "saadiimalik732@gmail.com",
    instagram: "itssaad.dev"
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

/* ---------- PART B: 3D hero ---------- */
(function () {
  "use strict";

  const SM = (window.SM = window.SM || {});
  const $ = SM.$ || function (selector, scope) { return (scope || document).querySelector(selector); };

  /* -----------------------------------------------------------
     B1. SETTINGS — tweak the feel of the scene here
     ----------------------------------------------------------- */
  const CFG = {
    fov: 32,
    maxYaw: 0.5,          /* radians the machine turns left/right with the mouse */
    maxPitch: 0.14,       /* radians the screen tilts up/down with the mouse     */
    follow: 4.5,          /* mouse smoothing: higher = snappier, lower = floatier */
    floorY: -2.72,        /* height of the invisible shadow floor                 */
    introSeconds: 1.8,
    liftDesktop: 0.045,   /* how far above hero-centre the machine sits (fraction  */
    liftMobile: 0.10      /* of visible height). Raise to move it up the page.    */
  };

  function clamp(v, lo, hi) { return Math.min(hi, Math.max(lo, v)); }
  function easeOutCubic(x) { return 1 - Math.pow(1 - x, 3); }

  function pickQuality() {
    const coarse = window.matchMedia("(hover: none), (pointer: coarse)").matches;
    const mobile = coarse || Math.min(window.innerWidth, window.innerHeight) < 600;
    const dpr = window.devicePixelRatio || 1;
    return {
      mobile: mobile,
      maxDPR: mobile ? 1.5 : 2,
      antialias: !(mobile && dpr >= 2),   /* very dense phone screens don't need MSAA */
      shadowSize: mobile ? 512 : 1024,
      particles: mobile ? 90 : 240,
      screenW: mobile ? 768 : 1024,       /* texture size of the on-screen UI, 16:10 */
      screenH: mobile ? 480 : 640,
      screenFps: mobile ? 10 : 15
    };
  }


  /* -----------------------------------------------------------
     B2. FALLBACK — show the pure-CSS monitor already in the HTML
     ----------------------------------------------------------- */
  function showFallback(reason) {
    const canvas = $("#hero-canvas");
    const fallback = $("#hero-fallback");
    console.warn("[SM] 3D hero unavailable, using the CSS fallback:", reason);
    if (canvas) { canvas.style.display = "none"; }
    if (fallback) {
      fallback.hidden = false;
      if (SM.hasGSAP && !SM.prefersReducedMotion()) {
        const monitor = $(".css-monitor", fallback);
        window.gsap.from(fallback, { opacity: 0, duration: 1, ease: "power2.out" });
        if (monitor) {
          window.gsap.to(monitor, { y: -10, duration: 3, ease: "sine.inOut", yoyo: true, repeat: -1 });
        }
      }
    }
    SM.emit("hero3d-fallback");
  }

  function hideFallback() {
    const canvas = $("#hero-canvas");
    const fallback = $("#hero-fallback");
    if (canvas) { canvas.style.display = "block"; }
    if (fallback) { fallback.hidden = true; }
  }


  /* -----------------------------------------------------------
     B3. GEOMETRY HELPERS (r128 has no RoundedBoxGeometry)
     ----------------------------------------------------------- */
  function roundedRect(path, x0, y0, x1, y1, r) {
    path.moveTo(x0 + r, y0);
    path.lineTo(x1 - r, y0);
    path.quadraticCurveTo(x1, y0, x1, y0 + r);
    path.lineTo(x1, y1 - r);
    path.quadraticCurveTo(x1, y1, x1 - r, y1);
    path.lineTo(x0 + r, y1);
    path.quadraticCurveTo(x0, y1, x0, y1 - r);
    path.lineTo(x0, y0 + r);
    path.quadraticCurveTo(x0, y0, x0 + r, y0);
    return path;
  }

  /* A bevelled rounded slab, centred on z. `hole` = [x0,y0,x1,y1,r] cuts a window. */
  function slab(x0, y0, x1, y1, r, depth, bevel, hole) {
    const shape = roundedRect(new THREE.Shape(), x0, y0, x1, y1, r);
    if (hole) {
      shape.holes.push(roundedRect(new THREE.Path(), hole[0], hole[1], hole[2], hole[3], hole[4]));
    }
    const geometry = new THREE.ExtrudeGeometry(shape, {
      depth: depth,
      bevelEnabled: true,
      bevelThickness: bevel,
      bevelSize: bevel,
      bevelOffset: 0,
      bevelSegments: 4,
      curveSegments: 10
    });
    geometry.translate(0, 0, -depth / 2);
    return geometry;
  }

  function glowTexture(size) {
    const c = document.createElement("canvas");
    c.width = c.height = size;
    const g = c.getContext("2d");
    const grad = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    grad.addColorStop(0, "rgba(130,175,255,1)");
    grad.addColorStop(0.35, "rgba(47,107,255,0.45)");
    grad.addColorStop(1, "rgba(47,107,255,0)");
    g.fillStyle = grad;
    g.fillRect(0, 0, size, size);
    const tex = new THREE.CanvasTexture(c);
    tex.encoding = THREE.sRGBEncoding;
    return tex;
  }


  /* -----------------------------------------------------------
     B4. THE SCREEN — a fake developer interface on a 2D canvas
     Authored on a 1024 x 640 grid, scaled to any texture size.
     Static chrome is cached; only the typing/terminal redraws.
     ----------------------------------------------------------- */
  function createDevScreen(W, H) {
    const canvas = document.createElement("canvas");
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext("2d", { alpha: false });
    const chrome = document.createElement("canvas");
    chrome.width = W;
    chrome.height = H;
    const cx = chrome.getContext("2d");
    if (!ctx || !cx) { throw new Error("2D canvas unavailable for the screen texture"); }

    const S = W / 1024;
    const MONO = '"JetBrains Mono", ui-monospace, Menlo, Consolas, monospace';
    const SANS = '"Inter", system-ui, -apple-system, "Segoe UI", sans-serif';
    const C = {
      bg: "#070b16", panel: "#0a1020", panel2: "#0d1630", line: "rgba(111,160,255,0.16)",
      text: "#c9d6f5", dim: "#5d6b8f", blue: "#2f6bff", blueHi: "#6fa0ff",
      kw: "#7aa2ff", fn: "#6fe0ff", cls: "#8fb8ff", str: "#9be39a", num: "#ffb36b",
      com: "#4d5b80", punct: "#8794b8", ok: "#6be39a"
    };

    const CODE = [
      "// hero.js — the machine you are looking at",
      "const { Scene, PerspectiveCamera } = THREE;",
      "",
      "const scene = new Scene();",
      "const camera = new PerspectiveCamera(32, 1.6, 0.1, 60);",
      "",
      "function build() {",
      "  const monitor = createMonitor();",
      "  scene.add(monitor, particles);",
      "  return monitor;",
      "}",
      "",
      "function animate(t) {",
      "  yaw += (mouse.x - yaw) * 0.08;",
      "  renderer.render(scene, camera);",
      "}"
    ];
    const TERM = [
      { t: "$ npm run dev", c: C.text },
      { t: "  starting dev server...", c: C.dim },
      { t: "  ready — http://localhost:3000", c: C.blueHi },
      { t: "  \u2713 compiled with 0 errors", c: C.ok }
    ];

    function tokenize(line) {
      const out = [];
      const re = /(\/\/.*$)|('[^']*'|"[^"]*")|\b(const|let|function|return|new|if|else)\b|\b(\d+(?:\.\d+)?)\b|\b([A-Za-z_$][\w$]*)(?=\()|([A-Za-z_$][\w$]*)|(\s+|.)/g;
      let m;
      while ((m = re.exec(line))) {
        let color = C.punct;
        if (m[1]) { color = C.com; }
        else if (m[2]) { color = C.str; }
        else if (m[3]) { color = C.kw; }
        else if (m[4]) { color = C.num; }
        else if (m[5]) { color = /^[A-Z]/.test(m[5]) ? C.cls : C.fn; }
        else if (m[6]) { color = /^[A-Z]/.test(m[6]) ? C.cls : C.text; }
        out.push({ t: m[0], c: color });
      }
      return out;
    }
    const TOKENS = CODE.map(tokenize);
    const TOTAL = CODE.reduce(function (n, l) { return n + l.length + 1; }, 0);
    const RATE = 55;          /* characters typed per second */
    const TERM_AT = TOTAL / RATE + 0.5;
    const CYCLE = TERM_AT + TERM.length * 0.55 + 6;

    /* Minimap blocks: seeded so they never change between redraws */
    const minimap = [];
    for (let i = 0; i < 40; i += 1) {
      minimap.push(0.25 + ((Math.sin(i * 12.9898) * 43758.5453) % 1 + 1) % 1 * 0.7);
    }

    let chromeDirty = true;

    function drawChrome() {
      cx.setTransform(S, 0, 0, S, 0, 0);
      cx.fillStyle = C.bg;
      cx.fillRect(0, 0, 1024, 640);

      /* title bar */
      cx.fillStyle = C.panel;
      cx.fillRect(0, 0, 1024, 34);
      ["#243257", "#243257", C.blue].forEach(function (col, i) {
        cx.fillStyle = col;
        cx.beginPath();
        cx.arc(20 + i * 18, 17, 5, 0, Math.PI * 2);
        cx.fill();
      });
      cx.fillStyle = C.dim;
      cx.font = "12px " + SANS;
      cx.textAlign = "center";
      cx.fillText("portfolio \u2014 hero.js", 512, 21);
      cx.textAlign = "left";

      /* sidebar */
      cx.fillStyle = C.panel;
      cx.fillRect(0, 34, 180, 580);
      cx.fillStyle = C.dim;
      cx.font = "11px " + MONO;
      cx.fillText("EXPLORER", 16, 62);
      cx.fillStyle = C.text;
      cx.font = "bold 12px " + MONO;
      cx.fillText("\u25BE PORTFOLIO", 16, 88);
      const files = [["index.html", "#ff9b6b"], ["style.css", "#6fa0ff"], ["script.js", "#ffd76b"], ["hero.js", "#ffd76b"], ["assets", "#5d6b8f"]];
      files.forEach(function (f, i) {
        const y = 112 + i * 26;
        if (f[0] === "hero.js") {
          cx.fillStyle = "rgba(47,107,255,0.18)";
          cx.fillRect(0, y - 15, 180, 24);
          cx.fillStyle = C.blue;
          cx.fillRect(0, y - 15, 2, 24);
        }
        cx.fillStyle = f[1];
        cx.fillRect(18, y - 8, 8, 8);
        cx.fillStyle = f[0] === "hero.js" ? "#e8eeff" : C.text;
        cx.font = "13px " + MONO;
        cx.fillText(f[0], 36, y);
      });

      /* tab bar */
      cx.fillStyle = "#080d1a";
      cx.fillRect(180, 34, 844, 32);
      ["hero.js", "index.html", "style.css"].forEach(function (name, i) {
        const x = 180 + i * 128;
        if (i === 0) {
          cx.fillStyle = C.bg;
          cx.fillRect(x, 34, 128, 32);
          cx.fillStyle = C.blue;
          cx.fillRect(x, 34, 128, 2);
        }
        cx.fillStyle = i === 0 ? "#e8eeff" : C.dim;
        cx.font = "12px " + MONO;
        cx.fillText(name, x + 16, 55);
      });

      /* line-number gutter + minimap */
      cx.fillStyle = "rgba(13,22,48,0.5)";
      cx.fillRect(180, 66, 50, 374);
      cx.fillStyle = "rgba(111,160,255,0.16)";
      minimap.forEach(function (w, i) {
        cx.fillRect(986, 78 + i * 8, 30 * w, 3);
      });

      /* terminal panel */
      cx.fillStyle = "#060a14";
      cx.fillRect(180, 440, 844, 174);
      cx.fillStyle = C.line;
      cx.fillRect(180, 440, 844, 1);
      cx.fillStyle = C.blueHi;
      cx.font = "11px " + MONO;
      cx.fillText("TERMINAL", 198, 464);
      cx.fillRect(198, 470, 62, 1);

      /* status bar */
      cx.fillStyle = C.blue;
      cx.fillRect(0, 614, 1024, 26);
      cx.fillStyle = "#ffffff";
      cx.font = "11px " + MONO;
      cx.fillText("main", 14, 631);
      cx.textAlign = "right";
      cx.fillText("Ln 16, Col 2     UTF-8     JavaScript", 1010, 631);
      cx.textAlign = "left";
    }

    function draw(t, still) {
      if (chromeDirty) { drawChrome(); chromeDirty = false; }

      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.globalAlpha = 1;
      ctx.drawImage(chrome, 0, 0);
      ctx.setTransform(S, 0, 0, S, 0, 0);

      const c = still ? 0 : t % CYCLE;
      const typed = still ? TOTAL : Math.min(TOTAL, Math.floor(c * RATE));
      const termCount = still ? TERM.length : (c < TERM_AT ? 0 : Math.min(TERM.length, 1 + Math.floor((c - TERM_AT) / 0.55)));
      const fade = still ? 1 : Math.max(0, Math.min(1, c / 0.4, (CYCLE - c) / 0.4));
      const blink = still || typed < TOTAL || Math.floor(t * 2) % 2 === 0;

      /* editor */
      ctx.save();
      ctx.beginPath();
      ctx.rect(180, 66, 844, 374);
      ctx.clip();
      ctx.globalAlpha = fade;
      ctx.font = "15px " + MONO;
      const cw = ctx.measureText("M").width;
      const x0 = 246;
      const lh = 20;
      let left = typed;
      let caretX = x0;
      let caretY = 98;
      for (let i = 0; i < TOKENS.length; i += 1) {
        const y = 98 + i * lh;
        ctx.fillStyle = C.dim;
        ctx.textAlign = "right";
        ctx.fillText(String(i + 1), 220, y);
        ctx.textAlign = "left";
        let col = 0;
        const line = TOKENS[i];
        for (let k = 0; k < line.length && left > 0; k += 1) {
          const piece = line[k].t.length <= left ? line[k].t : line[k].t.slice(0, left);
          ctx.fillStyle = line[k].c;
          ctx.fillText(piece, x0 + col * cw, y);
          col += piece.length;
          left -= piece.length;
        }
        caretX = x0 + col * cw;
        caretY = y;
        if (left <= 0) { break; }
        left -= 1;
      }
      ctx.fillStyle = "rgba(47,107,255,0.07)";
      ctx.fillRect(230, caretY - 15, 750, lh);
      if (blink) {
        ctx.fillStyle = C.blueHi;
        ctx.fillRect(caretX + 1, caretY - 14, 2, 18);
      }
      ctx.restore();

      /* terminal */
      ctx.globalAlpha = fade;
      ctx.font = "14px " + MONO;
      for (let j = 0; j < termCount; j += 1) {
        ctx.fillStyle = TERM[j].c;
        ctx.fillText(TERM[j].t, 198, 494 + j * 22);
      }
      if (termCount > 0 && termCount === TERM.length && blink) {
        ctx.fillStyle = C.blueHi;
        ctx.fillRect(198, 494 + termCount * 22 - 13, 8, 16);
      }

      /* slow glass sheen that sweeps down the display */
      ctx.globalAlpha = 1;
      const band = ((t * 70) % (640 + 240)) - 120;
      const sheen = ctx.createLinearGradient(0, band, 0, band + 120);
      sheen.addColorStop(0, "rgba(111,160,255,0)");
      sheen.addColorStop(0.5, "rgba(111,160,255,0.05)");
      sheen.addColorStop(1, "rgba(111,160,255,0)");
      ctx.fillStyle = sheen;
      ctx.fillRect(0, band, 1024, 120);
    }

    /* Custom fonts arrive late; redraw the cached chrome once they do */
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(function () { chromeDirty = true; });
    }

    return { canvas: canvas, draw: draw, markDirty: function () { chromeDirty = true; } };
  }


  /* -----------------------------------------------------------
     B5. PARTICLES — GPU-animated floating blue motes
     ----------------------------------------------------------- */
  const PARTICLE_VERT = [
    "uniform float uTime;",
    "uniform float uPx;",
    "uniform float uSpeed;",
    "attribute vec4 aData;",            /* x speed, y size, z phase, w drift */
    "varying float vAlpha;",
    "void main() {",
    "  vec3 p = position;",
    "  float range = 9.0;",
    "  p.y = mod(p.y + uTime * aData.x * uSpeed + range * 0.5, range) - range * 0.5;",
    "  p.x += sin(uTime * 0.35 + aData.z) * aData.w;",
    "  p.z += cos(uTime * 0.28 + aData.z) * aData.w;",
    "  vec4 mv = modelViewMatrix * vec4(p, 1.0);",
    "  gl_Position = projectionMatrix * mv;",
    "  gl_PointSize = max(1.0, aData.y * uPx * (30.0 / -mv.z));",
    "  float edge = 1.0 - smoothstep(0.34, 0.5, abs(p.y / range));",
    "  vAlpha = edge * (0.55 + 0.45 * sin(uTime * 1.4 + aData.z * 3.0));",
    "}"
  ].join("\n");

  const PARTICLE_FRAG = [
    "uniform vec3 uColor;",
    "uniform float uAlpha;",
    "varying float vAlpha;",
    "void main() {",
    "  float d = length(gl_PointCoord - 0.5);",
    "  if (d > 0.5) discard;",
    "  float a = pow(smoothstep(0.5, 0.0, d), 2.0);",
    "  gl_FragColor = vec4(uColor, a * vAlpha * uAlpha);",
    "}"
  ].join("\n");

  function createParticles(count, pixelRatio) {
    const positions = new Float32Array(count * 3);
    const data = new Float32Array(count * 4);
    for (let i = 0; i < count; i += 1) {
      positions[i * 3] = (Math.random() - 0.5) * 15;
      positions[i * 3 + 1] = (Math.random() - 0.5) * 9;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 8;
      data[i * 4] = 0.08 + Math.random() * 0.22;                     /* rise speed */
      data[i * 4 + 1] = Math.random() < 0.12 ? 2.4 : 0.6 + Math.random() * 1.2; /* size */
      data[i * 4 + 2] = Math.random() * Math.PI * 2;                /* phase */
      data[i * 4 + 3] = 0.1 + Math.random() * 0.35;                 /* sideways drift */
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute("aData", new THREE.BufferAttribute(data, 4));

    const uniforms = {
      uTime: { value: 0 },
      uPx: { value: pixelRatio },
      uSpeed: { value: 1 },
      uAlpha: { value: 0 },
      uColor: { value: new THREE.Color(0x5f95ff) }
    };
    const material = new THREE.ShaderMaterial({
      uniforms: uniforms,
      vertexShader: PARTICLE_VERT,
      fragmentShader: PARTICLE_FRAG,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    });
    const points = new THREE.Points(geometry, material);
    points.frustumCulled = false;     /* the vertex shader moves the points */
    return { points: points, uniforms: uniforms, geometry: geometry };
  }


  /* -----------------------------------------------------------
     B6. THE MACHINE — monitor head, stand, keyboard
     ----------------------------------------------------------- */
  function createMaterials(screenTexture) {
    return {
      frame: new THREE.MeshStandardMaterial({ color: 0x151b28, metalness: 0.92, roughness: 0.28, envMapIntensity: 1.25 }),
      metal: new THREE.MeshStandardMaterial({ color: 0x0e131d, metalness: 0.9, roughness: 0.38, envMapIntensity: 1.1 }),
      housing: new THREE.MeshStandardMaterial({ color: 0x0a0e16, metalness: 0.85, roughness: 0.5, envMapIntensity: 1 }),
      key: new THREE.MeshStandardMaterial({ color: 0xffffff, metalness: 0.5, roughness: 0.55, envMapIntensity: 0.8 }),
      led: new THREE.MeshBasicMaterial({ color: 0x5f95ff, toneMapped: false }),
      screen: new THREE.MeshBasicMaterial({ map: screenTexture, toneMapped: false }),
      glass: new THREE.MeshStandardMaterial({
        color: 0xa9c1ff, metalness: 0, roughness: 0.04, transparent: true,
        opacity: 0.1, envMapIntensity: 1.8, depthWrite: false
      })
    };
  }

  function buildHead(mats, glow) {
    const head = new THREE.Group();

    /* front bezel with a window cut for the display */
    const frame = new THREE.Mesh(
      slab(-2.5, -1.7, 2.5, 1.6, 0.14, 0.12, 0.022, [-2.4, -1.5, 2.4, 1.5, 0.05]),
      mats.frame
    );
    frame.castShadow = true;
    head.add(frame);

    /* the display itself, recessed slightly behind the bezel */
    const screen = new THREE.Mesh(new THREE.PlaneGeometry(4.86, 3.06), mats.screen);
    screen.position.z = 0.04;
    head.add(screen);

    /* faint glass layer: catches reflections without hiding the UI */
    const glass = new THREE.Mesh(new THREE.PlaneGeometry(4.8, 3.0), mats.glass);
    glass.position.z = 0.075;
    glass.renderOrder = 3;
    head.add(glass);

    /* rear housing */
    const housing = new THREE.Mesh(slab(-2.42, -1.62, 2.42, 1.52, 0.2, 0.2, 0.05), mats.housing);
    housing.position.z = -0.19;
    housing.castShadow = true;
    head.add(housing);

    /* chin LED */
    const led = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.022, 0.01), mats.led);
    led.position.set(0, -1.6, 0.085);
    head.add(led);

    /* soft blue halo behind the monitor */
    const halo = new THREE.Mesh(
      new THREE.PlaneGeometry(9.5, 6.5),
      new THREE.MeshBasicMaterial({
        map: glow, transparent: true, opacity: 0.32, depthWrite: false,
        blending: THREE.AdditiveBlending, toneMapped: false
      })
    );
    halo.position.z = -1.1;
    halo.renderOrder = 0;
    head.add(halo);

    return head;
  }

  function buildStand(mats) {
    const group = new THREE.Group();

    const neck = new THREE.Mesh(slab(-0.3, -0.68, 0.3, 0.68, 0.06, 0.16, 0.02), mats.metal);
    neck.position.set(0, -1.78, -0.36);
    neck.castShadow = true;
    group.add(neck);

    const base = new THREE.Mesh(slab(-1.3, -0.8, 1.3, 0.8, 0.28, 0.06, 0.03), mats.frame);
    base.rotation.x = -Math.PI / 2;
    base.position.set(0, -2.48, -0.1);
    base.castShadow = true;
    group.add(base);

    const strip = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.018, 0.018), mats.led);
    strip.position.set(0, -2.48, 0.74);
    group.add(strip);

    return group;
  }

  function buildKeyboard(mats) {
    const group = new THREE.Group();

    const plate = new THREE.Mesh(slab(-1.65, -0.62, 1.65, 0.62, 0.12, 0.04, 0.02), mats.frame);
    plate.rotation.x = -Math.PI / 2;
    plate.castShadow = true;
    group.add(plate);

    const cols = 13;
    const rows = 4;
    const keys = new THREE.InstancedMesh(new THREE.BoxGeometry(0.2, 0.045, 0.19), mats.key, cols * rows);
    const dummy = new THREE.Object3D();
    const dark = new THREE.Color(0x0d121c);
    const accent = new THREE.Color(0x1c3d96);
    let n = 0;
    for (let r = 0; r < rows; r += 1) {
      for (let c = 0; c < cols; c += 1) {
        dummy.position.set((c - 6) * 0.245, 0.065, -0.47 + r * 0.235);
        dummy.updateMatrix();
        keys.setMatrixAt(n, dummy.matrix);
        keys.setColorAt(n, (c === 0 && r === 0) || (c === 12 && r === 2) ? accent : dark);
        n += 1;
      }
    }
    keys.instanceMatrix.needsUpdate = true;
    if (keys.instanceColor) { keys.instanceColor.needsUpdate = true; }
    keys.castShadow = true;
    group.add(keys);

    const space = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.045, 0.19), mats.key);
    space.material = mats.key.clone();
    space.material.color.set(0x0d121c);
    space.position.set(0, 0.065, 0.47);
    group.add(space);

    const strip = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.014, 0.014), mats.led);
    strip.position.set(0, 0, 0.655);
    group.add(strip);

    group.position.set(0, -2.52, 2.15);
    group.rotation.x = 0.07;
    return group;
  }


  /* -----------------------------------------------------------
     B7. THE APP — renderer, scene, loop, events
     ----------------------------------------------------------- */
  function createApp(stage, canvas, hero) {
    const q = pickQuality();

    const renderer = new THREE.WebGLRenderer({
      canvas: canvas,
      antialias: q.antialias,
      alpha: true,
      stencil: false,
      powerPreference: "high-performance",
      failIfMajorPerformanceCaveat: true   /* software rendering -> use the CSS fallback */
    });

    try {
      let dprCap = q.maxDPR;
      renderer.setClearColor(0x000000, 0);
      renderer.outputEncoding = THREE.sRGBEncoding;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.05;
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, dprCap));
      canvas.style.display = "block";
      canvas.style.opacity = "0";
      canvas.style.transition = "opacity 1.2s ease";

      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(CFG.fov, 1.6, 0.1, 80);
      const rig = new THREE.Group();        /* shifted up/down to frame the hero */
      const pivot = new THREE.Group();      /* yaw: turns the whole machine      */
      const model = new THREE.Group();      /* float + intro motion              */
      scene.add(rig);
      rig.add(pivot);
      pivot.add(model);

      /* ---- reflections: a tiny studio built once, baked by PMREM ---- */
      let envTarget = null;
      let envOK = false;
      function buildEnvironment() {
        const env = new THREE.Scene();
        env.add(new THREE.Mesh(
          new THREE.BoxGeometry(24, 24, 24),
          new THREE.MeshBasicMaterial({ color: 0x04060b, side: THREE.BackSide })
        ));
        [
          [8, 1.2, [1, 1, 1], 6, [0, 9, 2]],            /* soft white top strip   */
          [1.2, 10, [0.15, 0.45, 1], 7, [-10, 1, 1]],   /* electric blue, left    */
          [1.2, 10, [0.2, 0.5, 1], 6, [10, 1, -1]],     /* electric blue, right   */
          [10, 1, [0.6, 0.8, 1], 2.5, [0, -3, 10]]      /* cool low front strip   */
        ].forEach(function (p) {
          const m = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide });
          m.color.setRGB(p[2][0] * p[3], p[2][1] * p[3], p[2][2] * p[3]);
          const mesh = new THREE.Mesh(new THREE.PlaneGeometry(p[0], p[1]), m);
          mesh.position.set(p[4][0], p[4][1], p[4][2]);
          mesh.lookAt(0, 0, 0);
          env.add(mesh);
        });
        const pmrem = new THREE.PMREMGenerator(renderer);
        const target = pmrem.fromScene(env, 0.04);
        pmrem.dispose();
        env.traverse(function (o) {
          if (o.geometry) { o.geometry.dispose(); }
          if (o.material) { o.material.dispose(); }
        });
        if (envTarget) { envTarget.dispose(); }
        envTarget = target;
        scene.environment = target.texture;
        envOK = true;
      }
      try { buildEnvironment(); } catch (envError) {
        console.warn("[SM] environment map skipped:", envError);
      }

      /* ---- screen + machine ---- */
      const devScreen = createDevScreen(q.screenW, q.screenH);
      const screenTex = new THREE.CanvasTexture(devScreen.canvas);
      screenTex.encoding = THREE.sRGBEncoding;
      screenTex.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy());
      devScreen.draw(0, false);
      screenTex.needsUpdate = true;

      const mats = createMaterials(screenTex);
      const glow = glowTexture(256);
      const head = buildHead(mats, glow);
      const stand = buildStand(mats);
      const keyboard = buildKeyboard(mats);
      model.add(head, stand, keyboard);
      model.position.y = 0;

      /* ---- floor: invisible except for the soft shadow and blue underglow ---- */
      const shadowFloor = new THREE.Mesh(
        new THREE.PlaneGeometry(30, 30),
        new THREE.ShadowMaterial({ opacity: 0.5, color: 0x000000 })
      );
      shadowFloor.rotation.x = -Math.PI / 2;
      shadowFloor.position.y = CFG.floorY;
      shadowFloor.receiveShadow = true;
      shadowFloor.renderOrder = 1;
      rig.add(shadowFloor);

      const floorGlow = new THREE.Mesh(
        new THREE.PlaneGeometry(9, 6),
        new THREE.MeshBasicMaterial({
          map: glow, transparent: true, opacity: 0.5, depthWrite: false,
          blending: THREE.AdditiveBlending, toneMapped: false
        })
      );
      floorGlow.rotation.x = -Math.PI / 2;
      floorGlow.position.set(0, CFG.floorY + 0.01, 0.8);
      floorGlow.renderOrder = 2;
      rig.add(floorGlow);

      /* ---- lights ---- */
      scene.add(new THREE.HemisphereLight(0x3a5ca8, 0x05070d, envOK ? 0.55 : 1.1));

      const key = new THREE.DirectionalLight(0xcfe0ff, 1.25);
      key.position.set(-3, 8, 4);
      key.castShadow = true;
      key.shadow.mapSize.set(q.shadowSize, q.shadowSize);
      key.shadow.camera.left = -6;
      key.shadow.camera.right = 6;
      key.shadow.camera.top = 6;
      key.shadow.camera.bottom = -6;
      key.shadow.camera.near = 1;
      key.shadow.camera.far = 24;
      key.shadow.bias = -0.0004;
      key.shadow.normalBias = 0.03;
      rig.add(key, key.target);

      const rimLeft = new THREE.PointLight(0x2f6bff, 2.4, 16, 2);
      rimLeft.position.set(-5.5, 1.2, -2.5);
      const rimRight = new THREE.PointLight(0x6fa0ff, 1.8, 16, 2);
      rimRight.position.set(5.5, 0.5, -2);
      const screenLight = new THREE.PointLight(0x5b8cff, 1.4, 9, 2);
      screenLight.position.set(0, -0.6, 2.6);
      rig.add(rimLeft, rimRight, screenLight);

      /* ---- particles ---- */
      const fx = createParticles(q.particles, renderer.getPixelRatio());
      scene.add(fx.points);

      /* ---------- sizing ---------- */
      const size = { w: 0, h: 0 };

      function fitCamera() {
        const aspect = camera.aspect;
        const tanHalf = Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2);
        const portrait = aspect < 0.9;
        keyboard.visible = !portrait;            /* keep phones uncluttered */

        const needW = portrait ? 6.3 : 6.9;      /* world units that must fit */
        const needH = portrait ? 5.0 : 7.6;
        const dist = Math.max((needH / 2) / tanHalf, (needW / 2) / (tanHalf * aspect));
        camera.position.set(0, dist * 0.085, dist);
        camera.lookAt(0, 0, 0);

        const visibleH = 2 * dist * tanHalf;
        rig.position.y = 0.4 + visibleH * (portrait ? CFG.liftMobile : CFG.liftDesktop);
      }

      function resize(force) {
        const rect = stage.getBoundingClientRect();
        const w = Math.max(1, Math.round(rect.width));
        const h = Math.max(1, Math.round(rect.height));
        if (!force && w === size.w && h === size.h) { return; }
        size.w = w;
        size.h = h;
        renderer.setSize(w, h, false);
        camera.aspect = w / h;
        fitCamera();
        camera.updateProjectionMatrix();
        fx.uniforms.uPx.value = renderer.getPixelRatio();
        fx.points.scale.x = clamp(camera.aspect / 1.6, 0.6, 1.5);
        if (!isAnimated()) { renderOnce(); }
      }

      let resizeQueued = false;
      function queueResize() {
        if (resizeQueued) { return; }
        resizeQueued = true;
        requestAnimationFrame(function () { resizeQueued = false; resize(false); });
      }

      function applyPixelRatio() {
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, dprCap));
        resize(true);
      }

      /* ---------- state ---------- */
      const pointer = { x: 0, y: 0, tx: 0, ty: 0 };
      let clock = 0;
      let introClock = -1;          /* -1 = intro has not started yet */
      let inView = true;
      let contextLost = false;
      let userPaused = false;
      let running = false;
      let rafId = 0;
      let lastNow = 0;
      let screenAccum = 0;
      let emaDt = 1 / 60;
      let slowFrames = 0;
      let drawCount = q.particles;

      const reducedQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
      function isAnimated() { return !(SM.prefersReducedMotion ? SM.prefersReducedMotion() : reducedQuery.matches); }

      /* ---------- per-frame update ---------- */
      function update(dt) {
        clock += dt;
        const t = clock;
        const animated = isAnimated();

        let intro = 1;
        if (animated) {
          if (introClock >= 0) { introClock += dt; }
          intro = introClock < 0 ? 0 : easeOutCubic(clamp(introClock / CFG.introSeconds, 0, 1));
        }
        const rest = 1 - intro;

        const k = 1 - Math.exp(-dt * CFG.follow);
        pointer.x += (pointer.tx - pointer.x) * k;
        pointer.y += (pointer.ty - pointer.y) * k;

        const idle = animated ? 1 : 0;
        pivot.rotation.y = pointer.x * CFG.maxYaw * idle + Math.sin(t * 0.45) * 0.09 * idle - rest * 0.9;
        head.rotation.x = -pointer.y * CFG.maxPitch * idle + Math.sin(t * 0.6) * 0.012 * idle;
        model.position.y = Math.sin(t * 0.9) * 0.06 * idle - rest * 0.6;
        const s = 0.9 + 0.1 * intro;
        model.scale.set(s, s, s);

        fx.points.rotation.y = t * 0.02 * idle + pointer.x * 0.12 * idle;
        fx.uniforms.uTime.value = t * idle;
        fx.uniforms.uAlpha.value = intro;

        const pulse = Math.sin(t * 1.7) * idle;
        screenLight.intensity = 1.4 + pulse * 0.12;
        rimLeft.intensity = 2.4 + Math.sin(t * 0.8) * 0.25 * idle;
        rimRight.intensity = 1.8 + Math.sin(t * 0.8 + 2) * 0.2 * idle;
        mats.screen.color.setScalar(0.97 + 0.03 * Math.sin(t * 23) * Math.sin(t * 3.1) * idle);

        /* refresh the on-screen UI at a modest rate, not every frame */
        screenAccum += dt;
        if (screenAccum >= 1 / q.screenFps) {
          screenAccum = 0;
          devScreen.draw(t, !animated);
          screenTex.needsUpdate = true;
        }
      }

      function render() { renderer.render(scene, camera); }

      function renderOnce() {
        if (contextLost) { return; }
        update(0.0001);
        devScreen.draw(clock, !isAnimated());
        screenTex.needsUpdate = true;
        render();
      }

      /* ---------- adaptive quality: lower pixel ratio if the GPU struggles ---------- */
      function adapt(dt) {
        if (dt >= 0.1) { return; }            /* ignore tab-resume spikes */
        emaDt += (dt - emaDt) * 0.1;
        slowFrames = emaDt > 0.026 ? slowFrames + 1 : Math.max(0, slowFrames - 1);
        if (slowFrames > 90) {
          slowFrames = 0;
          emaDt = 1 / 60;
          if (dprCap > 1) {
            dprCap = Math.max(1, dprCap - 0.25);
            applyPixelRatio();
          } else if (drawCount > 60) {
            drawCount = Math.floor(drawCount * 0.6);
            fx.geometry.setDrawRange(0, drawCount);
          }
        }
      }

      /* ---------- loop control ---------- */
      function loop(now) {
        if (!running) { return; }
        rafId = requestAnimationFrame(loop);
        const dt = Math.min((now - lastNow) / 1000, 0.1);
        lastNow = now;
        update(dt);
        render();
        adapt(dt);
      }

      function canRun() {
        return !userPaused && !contextLost && inView && !document.hidden && isAnimated();
      }

      function updateRunState() {
        const should = canRun();
        if (should && !running) {
          running = true;
          lastNow = performance.now();
          emaDt = 1 / 60;
          rafId = requestAnimationFrame(loop);
        } else if (!should && running) {
          running = false;
          cancelAnimationFrame(rafId);
        }
        if (!isAnimated() && inView && !contextLost) { renderOnce(); }
      }

      /* ---------- events ---------- */
      function onPointerMove(e) {
        pointer.tx = clamp((e.clientX / window.innerWidth) * 2 - 1, -1, 1);
        pointer.ty = clamp(-((e.clientY / window.innerHeight) * 2 - 1), -1, 1);
      }
      function recentre() { pointer.tx = 0; pointer.ty = 0; }
      function onPointerEnd(e) { if (e.pointerType && e.pointerType !== "mouse") { recentre(); } }

      window.addEventListener("pointermove", onPointerMove, { passive: true });
      window.addEventListener("pointerup", onPointerEnd, { passive: true });
      window.addEventListener("pointercancel", onPointerEnd, { passive: true });
      window.addEventListener("blur", recentre);
      document.documentElement.addEventListener("mouseleave", recentre);
      document.addEventListener("visibilitychange", updateRunState);

      if ("ResizeObserver" in window) {
        new ResizeObserver(queueResize).observe(stage);
      } else {
        window.addEventListener("resize", queueResize);
      }
      window.addEventListener("orientationchange", queueResize);

      if ("IntersectionObserver" in window && hero) {
        new IntersectionObserver(function (entries) {
          inView = entries[0].isIntersecting;
          updateRunState();
        }, { threshold: 0 }).observe(hero);
      }

      if (reducedQuery.addEventListener) {
        reducedQuery.addEventListener("change", updateRunState);
      } else if (reducedQuery.addListener) {
        reducedQuery.addListener(updateRunState);
      }

      /* GPU context loss (common on mobile): swap to the CSS monitor, then back */
      canvas.addEventListener("webglcontextlost", function (e) {
        e.preventDefault();
        contextLost = true;
        updateRunState();
        showFallback("WebGL context lost");
      });
      canvas.addEventListener("webglcontextrestored", function () {
        contextLost = false;
        try { buildEnvironment(); } catch (err) { console.warn("[SM] environment rebuild failed:", err); }
        screenTex.needsUpdate = true;
        hideFallback();
        resize(true);
        updateRunState();
      });

      /* ---------- intro: starts when Part A's loader finishes ---------- */
      let introStarted = false;
      function beginIntro() {
        if (introStarted) { return; }
        introStarted = true;
        introClock = 0;
        canvas.style.opacity = "1";
        if (!isAnimated()) { renderOnce(); }
        updateRunState();
      }

      resize(true);
      renderOnce();                       /* compiles shaders while the loader is still up */
      SM.on("loaded", beginIntro);
      setTimeout(beginIntro, 8000);       /* safety net */

      function dispose() {
        running = false;
        cancelAnimationFrame(rafId);
        window.removeEventListener("pointermove", onPointerMove);
        window.removeEventListener("pointerup", onPointerEnd);
        window.removeEventListener("pointercancel", onPointerEnd);
        window.removeEventListener("blur", recentre);
        document.removeEventListener("visibilitychange", updateRunState);
        scene.traverse(function (o) {
          if (o.geometry) { o.geometry.dispose(); }
          if (o.material) {
            (Array.isArray(o.material) ? o.material : [o.material]).forEach(function (m) { m.dispose(); });
          }
        });
        screenTex.dispose();
        glow.dispose();
        if (envTarget) { envTarget.dispose(); }
        renderer.dispose();
      }

      return {
        renderer: renderer,
        pause: function () { userPaused = true; updateRunState(); },
        resume: function () { userPaused = false; updateRunState(); },
        dispose: dispose
      };
    } catch (error) {
      try { renderer.dispose(); } catch (ignore) { /* nothing to clean up */ }
      throw error;
    }
  }


  /* -----------------------------------------------------------
     B8. REGISTER — runs after Part A's modules (orders 10-85)
     Order 90
     ----------------------------------------------------------- */
  SM.register("hero-3d", 90, function () {
    const stage = $("#hero-stage");
    const canvas = $("#hero-canvas");
    const hero = $("#home");

    if (!stage || !canvas) {
      console.warn("[SM] #hero-stage / #hero-canvas not found, skipping the 3D hero.");
      return;
    }
    if (typeof THREE === "undefined" || !window.WebGLRenderingContext) {
      showFallback("Three.js or WebGL is not available");
      return;
    }

    try {
      SM.hero = createApp(stage, canvas, hero);
      SM.emit("hero3d-ready");
    } catch (error) {
      showFallback(error);
    }
  });

}());

/* =============================================================
   PART C — INTERACTIONS, CARDS, CONTACT, HERO INTEGRATION
   -------------------------------------------------------------
   Custom cursor, smooth anchor scrolling, magnetic buttons,
   card spotlight, tilt card, particle field, easing visualizer,
   project cards, Gmail / Instagram links, hero 3D integration
   and a safety net. Every feature is a module registered with
   SM.register(), so one failure can never stop the others.
   ============================================================= */
(function () {
  "use strict";

  const SM = (window.SM = window.SM || {});
  const root = document.documentElement;
  const $ = SM.$ || function (selector, scope) { return (scope || document).querySelector(selector); };
  const $$ = SM.$$ || function (selector, scope) { return Array.from((scope || document).querySelectorAll(selector)); };

  function clamp(v, lo, hi) { return Math.min(hi, Math.max(lo, v)); }
  function reduced() { return SM.prefersReducedMotion ? SM.prefersReducedMotion() : false; }
  function gsapOK() { return !!(SM.hasGSAP && window.gsap); }

  window.addEventListener("unhandledrejection", function (event) {
    console.warn("[SM] unhandled promise rejection:", event.reason);
  });


  /* -----------------------------------------------------------
     C1. PROJECT CARDS — rendered from SITE_DATA.projects
     Order 55 (before scroll animations at 80, so cards get revealed)
     ----------------------------------------------------------- */
  function safeImage(value) {
    if (typeof value !== "string") { return ""; }
    const raw = value.trim();
    if (!raw) { return ""; }
    if (!/^[a-z][a-z0-9+.-]*:/i.test(raw)) { return raw.indexOf("//") === 0 ? "https:" + raw : raw; }
    try {
      const url = new URL(raw);
      return url.protocol === "https:" || url.protocol === "http:" ? url.href : "";
    } catch (error) { return ""; }
  }

  function safeLink(value) {
    if (typeof value !== "string") { return ""; }
    let raw = value.trim();
    if (!raw) { return ""; }
    if (!/^[a-z][a-z0-9+.-]*:/i.test(raw)) { raw = "https://" + raw.replace(/^\/+/, ""); }
    try {
      const url = new URL(raw);
      return url.protocol === "https:" || url.protocol === "http:" ? url.href : "";
    } catch (error) { return ""; }
  }

  function initials(title) {
    const words = String(title).trim().split(/\s+/).filter(Boolean);
    return (words.length > 1 ? words[0][0] + words[1][0] : String(title).trim().slice(0, 2)).toUpperCase();
  }

  function projectLink(href, label, icon, accent) {
    const a = document.createElement("a");
    a.className = "chip-btn" + (accent ? " chip-btn--accent" : "");
    a.href = href;
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    const i = document.createElement("i");
    i.setAttribute("data-lucide", icon);
    i.setAttribute("aria-hidden", "true");
    const span = document.createElement("span");
    span.textContent = label;
    a.appendChild(i);
    a.appendChild(span);
    return a;
  }

  SM.register("projects", 55, function () {
    const grid = $("#projects-root");
    if (!grid) { return; }
    const list = (Array.isArray(SITE_DATA.projects) ? SITE_DATA.projects : [])
      .filter(function (p) { return p && typeof p.title === "string" && p.title.trim(); });
    if (!list.length) { return; }      /* keep the "coming soon" slots */

    grid.textContent = "";
    list.forEach(function (project) {
      const card = document.createElement("article");
      card.className = "project-card";

      const preview = document.createElement("div");
      preview.className = "project-card__preview";

      function placeholder() {
        const ph = document.createElement("div");
        ph.className = "project-card__placeholder";
        ph.setAttribute("aria-hidden", "true");
        ph.textContent = initials(project.title);
        return ph;
      }

      const src = safeImage(project.image);
      if (src) {
        const img = document.createElement("img");
        img.src = src;
        img.alt = project.title + " preview";
        img.loading = "lazy";
        img.decoding = "async";
        img.addEventListener("error", function () { img.replaceWith(placeholder()); });
        preview.appendChild(img);
      } else {
        preview.appendChild(placeholder());
      }
      card.appendChild(preview);

      const body = document.createElement("div");
      body.className = "project-card__body";
      const title = document.createElement("h4");
      title.className = "project-card__title";
      title.textContent = project.title;
      body.appendChild(title);

      if (project.description) {
        const desc = document.createElement("p");
        desc.className = "project-card__desc";
        desc.textContent = String(project.description);
        body.appendChild(desc);
      }

      if (Array.isArray(project.tech) && project.tech.length) {
        const tech = document.createElement("div");
        tech.className = "project-card__tech";
        project.tech.forEach(function (name) {
          const tag = document.createElement("span");
          tag.className = "tag";
          tag.textContent = String(name);
          tech.appendChild(tag);
        });
        body.appendChild(tech);
      }

      const live = safeLink(project.live);
      const repo = safeLink(project.repo);
      if (live || repo) {
        const links = document.createElement("div");
        links.className = "project-card__links";
        if (live) { links.appendChild(projectLink(live, "Live site", "arrow-up-right", true)); }
        if (repo) { links.appendChild(projectLink(repo, "Source", "github", false)); }
        body.appendChild(links);
      }

      card.appendChild(body);
      grid.appendChild(card);
    });

    const heading = $("#projects-title");
    const note = $("#projects-note");
    if (heading) { heading.textContent = "Projects"; }
    if (note) { note.textContent = "A selection of things I've built, with links where available."; }

    try {
      if (window.lucide && typeof window.lucide.createIcons === "function") { window.lucide.createIcons(); }
    } catch (error) { console.warn("[SM] icons for project cards failed:", error); }
  });


  /* -----------------------------------------------------------
     C2. CUSTOM CURSOR — style.css shows it once .has-cursor is set
     Order 100
     ----------------------------------------------------------- */
  SM.register("cursor", 100, function () {
    const cursor = $("#cursor");
    if (!cursor) { return; }

    const HOVER = "a, button, [role='button'], [data-magnetic], summary, select, input[type='range'], label[for], .chip, .tab, .tilt-card";
    const pos = { x: -100, y: -100, rx: -100, ry: -100, s: 1, rs: 1 };
    let enabled = false;
    let seen = false;
    let rafId = 0;

    function frame() {
      rafId = 0;
      const k = reduced() ? 1 : 0.22;
      pos.rx += (pos.x - pos.rx) * k;
      pos.ry += (pos.y - pos.ry) * k;
      pos.rs += (pos.s - pos.rs) * 0.25;
      cursor.style.transform = "translate3d(" + pos.rx.toFixed(1) + "px," + pos.ry.toFixed(1) + "px,0) scale(" + pos.rs.toFixed(3) + ")";
      if (Math.abs(pos.x - pos.rx) > 0.1 || Math.abs(pos.y - pos.ry) > 0.1 || Math.abs(pos.s - pos.rs) > 0.002) {
        rafId = requestAnimationFrame(frame);
      }
    }
    function kick() { if (!rafId) { rafId = requestAnimationFrame(frame); } }

    function enable() { enabled = true; root.classList.add("has-cursor"); }
    function disable() { enabled = false; root.classList.remove("has-cursor"); }

    window.addEventListener("pointermove", function (event) {
      if (event.pointerType === "touch") { return; }
      pos.x = event.clientX;
      pos.y = event.clientY;
      if (!enabled) { enable(); }
      if (!seen) { seen = true; pos.rx = pos.x; pos.ry = pos.y; }
      cursor.style.opacity = "";
      kick();
    }, { passive: true });

    window.addEventListener("pointerdown", function (event) {
      if (event.pointerType === "touch") { disable(); return; }
      pos.s = 0.78;
      kick();
    }, { passive: true });
    window.addEventListener("pointerup", function () { pos.s = 1; kick(); }, { passive: true });

    document.addEventListener("pointerover", function (event) {
      if (!enabled || !event.target || !event.target.closest) { return; }
      const hit = event.target.closest(HOVER);
      cursor.classList.toggle("is-hover", !!hit && !hit.disabled);
    });

    root.addEventListener("mouseleave", function () { cursor.style.opacity = "0"; });
    root.addEventListener("mouseenter", function () { cursor.style.opacity = ""; });

    /* The playground preview is an iframe: the page stops receiving pointer events there */
    const frameEl = $("#pg-frame");
    if (frameEl) {
      frameEl.addEventListener("pointerenter", function () { cursor.style.opacity = "0"; });
      frameEl.addEventListener("pointerleave", function () { cursor.style.opacity = ""; });
    }
  });


  /* -----------------------------------------------------------
     C3. SMOOTH ANCHOR SCROLLING
     Order 105. One eased scroll for every in-page link (nav, mobile
     menu, hero buttons, footer). Honors reduced motion, can be
     interrupted by the visitor, and moves keyboard focus to the target.
     ----------------------------------------------------------- */
  SM.register("smooth-scroll", 105, function () {
    let rafId = 0;
    let animating = false;

    function ease(t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }

    function stop() {
      if (rafId) { cancelAnimationFrame(rafId); rafId = 0; }
      if (animating) { animating = false; root.style.scrollBehavior = ""; }
    }

    function scrollToY(y, done) {
      stop();
      const start = window.pageYOffset;
      const maxY = Math.max(0, root.scrollHeight - window.innerHeight);
      const end = clamp(Math.round(y), 0, maxY);
      const dist = end - start;

      if (Math.abs(dist) < 2 || reduced()) {
        root.style.scrollBehavior = "auto";     /* CSS has smooth scrolling; avoid double easing */
        window.scrollTo(0, end);
        root.style.scrollBehavior = "";
        if (done) { done(); }
        return;
      }

      const duration = clamp(500 + Math.abs(dist) * 0.35, 800, 1600);
      const t0 = performance.now();
      animating = true;
      root.style.scrollBehavior = "auto";

      function step(now) {
        const t = clamp((now - t0) / duration, 0, 1);
        window.scrollTo(0, start + dist * ease(t));
        if (t < 1 && animating) {
          rafId = requestAnimationFrame(step);
        } else {
          rafId = 0;
          const finished = t >= 1;
          animating = false;
          root.style.scrollBehavior = "";
          if (finished && done) { done(); }
        }
      }
      rafId = requestAnimationFrame(step);
    }

    SM.scrollToY = scrollToY;

    function focusTarget(el) {
      if (!el.hasAttribute("tabindex")) { el.setAttribute("tabindex", "-1"); }
      try { el.focus({ preventScroll: true }); } catch (error) { el.focus(); }
    }

    document.addEventListener("click", function (event) {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) { return; }
      const link = event.target.closest ? event.target.closest('a[href^="#"]') : null;
      if (!link || link.target === "_blank") { return; }

      const hash = link.getAttribute("href");
      let id = "";
      try { id = decodeURIComponent(hash.slice(1)); } catch (error) { return; }
      const target = id ? document.getElementById(id) : null;
      if (!target) { return; }

      event.preventDefault();
      const y = id === "home" ? 0 : target.getBoundingClientRect().top + window.pageYOffset;
      scrollToY(y, function () { focusTarget(target); });
      if (window.location.hash !== hash) {
        try { window.history.pushState(null, "", hash); } catch (error) { /* file:// in some browsers */ }
      }
    });

    /* Any manual scrolling input cancels the animation */
    ["wheel", "touchstart", "keydown"].forEach(function (name) {
      window.addEventListener(name, stop, { passive: true });
    });
  });


  /* -----------------------------------------------------------
     C4. MAGNETIC BUTTONS — hero + contact buttons, and the lab demo
     Order 110
     ----------------------------------------------------------- */
  SM.register("magnetic", 110, function () {
    if (!gsapOK() || reduced()) { return; }
    const gsap = window.gsap;
    const items = [];

    function add(el, inner, reach, strength, innerStrength) {
      if (!el) { return; }
      const item = { el: el, inner: inner, reach: reach, strength: strength, innerStrength: innerStrength, on: false };
      item.x = gsap.quickTo(el, "x", { duration: 0.6, ease: "power3.out" });
      item.y = gsap.quickTo(el, "y", { duration: 0.6, ease: "power3.out" });
      if (inner) {
        item.ix = gsap.quickTo(inner, "x", { duration: 0.6, ease: "power3.out" });
        item.iy = gsap.quickTo(inner, "y", { duration: 0.6, ease: "power3.out" });
      }
      items.push(item);
    }

    $$("[data-magnetic]").forEach(function (el) { add(el, $("span", el), 70, 0.32, 0.5); });
    add($("#magnet-btn"), $(".magnet-btn__label"), 150, 0.42, 0.55);
    if (!items.length) { return; }

    function reset(item) {
      item.on = false;
      item.x(0); item.y(0);
      if (item.ix) { item.ix(0); item.iy(0); }
    }

    let px = 0;
    let py = 0;
    let inside = false;
    let queued = false;

    function update() {
      queued = false;
      items.forEach(function (item) {
        const r = item.el.getBoundingClientRect();
        if (r.bottom < 0 || r.top > window.innerHeight) { if (item.on) { reset(item); } return; }
        /* remove the current offset so we measure from the resting position */
        const cx = r.left + r.width / 2 - (Number(gsap.getProperty(item.el, "x")) || 0);
        const cy = r.top + r.height / 2 - (Number(gsap.getProperty(item.el, "y")) || 0);
        const dx = px - cx;
        const dy = py - cy;
        const radius = Math.max(r.width, r.height) / 2 + item.reach;
        if (inside && Math.hypot(dx, dy) < radius) {
          item.on = true;
          item.x(dx * item.strength);
          item.y(dy * item.strength);
          if (item.ix) { item.ix(dx * item.strength * item.innerStrength); item.iy(dy * item.strength * item.innerStrength); }
        } else if (item.on) {
          reset(item);
        }
      });
    }

    window.addEventListener("pointermove", function (event) {
      if (event.pointerType === "touch") { return; }
      px = event.clientX;
      py = event.clientY;
      inside = true;
      if (!queued) { queued = true; requestAnimationFrame(update); }
    }, { passive: true });

    function leave() { inside = false; items.forEach(function (item) { if (item.on) { reset(item); } }); }
    root.addEventListener("mouseleave", leave);
    window.addEventListener("blur", leave);

    /* Touch screens have no hover, so give the demo button a press response instead */
    const demo = $("#magnet-btn");
    if (demo) {
      demo.addEventListener("click", function () {
        gsap.fromTo(demo, { scale: 0.92 }, { scale: 1, duration: 0.7, ease: "elastic.out(1, 0.45)", overwrite: "auto" });
      });
    }
  });


  /* -----------------------------------------------------------
     C5. CARD SPOTLIGHT + 3D TILT CARD
     Order 120
     ----------------------------------------------------------- */
  function injectCardStyles() {
    if (document.getElementById("sm-card-styles")) { return; }
    const style = document.createElement("style");
    style.id = "sm-card-styles";
    /* A soft blue light follows the pointer inside experiment and project cards.
       The layers repeat each card's original background so nothing else changes. */
    style.textContent =
      "@property --glow { syntax: '<number>'; inherits: false; initial-value: 0; }\n" +
      ".exp, .project-card { --glow: 0; }\n" +
      ".exp:hover, .project-card:hover { --glow: 1; }\n" +
      ".exp { background: radial-gradient(380px circle at var(--mx, 50%) var(--my, 50%), rgba(47,107,255,calc(var(--glow) * 0.16)), transparent 70%)," +
      " linear-gradient(180deg, var(--surface), rgba(10,16,32,0.4));" +
      " transition: border-color 0.4s var(--ease), transform 0.4s var(--ease), --glow 0.5s var(--ease); }\n" +
      ".project-card { background: radial-gradient(380px circle at var(--mx, 50%) var(--my, 50%), rgba(47,107,255,calc(var(--glow) * 0.16)), transparent 70%), var(--surface);" +
      " transition: border-color 0.4s var(--ease), transform 0.5s var(--ease), box-shadow 0.5s var(--ease), --glow 0.5s var(--ease); }\n";
    document.head.appendChild(style);
  }

  SM.register("cards", 120, function () {
    injectCardStyles();

    document.addEventListener("pointermove", function (event) {
      if (event.pointerType === "touch" || !event.target || !event.target.closest) { return; }
      const card = event.target.closest(".exp, .project-card");
      if (!card) { return; }
      const r = card.getBoundingClientRect();
      card.style.setProperty("--mx", (event.clientX - r.left).toFixed(0) + "px");
      card.style.setProperty("--my", (event.clientY - r.top).toFixed(0) + "px");
    }, { passive: true });

    /* ----- 3D tilt card (style.css reads --rx --ry --mx --my) ----- */
    const stage = $("#tilt-stage");
    const card = $("#tilt-card");
    if (!stage || !card) { return; }
    const MAX = 14;
    let kx = 0;
    let ky = 0;

    function setTilt(nx, ny) {
      card.style.setProperty("--ry", (nx * MAX).toFixed(2) + "deg");
      card.style.setProperty("--rx", (-ny * MAX).toFixed(2) + "deg");
      card.style.setProperty("--mx", ((nx + 1) * 50).toFixed(1) + "%");
      card.style.setProperty("--my", ((ny + 1) * 50).toFixed(1) + "%");
    }
    function resetTilt() {
      kx = 0; ky = 0;
      ["--rx", "--ry"].forEach(function (name) { card.style.setProperty(name, "0deg"); });
      ["--mx", "--my"].forEach(function (name) { card.style.setProperty(name, "50%"); });
    }

    card.style.touchAction = "pan-y";     /* vertical scrolling still works on touch */
    stage.addEventListener("pointermove", function (event) {
      if (reduced()) { return; }
      const r = card.getBoundingClientRect();
      setTilt(
        clamp((event.clientX - (r.left + r.width / 2)) / (r.width / 2), -1, 1),
        clamp((event.clientY - (r.top + r.height / 2)) / (r.height / 2), -1, 1)
      );
    });
    stage.addEventListener("pointerleave", resetTilt);
    stage.addEventListener("pointercancel", resetTilt);
    stage.addEventListener("pointerup", function (event) { if (event.pointerType !== "mouse") { resetTilt(); } });

    /* Keyboard: arrow keys tilt the card, Home resets it */
    card.addEventListener("keydown", function (event) {
      if (reduced()) { return; }
      const step = 0.5;
      if (event.key === "ArrowLeft") { kx = clamp(kx - step, -1, 1); }
      else if (event.key === "ArrowRight") { kx = clamp(kx + step, -1, 1); }
      else if (event.key === "ArrowUp") { ky = clamp(ky - step, -1, 1); }
      else if (event.key === "ArrowDown") { ky = clamp(ky + step, -1, 1); }
      else if (event.key === "Home") { event.preventDefault(); resetTilt(); return; }
      else { return; }
      event.preventDefault();
      setTilt(kx, ky);
    });
    card.addEventListener("blur", resetTilt);
  });


  /* -----------------------------------------------------------
     C6. PARTICLE FIELD EXPERIMENT (canvas 2D)
     Order 130
     ----------------------------------------------------------- */
  SM.register("particles", 130, function () {
    const canvas = $("#particle-canvas");
    if (!canvas) { return; }
    const ctx = canvas.getContext("2d");
    if (!ctx) { return; }

    const countInput = $("#particle-count");
    const speedInput = $("#particle-speed");
    const countOut = $("#particle-count-out");
    const speedOut = $("#particle-speed-out");

    const state = { w: 0, h: 0, dpr: 1, speed: 1, list: [] };
    const pointer = { x: 0, y: 0, active: false };
    const RADIUS = 120;
    let running = false;
    let inView = false;
    let rafId = 0;
    let last = 0;

    canvas.style.display = "block";
    canvas.style.touchAction = "pan-y";

    function rand(a, b) { return a + Math.random() * (b - a); }
    function make() {
      const angle = Math.random() * Math.PI * 2;
      const speed = rand(14, 38);
      return { x: rand(0, state.w), y: rand(0, state.h), vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, ox: 0, oy: 0, r: rand(1, 2.2) };
    }
    function setCount(n) {
      while (state.list.length < n) { state.list.push(make()); }
      if (state.list.length > n) { state.list.length = n; }
    }

    function resize() {
      const rect = canvas.getBoundingClientRect();
      const w = Math.max(1, Math.round(rect.width));
      const h = Math.max(1, Math.round(rect.height));
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      if (w === state.w && h === state.h && dpr === state.dpr) { return; }
      const first = state.w === 0;
      state.w = w; state.h = h; state.dpr = dpr;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      state.list.forEach(function (p) {
        if (first) { p.x = rand(0, w); p.y = rand(0, h); } else { p.x = Math.min(p.x, w); p.y = Math.min(p.y, h); }
      });
      if (!running) { draw(); }
    }

    function step(dt) {
      const w = state.w;
      const h = state.h;
      const decay = Math.exp(-3 * dt);
      state.list.forEach(function (p) {
        p.x += (p.vx * state.speed + p.ox) * dt;
        p.y += (p.vy * state.speed + p.oy) * dt;
        if (p.x < 0) { p.x = 0; p.vx = Math.abs(p.vx); } else if (p.x > w) { p.x = w; p.vx = -Math.abs(p.vx); }
        if (p.y < 0) { p.y = 0; p.vy = Math.abs(p.vy); } else if (p.y > h) { p.y = h; p.vy = -Math.abs(p.vy); }
        p.ox *= decay;
        p.oy *= decay;
        if (pointer.active) {
          const dx = p.x - pointer.x;
          const dy = p.y - pointer.y;
          const d2 = dx * dx + dy * dy;
          if (d2 < RADIUS * RADIUS && d2 > 0.01) {
            const d = Math.sqrt(d2);
            const f = (1 - d / RADIUS) * 900 * dt;
            p.ox += (dx / d) * f;
            p.oy += (dy / d) * f;
          }
        }
      });
    }

    function draw() {
      const w = state.w;
      const h = state.h;
      const list = state.list;
      const n = list.length;
      ctx.clearRect(0, 0, w, h);

      /* link distance scales with density so the look stays similar at any count */
      const link = clamp(Math.sqrt((w * h) / Math.max(1, n)) * 1.9, 40, 80);
      const link2 = link * link;
      const buckets = [[], [], [], []];
      for (let i = 0; i < n; i += 1) {
        for (let j = i + 1; j < n; j += 1) {
          const dx = list[i].x - list[j].x;
          const dy = list[i].y - list[j].y;
          const d2 = dx * dx + dy * dy;
          if (d2 < link2) {
            buckets[Math.min(3, Math.floor((1 - d2 / link2) * 4))].push(list[i].x, list[i].y, list[j].x, list[j].y);
          }
        }
      }
      ctx.lineWidth = 1;
      buckets.forEach(function (segs, b) {
        if (!segs.length) { return; }
        ctx.strokeStyle = "rgba(111,160,255," + (0.08 + b * 0.09).toFixed(2) + ")";
        ctx.beginPath();
        for (let k = 0; k < segs.length; k += 4) {
          ctx.moveTo(segs[k], segs[k + 1]);
          ctx.lineTo(segs[k + 2], segs[k + 3]);
        }
        ctx.stroke();
      });

      if (pointer.active) {
        ctx.strokeStyle = "rgba(160,196,255,0.45)";
        ctx.beginPath();
        list.forEach(function (p) {
          const dx = p.x - pointer.x;
          const dy = p.y - pointer.y;
          if (dx * dx + dy * dy < 130 * 130) { ctx.moveTo(pointer.x, pointer.y); ctx.lineTo(p.x, p.y); }
        });
        ctx.stroke();
      }

      ctx.fillStyle = "rgba(143,184,255,0.9)";
      ctx.beginPath();
      list.forEach(function (p) { ctx.moveTo(p.x + p.r, p.y); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); });
      ctx.fill();
    }

    function loop(now) {
      if (!running) { return; }
      rafId = requestAnimationFrame(loop);
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      step(dt);
      draw();
    }

    function sync() {
      const should = inView && !document.hidden && !reduced();
      if (should && !running) {
        running = true;
        last = performance.now();
        rafId = requestAnimationFrame(loop);
      } else if (!should && running) {
        running = false;
        cancelAnimationFrame(rafId);
      }
      if (!should) { draw(); }
    }

    function readControls() {
      const n = clamp(parseInt(countInput && countInput.value, 10) || 80, 20, 200);
      const s = clamp(parseFloat(speedInput && speedInput.value) || 1, 0.2, 3);
      state.speed = s;
      setCount(n);
      if (countOut) { countOut.textContent = String(n); }
      if (speedOut) { speedOut.textContent = s.toFixed(1); }
      if (!running && state.w) { draw(); }
    }
    if (countInput) { countInput.addEventListener("input", readControls); }
    if (speedInput) { speedInput.addEventListener("input", readControls); }

    function setPointer(event) {
      const r = canvas.getBoundingClientRect();
      pointer.x = event.clientX - r.left;
      pointer.y = event.clientY - r.top;
      pointer.active = true;
    }
    canvas.addEventListener("pointermove", setPointer);
    canvas.addEventListener("pointerleave", function () { pointer.active = false; if (!running) { draw(); } });
    canvas.addEventListener("pointercancel", function () { pointer.active = false; });
    canvas.addEventListener("pointerup", function (event) { if (event.pointerType !== "mouse") { pointer.active = false; } });
    canvas.addEventListener("pointerdown", function (event) {
      setPointer(event);
      state.list.forEach(function (p) {          /* click / tap: small burst */
        const dx = p.x - pointer.x;
        const dy = p.y - pointer.y;
        const d = Math.hypot(dx, dy);
        if (d < 150 && d > 0.01) { p.ox += (dx / d) * 260 * (1 - d / 150); p.oy += (dy / d) * 260 * (1 - d / 150); }
      });
    });

    readControls();
    resize();
    if ("ResizeObserver" in window) { new ResizeObserver(resize).observe(canvas); } else { window.addEventListener("resize", resize); }
    document.addEventListener("visibilitychange", sync);

    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (mq.addEventListener) { mq.addEventListener("change", sync); } else if (mq.addListener) { mq.addListener(sync); }

    if ("IntersectionObserver" in window) {
      new IntersectionObserver(function (entries) {
        inView = entries[0].isIntersecting;
        sync();
      }, { threshold: 0.05 }).observe(canvas);
    } else {
      inView = true;
      sync();
    }
  });


  /* -----------------------------------------------------------
     C7. EASING VISUALIZER EXPERIMENT
     Order 140. Uses GSAP's own ease functions when available and a
     small built-in set otherwise, so the demo always works.
     ----------------------------------------------------------- */
  const EASE_FALLBACK = {
    "none": function (t) { return t; },
    "power1.out": function (t) { return 1 - Math.pow(1 - t, 2); },
    "power2.inOut": function (t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; },
    "power4.out": function (t) { return 1 - Math.pow(1 - t, 5); },
    "expo.out": function (t) { return t >= 1 ? 1 : 1 - Math.pow(2, -10 * t); },
    "back.out(1.7)": function (t) { const s = 1.7; const u = t - 1; return u * u * ((s + 1) * u + s) + 1; },
    "elastic.out(1, 0.4)": function (t) {
      if (t <= 0) { return 0; }
      if (t >= 1) { return 1; }
      return Math.pow(2, -10 * t) * Math.sin((t - 0.1) * (2 * Math.PI) / 0.4) + 1;
    },
    "bounce.out": function (t) {
      const n = 7.5625;
      const d = 2.75;
      if (t < 1 / d) { return n * t * t; }
      if (t < 2 / d) { t -= 1.5 / d; return n * t * t + 0.75; }
      if (t < 2.5 / d) { t -= 2.25 / d; return n * t * t + 0.9375; }
      t -= 2.625 / d;
      return n * t * t + 0.984375;
    }
  };

  SM.register("easing", 140, function () {
    const select = $("#ease-select");
    const playBtn = $("#ease-play");
    const curve = $("#ease-curve");
    const dot = $("#ease-dot");
    const ball = $("#ease-ball");
    if (!select || !curve || !dot || !ball) { return; }
    const track = ball.parentElement;
    let rafId = 0;

    function getEase(name) {
      if (gsapOK() && typeof window.gsap.parseEase === "function") {
        try {
          const fn = window.gsap.parseEase(name);
          if (typeof fn === "function") { return fn; }
        } catch (error) { /* use the fallback below */ }
      }
      return EASE_FALLBACK[name] || EASE_FALLBACK.none;
    }

    function drawCurve(fn) {
      let d = "";
      for (let i = 0; i <= 64; i += 1) {
        const t = i / 64;
        const x = 10 + 180 * t;
        const y = clamp(110 - 100 * fn(t), -40, 160);
        d += (i ? " L " : "M ") + x.toFixed(2) + " " + y.toFixed(2);
      }
      curve.setAttribute("d", d);
    }

    function place(t, v, range) {
      dot.setAttribute("cx", (10 + 180 * t).toFixed(2));
      dot.setAttribute("cy", clamp(110 - 100 * v, -40, 160).toFixed(2));
      ball.style.transform = "translateX(" + (v * range).toFixed(1) + "px)";
    }

    function play() {
      cancelAnimationFrame(rafId);
      const fn = getEase(select.value);
      const range = Math.max(0, track.clientWidth - ball.offsetWidth);
      if (reduced()) { place(1, 1, range); return; }
      const duration = 1800;
      place(0, fn(0), range);
      const t0 = performance.now();
      function step(now) {
        const t = clamp((now - t0) / duration, 0, 1);
        place(t, fn(t), range);
        if (t < 1) { rafId = requestAnimationFrame(step); }
      }
      rafId = requestAnimationFrame(step);
    }

    function drawIn() {
      if (!gsapOK() || reduced() || typeof curve.getTotalLength !== "function") { return; }
      const len = curve.getTotalLength();
      if (!len) { return; }
      curve.style.strokeDasharray = String(len);
      window.gsap.fromTo(curve, { strokeDashoffset: len }, {
        strokeDashoffset: 0, duration: 0.7, ease: "power2.out", overwrite: "auto",
        onComplete: function () { curve.style.strokeDasharray = ""; curve.style.strokeDashoffset = ""; }
      });
    }

    select.addEventListener("change", function () { drawCurve(getEase(select.value)); drawIn(); play(); });
    if (playBtn) { playBtn.addEventListener("click", play); }

    drawCurve(getEase(select.value));
    place(0, 0, 0);

    /* play once, the first time the experiment scrolls into view */
    if ("IntersectionObserver" in window) {
      const observer = new IntersectionObserver(function (entries) {
        if (entries.some(function (entry) { return entry.isIntersecting; })) { observer.disconnect(); play(); }
      }, { threshold: 0.6 });
      observer.observe(track);
    }
  });


  /* -----------------------------------------------------------
     C8. CONTACT — Gmail and Instagram, filled from SITE_DATA.contact
     Order 150. Empty values keep the "Placeholder" badges.
     ----------------------------------------------------------- */
  function parseInstagram(value) {
    if (typeof value !== "string") { return ""; }
    let v = value.trim();
    if (!v) { return ""; }
    const match = v.match(/instagram\.com\/([A-Za-z0-9._]+)/i);
    if (match) { v = match[1]; }
    v = v.replace(/^@/, "").replace(/\/+$/, "");
    return /^[A-Za-z0-9._]{1,30}$/.test(v) ? v : "";
  }

  SM.register("contact", 150, function () {
    const cfg = (SITE_DATA && SITE_DATA.contact) || {};
    const email = typeof cfg.email === "string" ? cfg.email.trim() : "";
    const emailOK = /^[^\s@<>"']+@[^\s@<>"']+\.[^\s@<>"']+$/.test(email);
    const insta = parseInstagram(cfg.instagram);

    const cta = $("#contact-cta");
    const gmailLink = $("#link-gmail");
    const gmailText = $("#gmail-text");
    const gmailBadge = $("#gmail-badge");
    const igLink = $("#link-instagram");
    const igText = $("#instagram-text");
    const igBadge = $("#instagram-badge");

    function hide(el) { if (el) { el.hidden = true; el.style.display = "none"; } }

    function nudge(badge) {
      console.info("[SM] Contact links are placeholders. Set SITE_DATA.contact.email and .instagram at the top of script.js.");
      if (badge && gsapOK() && !reduced()) {
        window.gsap.fromTo(badge, { x: -5 }, { x: 0, duration: 0.6, ease: "elastic.out(1, 0.3)", overwrite: "auto" });
      }
    }
    function block(link, badge) {
      if (!link) { return; }
      link.addEventListener("click", function (event) { event.preventDefault(); nudge(badge); });
    }

    if (emailOK) {
      const mailto = "mailto:" + email + "?subject=" + encodeURIComponent("Hello Saad");
      if (cta) { cta.href = mailto; }
      if (gmailLink) {
        gmailLink.href = mailto;
        gmailLink.setAttribute("aria-label", "Email " + email);
        /* On desktop, open Gmail's compose window; touch devices keep mailto (opens the mail app) */
        gmailLink.addEventListener("click", function (event) {
          if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || !SM.hasFinePointer()) { return; }
          event.preventDefault();
          const url = "https://mail.google.com/mail/?view=cm&fs=1&to=" + encodeURIComponent(email) + "&su=" + encodeURIComponent("Hello Saad");
          const win = window.open(url, "_blank");
          if (win) { win.opener = null; } else { window.location.href = mailto; }
        });
      }
      if (gmailText) { gmailText.textContent = email; }
      hide(gmailBadge);
    } else {
      block(cta, gmailBadge);
      block(gmailLink, gmailBadge);
    }

    if (insta) {
      if (igLink) {
        igLink.href = "https://www.instagram.com/" + insta + "/";
        igLink.setAttribute("aria-label", "Instagram: @" + insta);
      }
      if (igText) { igText.textContent = "@" + insta; }
      hide(igBadge);
    } else {
      block(igLink, igBadge);
    }
  });


  /* -----------------------------------------------------------
     C9. HERO INTEGRATION — ties the 3D computer (Part B) to the page
     Order 170
     ----------------------------------------------------------- */
  SM.register("hero-integration", 170, function () {
    const hero = $("#home");
    if (!hero) { return; }

    /* 1. Stop rendering the 3D scene while the full-screen mobile menu covers it */
    const menu = $("#mobile-menu");
    if (menu && "MutationObserver" in window) {
      new MutationObserver(function () {
        if (!SM.hero) { return; }
        if (menu.hidden) { SM.hero.resume(); } else { SM.hero.pause(); }
      }).observe(menu, { attributes: true, attributeFilter: ["hidden"] });
    }

    if (!gsapOK() || reduced()) { return; }
    const gsap = window.gsap;

    /* 2. Scroll depth: the 3D canvas drifts down and shrinks slightly as the hero leaves */
    const canvas = $("#hero-canvas");
    if (canvas && window.ScrollTrigger) {
      gsap.to(canvas, {
        yPercent: 6, scale: 0.94, ease: "none",
        scrollTrigger: { trigger: hero, start: "top top", end: "bottom top", scrub: true }
      });
    }

    /* 3. Pointer depth: title, glow and the CSS fallback monitor drift at different speeds
          (mouse only; the 3D machine itself follows the pointer inside Part B) */
    if (SM.hasFinePointer()) {
      const title = $(".hero__title", hero);
      const glow = $(".hero__glow", hero);
      const monitor = $(".css-monitor", hero);
      /* the glow is centred with a CSS transform; hand that over to GSAP unchanged */
      if (glow) { gsap.set(glow, { xPercent: -50, yPercent: -50, x: 0, y: 0 }); }
      if (monitor) { gsap.set(monitor, { transformPerspective: 900 }); }

      const opts = { duration: 1.1, ease: "power3.out" };
      const tx = title ? gsap.quickTo(title, "x", opts) : null;
      const ty = title ? gsap.quickTo(title, "y", opts) : null;
      const gx = glow ? gsap.quickTo(glow, "x", opts) : null;
      const gy = glow ? gsap.quickTo(glow, "y", opts) : null;
      const mx = monitor ? gsap.quickTo(monitor, "rotationY", opts) : null;
      const my = monitor ? gsap.quickTo(monitor, "rotationX", opts) : null;
      let heroVisible = true;

      if ("IntersectionObserver" in window) {
        new IntersectionObserver(function (entries) { heroVisible = entries[0].isIntersecting; }).observe(hero);
      }

      window.addEventListener("pointermove", function (event) {
        if (event.pointerType === "touch" || !heroVisible) { return; }
        const nx = (event.clientX / window.innerWidth) * 2 - 1;
        const ny = (event.clientY / window.innerHeight) * 2 - 1;
        if (tx) { tx(-nx * 18); ty(-ny * 10); }
        if (gx) { gx(nx * 40); gy(ny * 28); }
        if (mx) { mx(nx * 10); my(-ny * 6); }
      }, { passive: true });
    }

    /* 4. The "move your cursor" hint fades once the visitor has found the interaction */
    const hint = $("#hero-hint");
    if (hint && SM.hasFinePointer()) {
      let faded = false;
      window.addEventListener("pointermove", function (event) {
        if (faded || event.pointerType === "touch" || !SM.flags.loaded) { return; }
        faded = true;
        gsap.to(hint, { opacity: 0, duration: 1, delay: 3.5, ease: "power2.out" });
      }, { passive: true });
    }
  });


  /* -----------------------------------------------------------
     C10. RESPONSIVE REFRESH + SAFETY NET
     Order 200
     ----------------------------------------------------------- */
  SM.register("safety-net", 200, function () {
    if (typeof THREE === "undefined") { console.warn("[SM] Three.js did not load; the CSS monitor is shown instead."); }
    if (!SM.hasGSAP) { console.warn("[SM] GSAP did not load; the page is shown without animations."); }

    if (SM.hasGSAP && window.ScrollTrigger) {
      const refresh = SM.debounce(function () { window.ScrollTrigger.refresh(); }, 250);
      window.addEventListener("orientationchange", function () { setTimeout(refresh, 300); });
      window.addEventListener("resize", refresh);

      /* If no scroll animation was created, the reveal system failed: never leave content hidden */
      SM.on("loaded", function () {
        setTimeout(function () {
          if (!reduced() && root.classList.contains("js") && window.ScrollTrigger.getAll().length === 0) {
            console.warn("[SM] Scroll animations did not start; showing the page without them.");
            root.classList.remove("js");
          }
        }, 2500);
      });
    }
  });

}());

/* ===== END OF script.js ===== */
