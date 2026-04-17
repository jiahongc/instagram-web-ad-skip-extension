(() => {
  "use strict";

  const MIN_COOLDOWN_MS = 250;
  const MAX_COOLDOWN_MS = 900;
  const DEBOUNCE_MS = 180;
  const USER_INPUT_GRACE_MS = 400;

  const SPONSORED_RE = /^(Ad|Ads|Advertisement|Sponsored|Promoted|Paid partnership(?: with .+)?|Patrocinado|Publicidad|Anuncio|Publicité|Annonce|Werbung|Gesponsert|Sponsorizzato|Pubblicità|Реклама|Reklama|广告|廣告|贊助|スポンサー|広告|광고|Sponsorlu|Reklam|إعلان|ממומן)$/i;
  const AD_BREAK_RE = /^(Ad break|Ad starts in|Your next video|Your ad break|Next video in)/i;

  let enabled = true;
  let lastSkipAt = 0;
  let lastUserInputAt = 0;
  let scanTimer = 0;
  let cachedScroller = null;
  let cachedScrollerHref = "";

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

  // Track user input so the extension yields when the user is actively driving.
  // Use capture-phase + passive so we never delay the event itself.
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
    // Limits expensive querySelectorAll scope to the relevant container.
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
    // Prefer aligning to the next reel article so the snap matches IG's own paging.
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
    // Yield to the user: if they just interacted, let their input win.
    if (now - lastUserInputAt < USER_INPUT_GRACE_MS) {
      scheduleScan();
      return;
    }
    const scope = activeSurface();
    if (isAdBreakActive(scope)) return;

    const el = findAdStructural(scope) || findAdByLabel(scope);
    if (!el) return;

    let ok = false;
    if (isStory()) ok = skipStory();
    else if (isReel()) ok = skipReel(el);
    else if (isFeed()) ok = skipFeed(el);
    else ok = skipFeed(el) || skipReel(el) || skipStory();
    if (ok) lastSkipAt = Date.now();
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

  // SPA navigation invalidates the scroller cache and resets cooldown.
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
