(() => {
  "use strict";

  const FLAG = "__igWebAdSkip__";
  if (window[FLAG]) return;
  window[FLAG] = true;

  let enabled = true;

  // Batched block counter — flushed to the content script on a 500ms tick.
  let pendingBlocked = 0;
  let flushTimer = 0;

  function flushBlocked() {
    flushTimer = 0;
    if (pendingBlocked <= 0) return;
    window.postMessage(
      { source: "igwas-inject", type: "blocked", count: pendingBlocked },
      "*"
    );
    pendingBlocked = 0;
  }

  function noteBlocked(n) {
    pendingBlocked += n;
    if (!flushTimer) flushTimer = setTimeout(flushBlocked, 500);
  }

  // Fast pre-check: only scrub payloads that mention an ad-related key.
  // Avoids walking every JSON.parse result IG makes (routing, settings, etc).
  const AD_HINT_RE =
    /"(is_ad|is_sponsored|product_type|ad_id|sponsor_tags|ad_media_items|injected_items)"/;

  window.addEventListener("message", (e) => {
    if (e.source !== window) return;
    const d = e.data;
    if (!d || d.source !== "igwas-content") return;
    if (d.type === "config") enabled = d.enabled !== false;
  });

  function looksLikeAd(node) {
    if (!node || typeof node !== "object") return false;
    if (node.is_ad === true) return true;
    if (node.is_sponsored === true) return true;
    if (node.product_type === "ad") return true;
    if (node.ad_id && node.ad_id !== "0" && node.ad_id !== 0) return true;
    if (node.ad && typeof node.ad === "object" && Object.keys(node.ad).length > 0) return true;
    if (Array.isArray(node.sponsor_tags) && node.sponsor_tags.length > 0) return true;
    if (typeof node.__typename === "string" && /Ad(Media|Item|Story)?$/i.test(node.__typename)) return true;
    return false;
  }

  function scrub(obj, depth) {
    if (!enabled) return obj;
    if (!obj || typeof obj !== "object" || depth > 14) return obj;

    if (Array.isArray(obj)) {
      for (let i = obj.length - 1; i >= 0; i--) {
        const it = obj[i];
        if (!it || typeof it !== "object") continue;
        const probe = it.node || it.media || it.story || it;
        if (looksLikeAd(probe)) {
          obj.splice(i, 1);
          noteBlocked(1);
          continue;
        }
        scrub(it, depth + 1);
      }
      return obj;
    }

    if (Array.isArray(obj.ad_media_items) && obj.ad_media_items.length > 0) {
      noteBlocked(obj.ad_media_items.length);
      obj.ad_media_items = [];
    }
    if (Array.isArray(obj.injected_items) && obj.injected_items.length > 0) {
      const before = obj.injected_items.length;
      obj.injected_items = obj.injected_items.filter((it) => {
        const probe = it?.node || it?.media || it;
        return !looksLikeAd(probe);
      });
      noteBlocked(before - obj.injected_items.length);
    }

    for (const k of Object.keys(obj)) {
      const v = obj[k];
      if (v && typeof v === "object") scrub(v, depth + 1);
    }
    return obj;
  }

  // Heuristic: only scrub if the source text mentions an ad-related key.
  function shouldScrubText(text) {
    if (typeof text !== "string" || text.length < 64) return false;
    return AD_HINT_RE.test(text);
  }

  const origParse = JSON.parse;
  JSON.parse = function (text, reviver) {
    const result = origParse.call(this, text, reviver);
    if (!enabled) return result;
    if (!shouldScrubText(text)) return result;
    try {
      scrub(result, 0);
    } catch (_) {}
    return result;
  };

  const origResJson = Response.prototype.json;
  Response.prototype.json = function () {
    return origResJson.call(this).then((data) => {
      if (!enabled || !data || typeof data !== "object") return data;
      try {
        scrub(data, 0);
      } catch (_) {}
      return data;
    });
  };

  const origText = Response.prototype.text;
  Response.prototype.text = function () {
    return origText.call(this).then((txt) => {
      if (!enabled || !txt || typeof txt !== "string") return txt;
      const trimmed = txt.length < 200 ? txt.trim() : txt;
      if (trimmed[0] !== "{" && trimmed[0] !== "[") return txt;
      if (!shouldScrubText(txt)) return txt;
      try {
        const parsed = origParse.call(JSON, txt);
        scrub(parsed, 0);
        return JSON.stringify(parsed);
      } catch (_) {
        return txt;
      }
    });
  };

  window.postMessage({ source: "igwas-inject", type: "ready" }, "*");
})();
