# Privacy Policy — Instagram Web Ad Skip

_Last updated: April 16, 2026_

## Summary

Instagram Web Ad Skip is a client-side browser extension. It does **not**
collect, transmit, sell, or share any user data. There is no backend server,
no telemetry, no analytics, and no remote configuration.

## What the extension does

The extension runs only on `https://www.instagram.com/*`. Inside that site it:

1. Intercepts Instagram's own JSON and GraphQL responses in the browser tab
   and filters out nodes flagged by Instagram as sponsored or ad content
   (fields such as `is_sponsored`, `is_ad`, `ad_id`, `product_type`, `ad`,
   `sponsor_tags`).
2. Watches the DOM for any ad that slips through and either hides the feed
   post, presses the Next button in Stories, or scrolls past the Reel.
3. Stores a single boolean on/off preference via `chrome.storage.sync` so the
   toggle is remembered across sessions and devices signed into the same
   Chrome profile.

## Data the extension collects

None. The extension does not read your posts, DMs, account data, browsing
history, or anything outside of Instagram's own ad-classification fields on
the pages you are already viewing. It does not send any data to any server
operated by the developer or any third party.

## Data the extension stores

One key in `chrome.storage.sync`:

| Key       | Value               | Purpose                  |
|-----------|---------------------|--------------------------|
| `enabled` | `true` or `false`   | Remember on/off toggle   |

That's it. No identifiers, no timestamps, no usage counters.

## Permissions

- **`storage`** — persist the on/off toggle.
- **host permission `https://www.instagram.com/*`** — inject the scripts that
  filter ads on Instagram. The extension has no access to any other site.

## Third parties

None. The extension does not integrate with, contact, or share data with any
third-party service.

## Changes to this policy

Updates will be published in this file on the project repository:
https://github.com/jiahongc/instagram-web-ad-skip-extension

## Contact

Questions or concerns: open an issue at
https://github.com/jiahongc/instagram-web-ad-skip-extension/issues
