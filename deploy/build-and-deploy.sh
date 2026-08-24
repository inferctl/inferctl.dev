#!/usr/bin/env bash
# Rebuild inferctl.dev and mirror static output into its nginx docroot.
set -euo pipefail

export PATH="/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DOCROOT="${INFERCTL_DOCROOT:-/var/www/inferctl.dev}"

log() { printf '[inferctl-site %s] %s\n' "$(date -u +%H:%M:%S)" "$*"; }

cd "$REPO_DIR"

# This checkout is deployment-only. It must exactly reflect origin/main.
if git remote get-url origin >/dev/null 2>&1 && git fetch --quiet origin 2>/dev/null; then
  git rev-parse --verify --quiet origin/main >/dev/null
  log 'syncing deployment checkout to origin/main'
  git reset --hard origin/main
else
  log 'origin unavailable; building current deployment checkout'
fi

log 'installing locked dependencies'
npm ci --no-audit --no-fund
log 'building static site'
npm run build
log "mirroring dist/ to $DOCROOT"
# Keep the root-owned /inferctl/ Go vanity-import endpoint. It links to this
# site's homepage but is not a file produced by Astro, so it cannot be owned by
# the deployment user or deleted by the static-site mirror.
rsync -a --delete --filter='P /inferctl/***' dist/ "$DOCROOT/"
log "published $(find dist -type f | wc -l | tr -d ' ') files"
