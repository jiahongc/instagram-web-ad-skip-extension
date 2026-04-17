# CLAUDE.md — Project Rules

## Versioning

**Always bump the version in `manifest.json` before every commit that gets
pushed.** No exceptions, even for README/docs/script-only changes. This keeps
unpacked installs reloading correctly and gives the Chrome Web Store a clean
audit trail.

Convention (semver-ish):

- **Patch** (`0.2.0` → `0.2.1`): bug fixes, perf, docs, scripts, README,
  PRIVACY, STORE_LISTING, icon refresh.
- **Minor** (`0.2.x` → `0.3.0`): new feature, new permission, new content
  script, new popup behavior.
- **Major** (`0.x.y` → `1.0.0`): breaking change to manifest schema or
  user-visible behavior, or first public release.

Workflow per commit:

1. Edit `manifest.json` → bump `"version"`.
2. Stage all changes including the manifest.
3. Commit + push.
4. If a packaged zip exists for the store, rebuild it so the filename
   matches the new version.

## Other

- Never commit `.gstack/`, `docs/superpowers/`, `docs/brainstorms/`, or
  packaged store zips with stale versions.
- Never push without explicit user approval.
