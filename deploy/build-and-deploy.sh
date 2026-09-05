#!/usr/bin/env bash
# Rebuild inferctl.dev and mirror static output into its nginx docroot.
set -euo pipefail

export PATH="/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DOCROOT="${INFERCTL_DOCROOT:-/var/www/inferctl.dev}"

log() { printf '[inferctl-site %s] %s\n' "$(date -u +%H:%M:%S)" "$*"; }

cd "$REPO_DIR"

# This checkout is deployment-only. It must exactly reflect origin/main.
if ! git remote get-url origin >/dev/null 2>&1; then
  log 'ERROR: no origin remote configured; cannot deploy'
  exit 1
fi
log 'fetching origin'
# Do not silence fetch errors: a failed fetch (e.g. lost credentials) used to
# fall through to building the stale checkout, which silently froze the live
# site at an old commit. Fail loudly instead so the systemd unit records the
# failure and the last-good docroot is left untouched. Set ALLOW_STALE_BUILD=1
# to deliberately build the current checkout offline.
if git fetch --quiet origin; then
  git rev-parse --verify --quiet origin/main >/dev/null
  log 'syncing deployment checkout to origin/main'
  git reset --hard origin/main
elif [ "${ALLOW_STALE_BUILD:-0}" = '1' ]; then
  log 'WARNING: fetch failed; ALLOW_STALE_BUILD=1 set, building current checkout'
else
  log 'ERROR: git fetch failed; refusing to deploy a stale checkout (set ALLOW_STALE_BUILD=1 to override)'
  exit 1
fi

log 'installing locked dependencies'
npm ci --no-audit --no-fund
log 'building static site'
npm run build
log "mirroring dist/ to $DOCROOT"
# Keep the root-owned legacy /inferctl/ endpoint. It links to this site's
# homepage but is not a file produced by Astro, so it cannot be owned by the
# deployment user or deleted by the static-site mirror.
rsync -a --delete --filter='P /inferctl/***' dist/ "$DOCROOT/"
log "published $(find dist -type f | wc -l | tr -d ' ') files"
