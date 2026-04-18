(() => {
  "use strict";

  const MIN_COOLDOWN_MS = 250;
  const MAX_COOLDOWN_MS = 900;
  const DEBOUNCE_MS = 180;
  const USER_INPUT_GRACE_MS = 400;
  const STATS_RETENTION_DAYS = 30;

  const SPONSORED_RE = /^(Ad|Ads|Advertisement|Sponsored|Promoted|Paid partnership(?: with .+)?|Patrocinado|Publicidad|Anuncio|Publicité|Annonce|Werbung|Gesponsert|Sponsorizzato|Pubblicità|Реклама|Reklama|广告|廣告|贊助|スポンサー|広告|광고|Sponsorlu|Reklam|إعلان|ממומן)$/i;
  const AD_BREAK_RE = /^(Ad break|Ad starts in|Your next video|Your ad break|Next video in)/i;

  let enabled = true;
  let lastSkipAt = 0;
  let lastUserInputAt = 0;
  let scanTimer = 0;
  let cachedScroller = null;
  let cachedScrollerHref = "";

  // Stats batching (write-through to chrome.storage.local every ~800ms).
  const pendingStats = { reel: 0, story: 0, feed: 0, network: 0 };
  let statsFlushTimer = 0;

  function todayKey() {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }

  function pruneStats(stats) {
    const keys = Object.keys(stats || {}).sort();
    if (keys.length <= STATS_RETENTION_DAYS) return stats;
    const drop = keys.length - STATS_RETENTION_DAYS;
    for (let i = 0; i < drop; i++) delete stats[keys[i]];
    return stats;
  }

  function flushStats() {
    statsFlushTimer = 0;
    const hasDelta = Object.values(pendingStats).some((v) => v > 0);
    if (!hasDelta) return;
    if (!chrome?.storage?.local) return;
    const key = todayKey();
    const delta = { ...pendingStats };
    for (const k of Object.keys(pendingStats)) pendingStats[k] = 0;
    chrome.storage.local.get({ stats: {} }, ({ stats }) => {
      stats = stats || {};
      const bucket = stats[key] || { reel: 0, story: 0, feed: 0, network: 0 };
      for (const k of Object.keys(delta)) {
        bucket[k] = (bucket[k] || 0) + delta[k];
      }
      stats[key] = bucket;
      pruneStats(stats);
      chrome.storage.local.set({ stats });
    });
  }

  function bumpStat(kind, n) {
    if (!kind || !(kind in pendingStats)) return;
    pendingStats[kind] += n || 1;
    if (!statsFlushTimer) statsFlushTimer = setTimeout(flushStats, 800);
  }

  function randomCooldown() {
    return MIN_COOLDOWN_MS + Math.random() * (MAX_COOLDOWN_MS - MIN_COOLDOWN_MS);
  }

  function postToPage(type, extra) {
    window.postMessage(Object.assign({ source: "igwas-content", type }, extra || {}), "*");
  }

  if (typeof chrome !== "undefined" && chrome.storage) {
    chrome.storage.sync.get({ enabled: true }, (v) => {
      enabled = v.enabled !== false;
      postToPage("config", { enabled });
    });
    chrome.storage.onChanged.addListener((changes) => {
      if (changes.enabled) {
        enabled = changes.enabled.newValue !== false;
        postToPage("config", { enabled });
      }
    });
  }

  // Receive network-layer block counts from inject.js and attribute them to
  // whichever IG surface the user is currently viewing.
  window.addEventListener("message", (e) => {
    if (e.source !== window) return;
    const d = e.data;
    if (!d || d.source !== "igwas-inject") return;
    if (d.type === "blocked" && typeof d.count === "number") {
      bumpStat("network", d.count);
    }
  });

  // Track user input so the extension yields when the user is actively driving.
  const markInput = () => { lastUserInputAt = Date.now(); };
  const inputOpts = { capture: true, passive: true };
  for (const ev of ["keydown", "wheel", "touchstart", "pointerdown", "click"]) {
    window.addEventListener(ev, markInput, inputOpts);
  }

  const path = () => location.pathname;
  const isStory = () => path().startsWith("/stories/");
  const isReel = () => /^\/reels?(\/|$)/.test(path());
  const isFeed = () =>
    path() === "/" || path().startsWith("/explore") || path().startsWith("/p/");

  function currentSurface() {
    if (isStory()) return "story";
    if (isReel()) return "reel";
    if (isFeed()) return "feed";
    return "feed";
  }

  function isVisible(el) {
    if (!el?.getBoundingClientRect) return false;
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) return false;
    if (r.bottom <= 0 || r.right <= 0) return false;
    if (r.top >= (window.innerHeight || 0)) return false;
    if (r.left >= (window.innerWidth || 0)) return false;
    return true;
  }

  function activeSurface() {
    if (isStory()) {
      return (
        document.querySelector('section[role="dialog"]') ||
        document.querySelector("section") ||
        document.body
      );
    }
    if (isReel()) {
      return findReelScroller() || document.querySelector("main") || document.body;
    }
    return document.querySelector("main") || document.body;
  }

  function findAdStructural(scope) {
    const root = scope || document;
    try {
      const byFbLink = root.querySelector(
        'article:has(a[href^="https://www.facebook.com/ads/"])'
      );
      if (byFbLink && isVisible(byFbLink)) return byFbLink;
      const storyByFbLink = root.querySelector(
        'section:has(a[href^="https://www.facebook.com/ads/"])'
      );
      if (storyByFbLink && isVisible(storyByFbLink)) return storyByFbLink;
    } catch (_) {}
    return null;
  }

  function findAdByLabel(scope) {
    const root = scope || document;
    const els = root.querySelectorAll("span, h2, h3, a > span");
    for (const el of els) {
      if (el.childElementCount > 0) continue;
      const t = (el.textContent || "").trim();
      if (!t || t.length > 40) continue;
      if (!SPONSORED_RE.test(t)) continue;
      if (!isVisible(el)) continue;
      return el;
    }
    return null;
  }

  function isAdBreakActive(scope) {
    const root = scope || document;
    const els = root.querySelectorAll("span, h2, h3");
    for (const el of els) {
      if (el.childElementCount > 2) continue;
      const t = (el.textContent || "").trim();
      if (!t || t.length > 40) continue;
      if (AD_BREAK_RE.test(t) && isVisible(el)) return true;
    }
    return false;
  }

  function clickNextButton(root) {
    const scope = root || document;
    const btn =
      scope.querySelector('button[aria-label^="Next"]') ||
      scope.querySelector('[role="button"][aria-label^="Next"]') ||
      scope.querySelector('div[aria-label^="Next"]');
    if (btn) {
      btn.click();
      return true;
    }
    return false;
  }

  function dispatchKey(target, key, code) {
    const init = {
      key,
      code,
      keyCode: code === "ArrowRight" ? 39 : code === "ArrowDown" ? 40 : 0,
      which: code === "ArrowRight" ? 39 : code === "ArrowDown" ? 40 : 0,
      bubbles: true,
      cancelable: true,
      view: window,
    };
    (target || document.body).dispatchEvent(new KeyboardEvent("keydown", init));
    (target || document.body).dispatchEvent(new KeyboardEvent("keyup", init));
  }

  function skipStory() {
    const storyRoot =
      document.querySelector('section[role="dialog"]') ||
      document.querySelector("section");
    if (clickNextButton(storyRoot)) return true;
    dispatchKey(storyRoot || document.body, "ArrowRight", "ArrowRight");
    return true;
  }

  function findReelScroller() {
    if (cachedScroller && cachedScrollerHref === location.href && document.contains(cachedScroller)) {
      return cachedScroller;
    }
    cachedScroller = null;
    cachedScrollerHref = location.href;
    const mains = document.querySelectorAll("main");
    for (const m of mains) {
      const candidates = m.querySelectorAll("div");
      for (const d of candidates) {
        if (d.scrollHeight <= d.clientHeight + 10) continue;
        const cs = getComputedStyle(d);
        const snap = cs.scrollSnapType || "";
        if (snap.includes("y") || snap.includes("mandatory")) {
          cachedScroller = d;
          return d;
        }
      }
    }
    return null;
  }

  function skipReel(adEl) {
    const container =
      adEl?.closest("article") ||
      adEl?.closest('div[role="presentation"]') ||
      adEl?.closest("section");
    const next = container?.nextElementSibling;
    if (next?.scrollIntoView) {
      next.scrollIntoView({ behavior: "instant", block: "start" });
      return true;
    }
    const scroller = findReelScroller();
    if (scroller) {
      scroller.scrollBy({ top: scroller.clientHeight, behavior: "instant" });
      return true;
    }
    return false;
  }

  function skipFeed(adEl) {
    const article = adEl?.closest("article");
    if (!article) return false;
    article.style.display = "none";
    return true;
  }

  function scan() {
    scanTimer = 0;
    if (!enabled) return;
    const now = Date.now();
    if (now - lastSkipAt < randomCooldown()) return;
    if (now - lastUserInputAt < USER_INPUT_GRACE_MS) {
      scheduleScan();
      return;
    }
    const scope = activeSurface();
    if (isAdBreakActive(scope)) return;

    const el = findAdStructural(scope) || findAdByLabel(scope);
    if (!el) return;

    let ok = false;
    let kind = currentSurface();
    if (isStory()) ok = skipStory();
    else if (isReel()) ok = skipReel(el);
    else if (isFeed()) ok = skipFeed(el);
    else ok = skipFeed(el) || skipReel(el) || skipStory();
    if (ok) {
      lastSkipAt = Date.now();
      bumpStat(kind, 1);
    }
  }

  function scheduleScan() {
    if (scanTimer) return;
    scanTimer = setTimeout(scan, DEBOUNCE_MS);
  }

  function bootObserver() {
    const obs = new MutationObserver(scheduleScan);
    obs.observe(document.documentElement, { childList: true, subtree: true });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bootObserver, { once: true });
  } else {
    bootObserver();
  }

  // Flush any pending stats before the tab goes away.
  window.addEventListener("pagehide", flushStats);
  window.addEventListener("beforeunload", flushStats);

  // Popup asks for a flush when it opens so the user sees the latest counts.
  if (chrome?.runtime?.onMessage) {
    chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
      if (msg?.type === "igwas-flush-stats") {
        flushStats();
        sendResponse({ ok: true });
      }
      return true;
    });
  }

  let lastHref = location.href;
  setInterval(() => {
    if (location.href !== lastHref) {
      lastHref = location.href;
      lastSkipAt = 0;
      cachedScroller = null;
      cachedScrollerHref = "";
      scheduleScan();
    }
  }, 500);
})();
