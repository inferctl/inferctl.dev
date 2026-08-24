#!/usr/bin/env bash
# One-time root installer. Run on waazh from a checkout of this repository:
#   sudo INSTALL_NGINX=1 bash deploy/bootstrap.sh
set -euo pipefail

REPO_DIR=/srv/inferctl-site
ENV_FILE=/etc/inferctl-site.env
DEPLOY_USER=deploy
SRC_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

if [[ $EUID -ne 0 ]]; then
  echo 'Run as root: sudo INSTALL_NGINX=1 bash deploy/bootstrap.sh' >&2
  exit 1
fi

echo "==> Installing source in $REPO_DIR"
mkdir -p "$REPO_DIR"
rsync -a --delete --exclude node_modules --exclude dist --exclude .astro --exclude .docs-build \
  "$SRC_DIR/" "$REPO_DIR/"
chown -R "$DEPLOY_USER:$DEPLOY_USER" "$REPO_DIR"

echo "==> Writing $ENV_FILE"
umask 077
{
  echo 'INFERCTL_DOCS_REPO=inferctl/inferctl'
  echo 'INFERCTL_DOCS_REF=main'
  echo 'INFERCTL_DOCS_DIR=docs'
  echo 'INFERCTL_DOCROOT=/var/www/inferctl.dev'
} > "$ENV_FILE"
chown "$DEPLOY_USER:$DEPLOY_USER" "$ENV_FILE"
chmod 600 "$ENV_FILE"

echo '==> Installing systemd units'
install -m 644 "$REPO_DIR/deploy/inferctl-site.service" /etc/systemd/system/
install -m 644 "$REPO_DIR/deploy/inferctl-site.timer" /etc/systemd/system/
systemctl daemon-reload
systemctl enable --now inferctl-site.timer

if [[ "${INSTALL_NGINX:-0}" == 1 ]]; then
  echo '==> Installing nginx site configuration'
  install -m 644 "$REPO_DIR/deploy/inferctl.dev.nginx" /etc/nginx/sites-available/inferctl.dev
  ln -sf /etc/nginx/sites-available/inferctl.dev /etc/nginx/sites-enabled/inferctl.dev
  nginx -t
  systemctl reload nginx
fi

echo '==> Starting first deployment'
systemctl start inferctl-site.service
systemctl list-timers inferctl-site.timer --no-pager || true
journalctl -u inferctl-site.service -n 20 --no-pager || true
