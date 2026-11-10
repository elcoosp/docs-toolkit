#!/usr/bin/env bash
# Cache the canonical git-cliff config locally so `git cliff` works offline.
# Reads $GIT_CLIFF_CONFIG_URL if set, otherwise uses the public canonical URL.
set -euo pipefail

URL="${GIT_CLIFF_CONFIG_URL:-https://raw.githubusercontent.com/elcoosp/docs-toolkit/main/git-cliff/cliff.toml}"
DEST="${1:-$HOME/.config/cliff.toml}"

mkdir -p "$(dirname "$DEST")"
echo "→ fetching $URL"
curl -fsSL "$URL" -o "$DEST"
echo "✓ wrote $DEST ($(wc -l < "$DEST" | tr -d ' ') lines)"
echo
echo "Set once in your shell profile for URL-based usage:"
echo "  export GIT_CLIFF_CONFIG_URL=\"$URL\""
