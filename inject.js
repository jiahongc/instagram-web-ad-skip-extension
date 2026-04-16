(() => {
  "use strict";

  const FLAG = "__igWebAdSkip__";
  if (window[FLAG]) return;
  window[FLAG] = true;

  let enabled = true;
  let blocked = 0;

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
          blocked++;
          continue;
        }
        scrub(it, depth + 1);
      }
      return obj;
    }

    if (Array.isArray(obj.ad_media_items) && obj.ad_media_items.length > 0) {
      blocked += obj.ad_media_items.length;
      obj.ad_media_items = [];
    }
    if (Array.isArray(obj.injected_items) && obj.injected_items.length > 0) {
      const before = obj.injected_items.length;
      obj.injected_items = obj.injected_items.filter((it) => {
        const probe = it?.node || it?.media || it;
        return !looksLikeAd(probe);
      });
      blocked += before - obj.injected_items.length;
    }

    for (const k of Object.keys(obj)) {
      const v = obj[k];
      if (v && typeof v === "object") scrub(v, depth + 1);
    }
    return obj;
  }

  const origParse = JSON.parse;
  JSON.parse = function (text, reviver) {
    const result = origParse.call(this, text, reviver);
    try {
      scrub(result, 0);
    } catch (_) {}
    return result;
  };

  const origResJson = Response.prototype.json;
  Response.prototype.json = function () {
    return origResJson.call(this).then((data) => {
      try {
        scrub(data, 0);
      } catch (_) {}
      return data;
    });
  };

  const origText = Response.prototype.text;
  Response.prototype.text = function () {
    return origText.call(this).then((txt) => {
      if (!txt || typeof txt !== "string") return txt;
      const trimmed = txt.trim();
      if (!trimmed.startsWith("{") && !trimmed.startsWith("[")) return txt;
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
