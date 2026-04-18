const toggle = document.getElementById("toggle");
const resetBtn = document.getElementById("reset");
const dateEl = document.getElementById("date");
const totalEl = document.getElementById("total");
const reelEl = document.getElementById("reel");
const storyEl = document.getElementById("story");
const feedEl = document.getElementById("feed");
const networkEl = document.getElementById("network");
const weekEl = document.getElementById("week");
const versionEl = document.getElementById("version");

function todayKey(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function humanDate(d = new Date()) {
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

function emptyBucket() {
  return { reel: 0, story: 0, feed: 0, network: 0 };
}

function last7Keys() {
  const out = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    out.push(todayKey(d));
  }
  return out;
}

function renderStats(stats) {
  stats = stats || {};
  const today = stats[todayKey()] || emptyBucket();
  reelEl.textContent = today.reel || 0;
  storyEl.textContent = today.story || 0;
  feedEl.textContent = today.feed || 0;
  networkEl.textContent = today.network || 0;
  const total =
    (today.reel || 0) + (today.story || 0) + (today.feed || 0);
  totalEl.textContent = total;

  let weekTotal = 0;
  for (const k of last7Keys()) {
    const b = stats[k];
    if (!b) continue;
    weekTotal +=
      (b.reel || 0) + (b.story || 0) + (b.feed || 0) + (b.network || 0);
  }
  weekEl.textContent = weekTotal;
}

function loadStats() {
  chrome.storage.local.get({ stats: {} }, ({ stats }) => renderStats(stats));
}

// Ask any live Instagram tabs to flush their batched counters so the popup
// reflects the very latest state, not just whatever has been persisted so far.
function requestFlush() {
  try {
    chrome.tabs.query(
      { url: "https://www.instagram.com/*" },
      (tabs) => {
        if (!tabs || !tabs.length) return;
        for (const t of tabs) {
          try {
            chrome.tabs.sendMessage(t.id, { type: "igwas-flush-stats" }, () => {
              void chrome.runtime.lastError;
            });
          } catch (_) {}
        }
      }
    );
  } catch (_) {}
}

chrome.storage.sync.get({ enabled: true }, ({ enabled }) => {
  toggle.checked = enabled !== false;
});

toggle.addEventListener("change", () => {
  chrome.storage.sync.set({ enabled: toggle.checked });
});

resetBtn.addEventListener("click", () => {
  if (!confirm("Clear all ad-skip stats?")) return;
  chrome.storage.local.set({ stats: {} }, loadStats);
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && changes.stats) {
    renderStats(changes.stats.newValue);
  }
});

dateEl.textContent = humanDate();
requestFlush();
loadStats();

try {
  const manifest = chrome.runtime.getManifest();
  if (manifest?.version) versionEl.textContent = `v${manifest.version}`;
} catch (_) {}
