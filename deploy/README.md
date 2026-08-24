# Deploying inferctl.dev

The site rebuilds each night on waazh. It fetches its own `origin/main`, runs
`npm ci` and `npm run build`, then mirrors `dist/` to `/var/www/inferctl.dev`.
The build fetches documentation from `inferctl/inferctl@main`.

## One-time install

Push the site `main` branch first. Then a human with root access runs this on
waazh from a checkout of the site repository:

```sh
sudo INSTALL_NGINX=1 bash deploy/bootstrap.sh
```

Configure DNS for `inferctl.dev` and `www.inferctl.dev`, then issue a TLS
certificate that covers both names. The bundled nginx configuration redirects
`www` to the apex domain.

## Operations

```sh
sudo systemctl start inferctl-site.service
journalctl -u inferctl-site.service -f
systemctl list-timers inferctl-site.timer
```

## Rollback

Stop the service and timer, then restore the archived MkDocs output or prior
static build into `/var/www/inferctl.dev`. Restore the prior nginx file if the
failure is at the proxy layer. Do not edit `/srv/inferctl-site` by hand.
