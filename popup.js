const toggle = document.getElementById("toggle");
const status = document.getElementById("status");

chrome.storage.sync.get({ enabled: true }, ({ enabled }) => {
  toggle.checked = enabled !== false;
  render(toggle.checked);
});

toggle.addEventListener("change", () => {
  const enabled = toggle.checked;
  chrome.storage.sync.set({ enabled });
  render(enabled);
});

function render(on) {
  status.textContent = on
    ? "On — skipping reels, stories, and feed ads."
    : "Off — ads will play normally.";
}
