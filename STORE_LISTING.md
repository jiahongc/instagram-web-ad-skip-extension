# Chrome Web Store — Listing Copy

Canonical copy for Chrome Web Store developer dashboard form fields.
Paste values from here into the corresponding field.

Upload package: `instagram-web-ad-skip-v0.2.0.zip`

---

## Product name

```
Instagram Web Ad Skip
```

## Short description (132 character max, shown on tile)

```
Auto-skips Sponsored reels, stories, and feed ads on Instagram for a cleaner, faster browsing experience.
```

## Detailed description

```
Instagram Web Ad Skip removes the friction of Sponsored content on instagram.com. It works on feed posts, Stories, and Reels — surgically, without breaking organic content.

How it works
• Network layer: intercepts Instagram's GraphQL responses at document_start and filters ad nodes before React renders them. No flicker, no half-loaded ad.
• DOM fallback: a structural selector catches any ads that slip through. Feed ads are hidden, Story ads trigger the Next button, Reel ads scroll one viewport.
• Ad Break aware: Instagram's server-enforced "Ad break" countdown is unskippable. The extension detects it and stands down instead of fighting.
• Humanized cadence: actions use a randomized 600–1400 ms cooldown to avoid bot-like patterns.

Privacy
• No telemetry. No remote config. No analytics.
• Only permission: storage (to remember your on/off toggle).
• Only host: https://www.instagram.com/*

Toggle on/off anytime via the toolbar popup.

Open source: https://github.com/jiahongc/instagram-web-ad-skip-extension
```

## Category

```
Productivity
```

## Language

```
English
```

## Store icon

`icons/icon128.png` (128×128)

## Screenshots

Need 1–5 at **1280×800** (preferred) or **640×400**. Capture manually:

1. Instagram feed with extension enabled — scroll past where an ad would be
2. Reels view with extension on
3. Popup UI showing the on/off toggle

Save to `store/screenshots/` and upload each to the dashboard.

## Small promotional tile (optional)

440×280. Can reuse a cropped version of `icons/source.png`.

---

## Single purpose statement

```
Automatically skips Sponsored and advertising content on instagram.com across feed, Stories, and Reels.
```

## Permission justifications

### `storage`

```
Persists the user's on/off toggle via chrome.storage.sync so the preference is remembered across browser sessions and devices signed into the same Chrome profile. No other data is stored.
```

### Host permission `https://www.instagram.com/*`

```
The extension only operates on instagram.com. It reads and modifies in-page data to detect and skip Sponsored content in the feed, Stories, and Reels. No other site is accessed.
```

### Remote code use

```
No. All executable code is bundled in the extension package. There is no eval, no Function() string construction, and no remote-loaded scripts.
```

---

## Data usage disclosure

Check: **Does NOT collect any user data.** None of the listed data categories
apply. The extension has no network calls of its own.

Certifications required:
- [x] I do not sell or transfer user data to third parties, outside of the approved use cases.
- [x] I do not use or transfer user data for purposes that are unrelated to my item's single purpose.
- [x] I do not use or transfer user data to determine creditworthiness or for lending purposes.

## Privacy policy URL

```
https://github.com/jiahongc/instagram-web-ad-skip-extension/blob/main/PRIVACY.md
```

## Support / homepage URL

```
https://github.com/jiahongc/instagram-web-ad-skip-extension
```

## Distribution

- Visibility: **Public**
- Regions: **All regions**
- Pricing: **Free**
- Mature content: **No**
