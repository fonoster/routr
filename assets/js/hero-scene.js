/* routr.io — hero use-case scene.
   The dot devices are a small 3D model (generated from designs/website.pen's hero);
   this file re-projects them live so the scene tilts with the cursor (yaw ±8°, pitch ±5°).
   Static fallback: assets/img/hero-usecases.png (shown when JS or canvas is unavailable;
   with prefers-reduced-motion the canvas renders once and never moves). */
(() => {
  "use strict";

  const mount = document.querySelector("[data-scene]");
  const DATA = window.__ROUTR_SCENE__;
  if (!mount || !DATA) return;
  const canvas = mount.querySelector("canvas");
  if (!canvas || !canvas.getContext) return;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const doc = document.documentElement;
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------- Palettes (dark is the source artwork; light is its inverse) ---------- */
  const LIGHT_MAP = {
    "#D9FBFA": "#0F5453",
    "#6ED9D8": "#1F8F8E",
    "#2F7E7D": "#A8E6E5",
    "#FFFFFF": "#001A1A",
    "#9FEDEC": "#116665",
    "#5FCFCE": "#1F8F8E"
  };
  const theme = () => (doc.dataset.theme === "light" ? "light" : "dark");
  const palette = () => {
    const light = theme() === "light";
    return {
      dot: DATA.pal.map((c) => (light ? LIGHT_MAP[c] || c : c)),
      line: light ? "rgba(31, 143, 142, 0.4)" : "rgba(95, 207, 206, 0.35)",
      halo: light ? "rgba(95, 207, 206, 0.2)" : "rgba(95, 207, 206, 0.3)",
      hubDot: light ? "#1F8F8E" : "#5FCFCE",
      floor: light ? "rgba(0, 0, 0, 1)" : "rgba(255, 255, 255, 1)",
      sos: light ? "#F0FDFF" : "#0B3D3D",
      ast: light ? "#CFF5F4" : "#0A4A49"
    };
  };

  /* ---------- Projection (identical to the generator) ---------- */
  const U = DATA.U;
  const CC = Math.cos(Math.PI / 6);
  const SS = 0.5;
  const [PX, PY, PZ] = DATA.pivot;
  const [OX, OY] = DATA.origin;
  const [BW, BH] = DATA.box;
  const UXA = 0.70710678; // pitch axis (1,-1,0)/sqrt(2)
  const UYA = -0.70710678;

  let yaw = 0;
  let pitch = 0;
  let cy = 1, sy = 0, cp = 1, sp = 0;
  const setAngles = (y, p) => {
    yaw = y; pitch = p;
    cy = Math.cos(y); sy = Math.sin(y);
    cp = Math.cos(p); sp = Math.sin(p);
  };

  // scale: canvas css px per design px
  let scale = 1;
  const px = (x, y, z) => {
    let vx = x - PX, vy = y - PY, vz = z - PZ;
    const rx = vx * cy - vy * sy;
    const ry = vx * sy + vy * cy;
    vx = rx; vy = ry;
    // Rodrigues about (UXA, UYA, 0)
    const crx = UYA * vz;
    const cry = -UXA * vz;
    const crz = UXA * vy - UYA * vx;
    const duv = UXA * vx + UYA * vy;
    const ox = vx * cp + crx * sp + UXA * duv * (1 - cp) + PX;
    const oy = vy * cp + cry * sp + UYA * duv * (1 - cp) + PY;
    const oz = vz * cp + crz * sp + PZ;
    return [(OX + (ox - oy) * U * CC) * scale, (OY + (ox + oy) * U * SS - oz * U) * scale];
  };

  /* ---------- Floor dots: computed once at the rest pose and drawn at fixed screen positions, so the background grid never tilts ---------- */
  const floor = [];
  {
    const sx0 = OX + (PX - PY) * U * CC;
    const sy0 = OY + (PX + PY) * U * SS;
    for (let x = -0.8; x < 6.6; x += 0.55) {
      for (let y = -0.8; y < 6.6; y += 0.55) {
        const sx = OX + (x - y) * U * CC;
        const sy_ = OY + (x + y) * U * SS;
        const d = Math.hypot(sx - sx0, (sy_ - sy0) * 1.8);
        const a = Math.max(0, 0.1 * (1 - d / 540));
        if (a > 0.004) floor.push([sx, sy_, a]);
      }
    }
  }

  /* ---------- Labels (HTML pills, repositioned each frame) ---------- */
  const labelEls = [];
  DATA.labels.forEach((l) => {
    const el = mount.querySelector(`[data-scene-label="${l.key}"]`);
    if (el) labelEls.push([el, l]);
  });
  const hubEl = mount.querySelector("[data-scene-hub]");

  /* ---------- Draw ---------- */
  const draw = () => {
    const pal = palette();
    const w = canvas.width / devicePixelRatio;
    const h = canvas.height / devicePixelRatio;
    ctx.clearRect(0, 0, w, h);

    // hub glow + lines
    const [hx, hy] = px(DATA.hub[0], DATA.hub[1], DATA.hub[2]);
    const R = 90 * scale;
    const g = ctx.createRadialGradient(hx, hy, 0, hx, hy, R);
    g.addColorStop(0, pal.halo);
    g.addColorStop(1, "rgba(95,207,206,0)");
    ctx.fillStyle = g;
    ctx.fillRect(hx - R, hy - R, R * 2, R * 2);

    ctx.strokeStyle = pal.line;
    ctx.lineWidth = Math.max(1, 1.2 * scale);
    ctx.beginPath();
    DATA.lines.forEach((ln) => {
      const [bx, by] = px(ln.b[0], ln.b[1], ln.b[2]);
      ctx.moveTo(hx, hy);
      ctx.lineTo(hx + (bx - hx) * 0.8, hy + (by - hy) * 0.8);
    });
    ctx.stroke();

    // floor
    ctx.fillStyle = pal.floor;
    floor.forEach(([fx, fy, a]) => {
      ctx.globalAlpha = a;
      ctx.beginPath();
      ctx.arc(fx * scale, fy * scale, 1.4 * scale, 0, 6.2832);
      ctx.fill();
    });
    ctx.globalAlpha = 1;

    // hub dot
    ctx.fillStyle = pal.hubDot;
    ctx.beginPath();
    ctx.arc(hx, hy, 5.5 * scale, 0, 6.2832);
    ctx.fill();

    // device dots
    let last = -1;
    DATA.dots.forEach((d) => {
      const [sx, sy_] = px(d[0], d[1], d[2]);
      if (d[4] !== last) {
        ctx.fillStyle = pal.dot[d[4]];
        last = d[4];
      }
      ctx.beginPath();
      ctx.arc(sx + d[5] * scale, sy_ + d[6] * scale, d[3] * scale, 0, 6.2832);
      ctx.fill();
    });

    // SOS on the care button
    const [sosx, sosy] = px(DATA.sos.a[0], DATA.sos.a[1], DATA.sos.a[2]);
    ctx.fillStyle = pal.sos;
    ctx.font = `700 ${18 * scale}px Poppins, system-ui, sans-serif`;
    ctx.textAlign = "center";
    ctx.fillText("SOS", sosx, sosy + 5 * scale);

    // asterisk on the PBX
    ctx.strokeStyle = pal.ast;
    ctx.lineWidth = 4.5 * scale;
    ctx.lineCap = "round";
    ctx.beginPath();
    DATA.ast.forEach(([a, b]) => {
      const [x1, y1] = px(a[0], a[1], a[2]);
      const [x2, y2] = px(b[0], b[1], b[2]);
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
    });
    ctx.stroke();

    // labels
    labelEls.forEach(([el, l]) => {
      const [ax, ay] = px(l.a[0], l.a[1], l.a[2]);
      el.style.left = `${ax + l.dx * scale}px`;
      el.style.top = `${ay + l.dy * scale}px`;
    });
    if (hubEl) {
      hubEl.style.left = `${hx}px`;
      hubEl.style.top = `${hy + 14 * scale}px`;
    }
  };

  /* ---------- Size ---------- */
  const resize = () => {
    const w = mount.clientWidth;
    if (!w) return;
    scale = w / BW;
    const h = Math.round(w * (BH / BW));
    canvas.width = Math.round(w * devicePixelRatio);
    canvas.height = Math.round(h * devicePixelRatio);
    canvas.style.height = `${h}px`;
    ctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
    draw();
  };

  mount.classList.add("is-live");
  resize();
  if ("ResizeObserver" in window) new ResizeObserver(resize).observe(mount);
  else window.addEventListener("resize", resize);

  new MutationObserver(draw).observe(doc, { attributes: true, attributeFilter: ["data-theme"] });

  if (reduceMotion) return; // static render only

  /* ---------- Motion: cursor → target angles, exponential ease, idle sway ---------- */
  const MAXY = (8 * Math.PI) / 180;
  const MAXP = (5 * Math.PI) / 180;
  let tYaw = 0, tPitch = 0;
  let pointer = false;
  let lastPointer = 0;
  let visible = true;
  let raf = 0;
  let lastT = 0;

  const onMove = (e) => {
    const r = mount.getBoundingClientRect();
    const nx = Math.max(-1, Math.min(1, ((e.clientX - r.left) / r.width) * 2 - 1));
    const ny = Math.max(-1, Math.min(1, ((e.clientY - r.top) / r.height) * 2 - 1));
    tYaw = nx * MAXY;
    tPitch = -ny * MAXP;
    pointer = true;
    lastPointer = performance.now();
    start();
  };
  const onLeave = () => {
    pointer = false;
    tYaw = 0;
    tPitch = 0;
  };
  const hero = mount.closest("section") || mount;
  hero.addEventListener("pointermove", onMove);
  hero.addEventListener("pointerleave", onLeave);

  const tick = (t) => {
    raf = 0;
    const dt = Math.min(64, t - (lastT || t));
    lastT = t;
    if (!pointer && t - lastPointer > 4000) {
      // idle sway
      tYaw = Math.sin(t / 2600) * MAXY * 0.28;
      tPitch = Math.sin(t / 3900) * MAXP * 0.24;
    }
    const k = 1 - Math.exp(-dt / 140);
    const nYaw = yaw + (tYaw - yaw) * k;
    const nPitch = pitch + (tPitch - pitch) * k;
    setAngles(nYaw, nPitch);
    draw();
    if (visible && !document.hidden) start();
  };
  const start = () => {
    if (!raf && visible && !document.hidden) raf = requestAnimationFrame(tick);
  };

  if ("IntersectionObserver" in window) {
    new IntersectionObserver((es) =>
      es.forEach((e) => {
        visible = e.isIntersecting;
        if (visible) start();
      })
    ).observe(mount);
  }
  document.addEventListener("visibilitychange", start);
  start();
})();
