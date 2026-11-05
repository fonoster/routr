/* routr.io — the live benchmark card, on every page except /benchmarks (which shows the live view).
   While perfkit runs a benchmark, routr.io/benchmarks/data/site.json names a live feed (live.json).
   Once the visitor has scrolled 120px (or at load, on a page too short to scroll that far), this reads
   that feed and, if a run is going, shows a small card bottom-right (a full-width bar on phones)
   linking to routr.io/benchmarks. Once shown, it stays for the page view; only ✕ removes it.
   - One fetch per page view at most, and the result is cached for 10 minutes, so home page traffic
     stays off the tunnel that also serves /benchmarks. No polling: time left is recomputed locally.
   - ✕ hides the card for the rest of the local day, for that run. A new run shows it again.
   - Any failure (no live URL, tunnel down, timeout, bad JSON, run not running) draws nothing.
   Design: designs/website.pen, "Live Benchmark Card" and "Live Benchmark Bar (mobile)". */
(() => {
  "use strict";

  const SITE_JSON = "/benchmarks/data/site.json";
  const LINK = "/benchmarks/";
  const CACHE_KEY = "routr.liveCard.cache";
  const DISMISS_KEY = "routr.liveCard.dismissed";
  const CACHE_TTL = 10 * 60 * 1000;
  const TIMEOUT = 8000;
  const TICK = 60 * 1000;
  const TRIGGER = 120;
  const HOUR = 60 * 60 * 1000;
  const MINUTE = 60 * 1000;

  const ICONS = document.body.dataset.icons;
  const phone = window.matchMedia("(max-width: 639px)");

  const store = {
    get(key) {
      try {
        return JSON.parse(localStorage.getItem(key) || "null");
      } catch (e) {
        return null;
      }
    },
    set(key, value) {
      try {
        localStorage.setItem(key, JSON.stringify(value));
      } catch (e) {
        /* storage unavailable: the next page view fetches again */
      }
    }
  };

  const today = () => {
    const d = new Date();
    const two = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${two(d.getMonth() + 1)}-${two(d.getDate())}`;
  };

  const fetchJson = async (url, headers) => {
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), TIMEOUT);
    try {
      const res = await fetch(url, { headers, signal: ctl.signal, cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } finally {
      clearTimeout(timer);
    }
  };

  /* The fields the card needs, or null when there is no card to draw. */
  const load = async () => {
    const site = await fetchJson(SITE_JSON);
    const url = site && site.project && site.project.live && site.project.live.url;
    if (!url) return null;
    const live = await fetchJson(url, { "ngrok-skip-browser-warning": "1" });
    if (!live || live.schema !== "perfkit/live/v1" || live.status !== "running") return null;
    const running = Array.isArray(live.benchmarks)
      ? live.benchmarks.find((b) => b && b.state === "running")
      : null;
    return {
      runId: live.runId,
      version: live.version,
      status: live.status,
      startedAt: live.startedAt,
      estimatedEndAt: live.estimatedEndAt,
      title: running && running.title ? running.title : null
    };
  };

  const getLive = async () => {
    const cached = store.get(CACHE_KEY);
    if (cached && typeof cached.fetchedAt === "number" && Date.now() - cached.fetchedAt < CACHE_TTL) {
      return cached.live || null;
    }
    let live = null;
    try {
      live = await load();
    } catch (e) {
      live = null;
    }
    store.set(CACHE_KEY, { fetchedAt: Date.now(), live });
    return live;
  };

  const isDismissed = (live) => {
    const d = store.get(DISMISS_KEY);
    return Boolean(d && d.runId === live.runId && d.day === today());
  };

  /* ---------- Markup (text goes in with textContent only) ---------- */
  const el = (tag, cls, text) => {
    const node = document.createElement(tag);
    if (cls) node.className = cls;
    if (text) node.textContent = text;
    return node;
  };

  const icon = (name) => {
    const ns = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(ns, "svg");
    svg.setAttribute("class", "icon");
    svg.setAttribute("aria-hidden", "true");
    const use = document.createElementNS(ns, "use");
    use.setAttribute("href", `${ICONS}#i-${name}`);
    svg.appendChild(use);
    return svg;
  };

  const card = el("aside", "live-card");
  card.setAttribute("aria-label", "Live benchmark");
  card.hidden = true;

  const head = el("div", "live-card__head");
  const pill = el("span", "live-card__pill");
  pill.append(el("span", "live-card__dot"), "LIVE");
  head.append(pill, el("strong", "live-card__title", "Benchmark running"));

  const run = el("p", "live-card__run");

  const progress = el("div", "live-card__progress");
  const track = el("span", "live-card__track");
  track.setAttribute("aria-hidden", "true");
  const done = el("span", "live-card__done");
  track.appendChild(done);
  const left = el("span", "live-card__left");
  progress.append(track, left);

  const link = el("a", "live-card__link");
  link.href = LINK;
  link.append(el("span", "", "Watch it live"), icon("arrow-right"));

  const close = el("button", "live-card__close");
  close.type = "button";
  close.setAttribute("aria-label", "Dismiss live benchmark notice");
  close.appendChild(icon("x"));

  card.append(head, run, progress, link, close);

  /* ---------- State ---------- */
  let live = null;
  let fetched = false;
  let dismissed = false;
  let ticker = null;

  const renderTime = () => {
    const start = Date.parse(live.startedAt);
    const end = Date.parse(live.estimatedEndAt);
    if (!live.estimatedEndAt || !Number.isFinite(start) || !Number.isFinite(end) || end <= start) {
      progress.hidden = true;
      return;
    }
    progress.hidden = false;
    const now = Date.now();
    const remaining = end - now;
    const frac = Math.min(1, Math.max(0, (now - start) / (end - start)));
    done.style.width = `${(frac * 100).toFixed(1)}%`;
    if (remaining <= 0) left.textContent = "Finishing up";
    else if (remaining >= HOUR) left.textContent = `${Math.ceil(remaining / HOUR)}h left`;
    else left.textContent = `${Math.max(1, Math.ceil(remaining / MINUTE))}m left`;
  };

  const render = () => {
    run.textContent = live.title ? `Routr ${live.version} · ${live.title}` : `Routr ${live.version}`;
    renderTime();
  };

  const pad = () => {
    document.body.style.paddingBottom = !card.hidden && phone.matches ? `${card.offsetHeight}px` : "";
  };

  const update = () => {
    const show = Boolean(live) && !dismissed;
    if (show === !card.hidden) return;
    card.hidden = !show;
    pad();
  };

  const start = () => {
    if (!live || isDismissed(live)) {
      live = null;
      return;
    }
    if (!card.isConnected) document.body.appendChild(card);
    render();
    ticker = setInterval(renderTime, TICK);
    update();
  };

  close.addEventListener("click", () => {
    const hadFocus = document.activeElement === close;
    dismissed = true;
    store.set(DISMISS_KEY, { runId: live.runId, day: today() });
    clearInterval(ticker);
    card.hidden = true;
    pad();
    card.remove();
    if (hadFocus) {
      const main = document.querySelector("main");
      if (main) main.focus({ preventScroll: true });
    }
  });

  window.addEventListener("resize", pad, { passive: true });

  /* The first scroll of 120px, or at load when the page can't scroll that far, starts the one fetch. */
  const trigger = () => {
    if (fetched) return;
    const root = document.documentElement;
    if (window.scrollY < TRIGGER && root.scrollHeight - window.innerHeight >= TRIGGER) return;
    fetched = true;
    window.removeEventListener("scroll", trigger);
    getLive().then((value) => {
      live = value;
      start();
    });
  };
  window.addEventListener("scroll", trigger, { passive: true });
  window.addEventListener("load", trigger, { once: true });
  trigger();
})();
