
/* =============================================================
   SAAD MALIK — PORTFOLIO  |  script.js  |  PART B of 3
   -------------------------------------------------------------
   PART B (this block): the Three.js 3D computer in the hero.
     - dark metallic monitor, stand and keyboard (core geometry only)
     - procedural environment map for believable metal reflections
     - live "developer interface" drawn on the screen (canvas texture)
     - electric-blue lighting, soft shadows, floating particles
     - smooth mouse-follow, idle float, intro, responsive fitting
     - pauses when off-screen / tab hidden, adaptive pixel ratio
     - WebGL fallback -> the CSS monitor already in index.html

   Needs (already in your index.html):
     #hero-stage, #hero-canvas, #hero-fallback, #home
     Three.js r128 (global THREE)  +  Part A (window.SM)
   Registers itself as module "hero-3d" at order 90.
   ============================================================= */
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

/* ===== END OF PART B — Part C goes directly below this line ===== */
