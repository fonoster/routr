/* routr.io — the notice bar above the nav on every page.
   Two modes, picked with NOTICE.mode:
   - "release": announces the latest GitHub release automatically. Nothing to edit when you ship:
     the bar reads github.com/fonoster/routr/releases/latest, shows it while it is younger than
     NOTICE.maxAgeDays, and links to the release notes. The response is cached in localStorage for
     an hour so repeat visits draw the bar before the nav without a network round-trip.
   - "static": a hand-written message. Edit NOTICE.static and merge to main.
   - show: false hides the bar on every page.
   The same fetch keeps the GitHub star count in the nav fresh ([data-stars]).
   Each page loads this file as the first thing in <body>, so the bar is drawn before the nav. */
(() => {
  "use strict";

  const NOTICE = {
    show: true,
    mode: "release",
    maxAgeDays: 45,
    icon: "sparkles",
    static: {
      lead: "Routr v2.15 is out.",
      text: "The Helm chart and the routr-one image are updated.",
      cta: "See the release notes",
      link: "https://github.com/fonoster/routr/releases/latest"
    }
  };

  /* ---------- No need to edit below this line ---------- */
  const REPO = "fonoster/routr";
  const CACHE_KEY = "routr.release";
  const CACHE_TTL = 60 * 60 * 1000;
  const ICONS = document.body.dataset.icons;
  const anchor = document.currentScript;

  const escape = (s) =>
    String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

  const icon = (name, cls = "") =>
    `<svg class="icon ${cls}" aria-hidden="true"><use href="${ICONS}#i-${name}"></use></svg>`;

  const html = ({ lead, text, cta, link }) => {
    const parts = [
      lead && `<strong>${escape(lead)}</strong>`,
      text && `<span>${escape(text).replace(/\[(.*?)\]/g, '<span class="hide-m">$1</span>')}</span>`,
      link && cta && `<a class="notice__link" href="${escape(link)}"><span>${escape(cta)}</span>${icon("arrow-right")}</a>`
    ].filter(Boolean);
    return `<div class="container notice__in"><p>${icon(NOTICE.icon, "notice__icon")}${parts.join(" ")}</p></div>`;
  };

  let bar = null;
  const draw = (message) => {
    if (!bar) {
      bar = document.createElement("div");
      bar.className = "notice";
      bar.setAttribute("role", "note");
      anchor.after(bar);
    }
    bar.innerHTML = html(message);
  };

  const store = {
    get() {
      try {
        return JSON.parse(localStorage.getItem(CACHE_KEY) || "null");
      } catch (e) {
        return null;
      }
    },
    set(value) {
      try {
        localStorage.setItem(CACHE_KEY, JSON.stringify(value));
      } catch (e) {
        /* storage unavailable: the next visit fetches again */
      }
    }
  };

  const compact = (n) => (n >= 1000 ? `${(n / 1000).toFixed(1).replace(/\.0$/, "")}K` : String(n));

  const ago = (iso) => {
    const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
    if (days <= 0) return "Published today.";
    if (days === 1) return "Published yesterday.";
    return `Published ${days} days ago.`;
  };

  const apply = (data) => {
    if (data.stars) {
      document.querySelectorAll("[data-stars]").forEach((el) => (el.textContent = compact(data.stars)));
    }
    if (!NOTICE.show || NOTICE.mode !== "release" || !data.tag) return;
    const ageDays = (Date.now() - new Date(data.publishedAt).getTime()) / 86400000;
    if (ageDays > NOTICE.maxAgeDays) return;
    draw({
      lead: `Routr ${data.tag} is out.`,
      text: `[${ago(data.publishedAt)}]`,
      cta: "See the release notes",
      link: data.url
    });
  };

  const fetchLatest = async () => {
    const headers = { Accept: "application/vnd.github+json" };
    const [release, repo] = await Promise.all([
      fetch(`https://api.github.com/repos/${REPO}/releases/latest`, { headers }).then((r) => (r.ok ? r.json() : null)),
      fetch(`https://api.github.com/repos/${REPO}`, { headers }).then((r) => (r.ok ? r.json() : null))
    ]);
    if (!release && !repo) throw new Error("GitHub API unavailable");
    return {
      tag: release ? release.tag_name : null,
      url: release ? release.html_url : null,
      publishedAt: release ? release.published_at : null,
      stars: repo ? repo.stargazers_count : null,
      fetchedAt: Date.now()
    };
  };

  if (NOTICE.show && NOTICE.mode === "static") draw(NOTICE.static);

  const cached = store.get();
  if (cached && cached.fetchedAt) apply(cached);
  if (!cached || Date.now() - cached.fetchedAt > CACHE_TTL) {
    fetchLatest()
      .then((data) => {
        store.set(data);
        apply(data);
      })
      .catch(() => {
        if (!cached && NOTICE.show && NOTICE.mode === "release") draw(NOTICE.static);
      });
  }
})();
