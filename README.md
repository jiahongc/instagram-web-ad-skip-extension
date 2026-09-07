# Instagram Web Ad Skip

Chrome (MV3) extension that automatically skips Sponsored / Ad content on
**instagram.com** — feed posts, Stories, and Reels.

<p align="center">
  <img src="icons/icon128.png" width="96" alt="Instagram Web Ad Skip icon" />
</p>

The extension combines response filtering with a DOM fallback to hide or advance past detected ad content. Instagram can change its response formats and page structure, so skipping is best-effort.

[Install](#install-developer-mode) · [How it works](#how-it-works) · [Permissions](#permissions) · [Development](#development)

## How it works

Two filtering layers with additional guards:

1. **Network layer (primary).** A `MAIN`-world content script injected at
   `document_start` monkey-patches `JSON.parse`, `Response.prototype.json`,
   and `Response.prototype.text`. It walks the parsed payload and drops
   any node where `is_sponsored`, `is_ad`, `ad_id`, `product_type === "ad"`,
   a non-empty `ad` object, or a `sponsor_tags` array is present. Story
   ad units are removed from `ad_media_items` and `injected_items`.
2. **DOM layer (fallback).** An `ISOLATED`-world content script watches
   for ad content that slipped through — primarily via the structural
   selector `article:has(a[href^="https://www.facebook.com/ads/"])`
   (the "Why you're seeing this ad" link is durable across Meta's class
   rotations). If found, it:
   - **Feed:** hides the article.
   - **Stories:** clicks `button[aria-label^="Next"]` or dispatches
     `ArrowRight` on the story root.
   - **Reels:** scrolls the scroll-snap container by one viewport.
3. **Ad Break guard.** Instagram's server-enforced "Ad break" countdown
   (3–5s) is unskippable by design. The extension detects it and does
   nothing instead of fighting it.
4. **Action cooldown.** A randomized 600–1400ms cooldown limits repeated skip actions.

## Install (developer mode)

1. Clone this repo: `git clone https://github.com/jiahongc/instagram-web-ad-skip-extension.git`.
2. Open `chrome://extensions`.
3. Enable **Developer mode** (top right).
4. Click **Load unpacked** → select this folder.
5. Visit `https://www.instagram.com`.

A toolbar button with a popup lets you toggle the extension on/off.

## Update

To pull the latest version into a previously cloned checkout:

```bash
bash scripts/update.sh
```

The script `git pull`s, prints the manifest version, and opens
`chrome://extensions` so you can hit the reload icon (or the page-level
**Update** button with Developer mode on). Then refresh any open
Instagram tabs.

## File layout

```
manifest.json      # MV3 manifest, host perm on www.instagram.com only
inject.js          # MAIN-world, patches fetch/JSON for ad filtering
content.js         # ISOLATED-world, DOM fallback + skip actions
popup.html / .js   # on/off toggle (chrome.storage.sync)
icons/             # 16/48/128 PNGs + source.png master
scripts/           # update.sh + icon generator
```

## Permissions

Minimal. Only:

- `storage` — persist the on/off toggle via `chrome.storage.sync`.
- `host_permissions` for `https://www.instagram.com/*` only — inject the
  ad-filtering content scripts.

No telemetry, no remote config, no analytics. See [PRIVACY.md](PRIVACY.md).

## Stats

Click the toolbar icon to see how many ads were skipped today, split by
**Reels**, **Stories**, **Feed**, and **network-blocked** (ads filtered out
of Instagram's own GraphQL responses before they ever render). Also shows a
7-day rolling total. Counts live locally on your device and can be cleared
from the popup.

## Chrome Web Store

Full listing copy (fields, descriptions, permission justifications) lives in
[STORE_LISTING.md](STORE_LISTING.md). Package the current source with `manifest.json` at the archive root when preparing a store submission.

## Known limitations

- Server-enforced "Ad break" countdowns cannot be skipped on the client.
- Instagram experiments can change labels, response data, or navigation controls and break either filtering layer.
- The cooldown does not guarantee how Instagram will classify or respond to automated actions.

## Development

```bash
# regenerate icons from icons/source.png (requires Python 3 + Pillow)
python3 scripts/make_icons.py
```

Icon master is `icons/source.png`. The script auto-crops it to a square and
exports 16/48/128 PNGs for the extension.

There is no build step. Edit the JS files and reload the extension at
`chrome://extensions`.

## License

MIT. See `LICENSE`.
