#!/usr/bin/env bash
# Run as the normal deployment user. sudo prompts stay in your terminal.
set -euo pipefail
cd /opt/apps/ma-next
command -v nginx >/dev/null
command -v certbot >/dev/null
curl --fail --silent --output /dev/null http://127.0.0.1:3010/login
sudo -v

site=/etc/nginx/sites-available/ma.rattanan.dev
enabled=/etc/nginx/sites-enabled/ma.rattanan.dev
# Preserve any existing site, including a configuration already edited by Certbot.
if sudo test -e "$site"; then
  echo "Existing $site preserved."
else
  sudo install -m 644 ops/nginx/ma.rattanan.dev.conf "$site"
fi
if ! sudo test -e "$enabled"; then
  sudo ln -s "$site" "$enabled"
fi
sudo nginx -t
sudo systemctl reload nginx

# Interactive: Certbot asks for email/terms when there is no existing account.
sudo certbot --nginx --redirect -d ma.rattanan.dev
sudo nginx -t
sudo systemctl reload nginx
if systemctl list-unit-files certbot.timer --no-legend | grep -q certbot.timer; then
  sudo systemctl enable --now certbot.timer
fi
sudo certbot renew --cert-name ma.rattanan.dev --dry-run
curl --fail --silent --show-error --output /dev/null --resolve ma.rattanan.dev:443:127.0.0.1 https://ma.rattanan.dev/login
echo 'Origin HTTPS verified. Check https://ma.rattanan.dev and use Cloudflare Full (strict) SSL mode.'
