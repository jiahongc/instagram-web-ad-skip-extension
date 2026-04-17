#!/usr/bin/env bash
# Pull the latest Instagram Web Ad Skip code and prompt Chrome to reload it.
#
# Usage:
#   bash scripts/update.sh
#
# Run from the cloned extension directory. Works on macOS, Linux, and Windows
# (via Git Bash / WSL). After updating, click the reload icon on the extension
# card in chrome://extensions, or hit the "Update" button at the top of that
# page (Developer mode must be on) to apply changes.

set -euo pipefail

REPO_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO_DIR"

if [ ! -d .git ]; then
  echo "error: $REPO_DIR is not a git checkout" >&2
  echo "       re-install with: git clone https://github.com/jiahongc/instagram-web-ad-skip-extension.git" >&2
  exit 1
fi

CURRENT_BRANCH="$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo HEAD)"
echo "==> Updating $REPO_DIR (branch: $CURRENT_BRANCH)"

git fetch --quiet origin
LOCAL="$(git rev-parse @ 2>/dev/null)"
REMOTE="$(git rev-parse '@{u}' 2>/dev/null || echo "")"

if [ -z "$REMOTE" ]; then
  echo "warning: no upstream tracking branch; skipping pull"
elif [ "$LOCAL" = "$REMOTE" ]; then
  echo "==> Already up to date ($LOCAL)"
else
  echo "==> Pulling fast-forward changes"
  git pull --ff-only --quiet
  NEW="$(git rev-parse @)"
  echo "==> Updated: $LOCAL -> $NEW"
fi

VERSION="$(grep -E '"version"' manifest.json | head -1 | sed -E 's/.*"version"[^"]*"([^"]+)".*/\1/')"
echo "==> Extension version in manifest: $VERSION"

case "$(uname -s)" in
  Darwin)
    if open -a "Google Chrome" "chrome://extensions" 2>/dev/null; then
      echo "==> Opened chrome://extensions in Chrome"
    fi
    ;;
  Linux)
    if command -v xdg-open >/dev/null 2>&1; then
      xdg-open "chrome://extensions" >/dev/null 2>&1 || true
    fi
    ;;
  MINGW*|MSYS*|CYGWIN*)
    cmd.exe /c start chrome "chrome://extensions" >/dev/null 2>&1 || true
    ;;
esac

cat <<'EOF'

==> Next step
    In chrome://extensions:
      1. Make sure "Developer mode" is ON (top right).
      2. Click the circular reload icon on the
         "Instagram Web Ad Skip" card,
         OR click "Update" at the top of the page to refresh
         all unpacked extensions at once.
    Then refresh any open Instagram tabs.
EOF
