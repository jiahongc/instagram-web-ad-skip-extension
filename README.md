# Instagram Web Ad Skip

Chrome (MV3) extension that automatically skips Sponsored / Ad content on
**instagram.com** — feed posts, Stories, and Reels.

<p align="center">
  <img src="icons/icon128.png" width="96" alt="Instagram Web Ad Skip icon" />
</p>

## Why

Existing Chrome extensions in this space either (a) nuke entire surfaces
(Reels, Stories) losing organic content, or (b) scrape for the word
"Sponsored" and race the render. This extension is surgical: it filters
ad nodes out of Instagram's GraphQL responses **before** React renders,
and uses a durable structural DOM selector as a fallback.

## How it works

Two layers, in order of reliability:

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
4. **Humanized cadence.** Actions are throttled with a randomized
   600–1400ms cooldown to avoid sub-200ms bot-like skip patterns.

## Install (developer mode)

1. Clone this repo.
2. Open `chrome://extensions`.
3. Enable **Developer mode** (top right).
4. Click **Load unpacked** → select this folder.
5. Visit `https://www.instagram.com`.

A toolbar button with a popup lets you toggle the extension on/off.

## File layout

```
manifest.json      # MV3 manifest, host perm on www.instagram.com only
inject.js          # MAIN-world, patches fetch/JSON for ad filtering
content.js         # ISOLATED-world, DOM fallback + skip actions
popup.html / .js   # on/off toggle (chrome.storage.sync)
icons/             # 16/48/128 PNGs + source.png master
scripts/           # build-time helpers (icon generator)
```

## Permissions

Minimal. Only:

- `storage` — persist the on/off toggle via `chrome.storage.sync`.
- `host_permissions` for `https://www.instagram.com/*` only — inject the
  ad-filtering content scripts.

No telemetry, no remote config, no analytics. See [PRIVACY.md](PRIVACY.md).

## Chrome Web Store

Full listing copy (fields, descriptions, permission justifications) lives in
[STORE_LISTING.md](STORE_LISTING.md). Upload package:
`instagram-web-ad-skip-v0.2.0.zip`.

## Known limitations

- Server-enforced "Ad break" countdowns cannot be skipped on the client.
- Instagram may occasionally roll out A/B UI variants where the label is
  rendered as an image — the network filter still catches these.
- Account-level shadowbans for rapid skipping have not been reliably
  reported, but cadence is humanized anyway.

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
