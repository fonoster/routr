/* routr.io v1 — preferences, reveals, and the animations listed in ../../README.md.
   Same foundations as fonoster.com's v1.js; the SIP trace, hop board, and failover board are Routr's. */
(() => {
  "use strict";

  const doc = document.documentElement;
  const body = document.body;
  const ICONS = body.dataset.icons;
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  doc.classList.add("js");

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  const store = {
    get(key) {
      try {
        return localStorage.getItem(key);
      } catch (e) {
        return null;
      }
    },
    set(key, value) {
      try {
        localStorage.setItem(key, value);
      } catch (e) {
        /* storage unavailable: preferences just won't persist */
      }
    }
  };

  /* ---------- Timers that can be cancelled as a group ---------- */
  const timers = () => {
    let ids = [];
    return {
      later(fn, ms) {
        ids.push(window.setTimeout(fn, ms));
      },
      clear() {
        ids.forEach(window.clearTimeout);
        ids = [];
      }
    };
  };

  /* ---------- In-view helpers ---------- */
  const once = (el, fn, threshold = 0.25) => {
    if (!el) return;
    if (reduceMotion || !("IntersectionObserver" in window)) {
      fn();
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            io.disconnect();
            fn();
          }
        });
      },
      { threshold, rootMargin: "0px 0px -6% 0px" }
    );
    io.observe(el);
  };

  const watch = (el, onChange, threshold = 0) => {
    if (!el || !("IntersectionObserver" in window)) {
      onChange(true);
      return;
    }
    new IntersectionObserver((entries) => entries.forEach((e) => onChange(e.isIntersecting)), { threshold }).observe(el);
  };

  /* ---------- Reveal (fade up, once) ---------- */
  const initReveal = () => {
    const items = $$("[data-reveal]");
    if (reduceMotion || !("IntersectionObserver" in window)) {
      items.forEach((el) => el.classList.add("is-in"));
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-in");
            io.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12, rootMargin: "0px 0px -6% 0px" }
    );
    items.forEach((el) => io.observe(el));
  };

  /* ---------- Loops pause offscreen and in background tabs ---------- */
  const loopHandlers = [];
  const initLoops = () => {
    $$("[data-loop]").forEach((el) => watch(el, (visible) => el.classList.toggle("is-paused", !visible)));
    document.addEventListener("visibilitychange", () => {
      doc.classList.toggle("is-paused", document.hidden);
      loopHandlers.forEach((fn) => fn(!document.hidden));
    });
  };

  // A JS-driven loop that runs only while its element is in view and the tab is visible.
  const loopWhileVisible = (el, start, stop, threshold = 0.3) => {
    let inView = false;
    let tabVisible = !document.hidden;
    const sync = () => (inView && tabVisible ? start() : stop());
    watch(
      el,
      (visible) => {
        inView = visible;
        sync();
      },
      threshold
    );
    loopHandlers.push((active) => {
      tabVisible = active;
      sync();
    });
  };

  /* ---------- Preferences: theme ---------- */
  const setTheme = (next) => {
    const theme = next === "light" ? "light" : "dark";
    doc.dataset.theme = theme;
    store.set("routr.theme", theme);
    $$('[data-pref="theme"]').forEach((sel) => (sel.value = theme));
    $$("[data-theme-icon] use").forEach((use) =>
      use.setAttribute("href", `${ICONS}#i-${theme === "light" ? "sun" : "moon"}`)
    );
    const meta = $('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", theme === "light" ? "#ffffff" : "#181818");
  };

  const initPrefs = () => {
    $$('[data-pref="theme"]').forEach((sel) => sel.addEventListener("change", () => setTheme(sel.value)));
    setTheme(doc.dataset.theme);
  };

  /* ---------- Nav: blur on scroll, mobile sheet ---------- */
  const initNav = () => {
    const nav = $("[data-nav]");
    if (!nav) return;
    let ticking = false;
    const update = () => {
      nav.classList.toggle("is-scrolled", window.scrollY > 8);
      ticking = false;
    };
    window.addEventListener(
      "scroll",
      () => {
        if (!ticking) {
          ticking = true;
          window.requestAnimationFrame(update);
        }
      },
      { passive: true }
    );
    update();

    const button = $("[data-menu]", nav);
    const sheet = $("#sheet");
    if (!button || !sheet) return;
    const close = () => {
      sheet.hidden = true;
      button.setAttribute("aria-expanded", "false");
      $("use", button).setAttribute("href", `${ICONS}#i-menu`);
    };
    button.addEventListener("click", () => {
      const open = sheet.hidden;
      sheet.hidden = !open;
      button.setAttribute("aria-expanded", String(open));
      $("use", button).setAttribute("href", `${ICONS}#i-${open ? "x" : "menu"}`);
    });
    $$("a", sheet).forEach((a) => a.addEventListener("click", close));
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && !sheet.hidden) close();
    });
  };

  /* ---------- Numbers: odometer roll ---------- */
  const escape = (s) =>
    String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

  const initOdometers = () => {
    $$("[data-odo]").forEach((el) => {
      const text = el.textContent.trim();
      el.setAttribute("aria-label", text);
      el.classList.add("odo");
      let digit = 0;
      el.innerHTML = Array.from(text)
        .map((ch) => {
          if (/\d/.test(ch)) {
            const strip = Array.from({ length: 10 }, (_, n) => `<span>${n}</span>`).join("");
            return `<span class="odo__col" aria-hidden="true"><span class="odo__strip" style="--d:${ch};--i:${digit++}">${strip}</span></span>`;
          }
          return `<span class="odo__ch" aria-hidden="true">${escape(ch)}</span>`;
        })
        .join("");
      const fit = () => {
        const probe = document.createElement("span");
        probe.style.cssText = "position:absolute;visibility:hidden;white-space:pre";
        el.appendChild(probe);
        $$(".odo__strip", el).forEach((strip) => {
          probe.textContent = strip.style.getPropertyValue("--d");
          strip.parentElement.style.width = `${probe.getBoundingClientRect().width}px`;
        });
        probe.remove();
      };
      if (document.fonts && document.fonts.ready) document.fonts.ready.then(fit);
      else fit();
      once(el, () => el.classList.add("is-in"), 0.6);
    });
  };

  /* ---------- Terminals type their command, then print the output ---------- */
  const initTyping = () => {
    $$("[data-type]").forEach((el) => {
      const full = el.dataset.type;
      const term = el.closest(".term");
      const out = $("[data-type-out]", term);
      const caret = $(".caret", term);
      if (reduceMotion) {
        el.textContent = full;
        if (caret) caret.remove();
        return;
      }
      el.textContent = "";
      out.classList.add("is-hidden");
      once(
        term,
        () => {
          let i = 0;
          const step = () => {
            i += 1;
            el.textContent = full.slice(0, i);
            if (i < full.length) window.setTimeout(step, 28);
            else
              window.setTimeout(() => {
                out.classList.remove("is-hidden");
                if (caret) caret.remove();
              }, 350);
          };
          window.setTimeout(step, 400);
        },
        0.6
      );
    });
  };

  /* ---------- Path chips light up as a message travels ---------- */
  const lightPath = (root, upto) => {
    const chips = $$(".chip-node", root);
    const links = $$(".chip-link", root);
    const idx = chips.findIndex((c) => c.dataset.node === upto);
    chips.forEach((c, i) => c.classList.toggle("is-on", idx >= 0 && i === idx));
    links.forEach((l, i) => l.classList.toggle("is-on", idx >= 0 && i < idx));
  };

  /* ---------- Clips play only while visible; reduced motion keeps the poster ---------- */
  const initClips = () => {
    $$("video[data-autoplay]").forEach((video) => {
      if (reduceMotion) return;
      loopWhileVisible(
        video,
        () => {
          const playing = video.play();
          if (playing && playing.catch) playing.catch(() => {});
        },
        () => video.pause(),
        0.2
      );
    });
  };

  /* ---------- Hero: the SIP trace plays in a loop ---------- */
  const initTrace = () => {
    $$("[data-trace]").forEach((root) => {
      const log = $(".log", root);
      const rows = $$(".log__row", log);
      if (reduceMotion) {
        lightPath(root, "connect");
        return;
      }
      log.classList.add("log--anim");
      const clock = timers();
      let running = false;
      const play = () => {
        rows.forEach((r) => r.classList.remove("is-shown"));
        lightPath(root, "");
        rows.forEach((row, i) => {
          clock.later(() => {
            row.classList.add("is-shown");
            if (row.dataset.node) lightPath(root, row.dataset.node);
          }, 300 + i * 420);
        });
        clock.later(() => {
          if (running) play();
        }, 300 + rows.length * 420 + 3200);
      };
      loopWhileVisible(
        root,
        () => {
          if (running) return;
          running = true;
          play();
        },
        () => {
          running = false;
          clock.clear();
        }
      );
    });
  };

  /* ---------- Scale: the hop board plays once as it scrolls in ---------- */
  const initHop = () => {
    $$("[data-hop]").forEach((root) => {
      const rows = $$(".log__row", root);
      if (reduceMotion) {
        lightPath(root, "edgeport-02");
        return;
      }
      $(".log", root).classList.add("log--anim");
      once(
        root,
        () => {
          rows.forEach((row, i) =>
            window.setTimeout(() => {
              row.classList.add("is-shown");
              if (row.dataset.node) lightPath(root, row.dataset.node);
            }, 200 + i * 450)
          );
        },
        0.4
      );
    });
  };

  /* ---------- Resilience: one EdgePort dies, the board keeps serving ---------- */
  const initFailover = () => {
    $$("[data-failover]").forEach((root) => {
      const rows = $$(".fail__events .log__row", root);
      const status = $(".status", root);
      const down = $("[data-down]", root);
      const stat = (name) => $(`[data-stat="${name}"]`, root);
      const degrade = () => {
        if (down) down.classList.add("is-down");
        status.classList.add("is-degraded");
        status.textContent = "degraded";
        stat("up").textContent = "2 / 3";
        root.classList.add("is-degraded");
      };
      const recover = () => {
        if (down) down.classList.remove("is-down");
        status.classList.remove("is-degraded");
        status.textContent = "healthy";
        stat("up").textContent = "3 / 3";
        stat("restart").textContent = "2.1s";
        root.classList.remove("is-degraded");
      };
      if (reduceMotion) {
        rows.forEach((r) => r.classList.add("is-shown"));
        degrade();
        stat("restart").textContent = "2.1s";
        return;
      }
      $(".fail__events", root).classList.add("log--anim");
      once(
        root,
        () => {
          const t = timers();
          t.later(() => {
            rows[0].classList.add("is-shown");
            degrade();
          }, 600);
          t.later(() => rows[1].classList.add("is-shown"), 1400);
          t.later(() => rows[2].classList.add("is-shown"), 2200);
          t.later(() => {
            rows[3].classList.add("is-shown");
            recover();
          }, 3200);
        },
        0.4
      );
    });
  };

  initPrefs();
  initNav();
  initReveal();
  initLoops();
  initOdometers();
  initTyping();
  initTrace();
  initClips();
  initHop();
  initFailover();
})();
