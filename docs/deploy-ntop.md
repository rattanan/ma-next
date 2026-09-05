# Deploy on ntop

Application: `/opt/apps/ma-next`, branch `main`, PM2 name `ma-next`, loopback port `3010`, domain `ma.rattanan.dev`.

The server owns `.env` and persistent `storage/`; neither is committed. Production requires `DATABASE_URL`. PM2 sets the public URL and trusted origin. No database migration or seed is included in this UI deployment.

As the deployment user:

```bash
cd /opt/apps/ma-next
git pull --ff-only origin main
npm ci --include=dev
npm run build
pm2 startOrRestart ecosystem.config.js --only ma-next --update-env
curl --fail http://127.0.0.1:3010/login -o /dev/null
pm2 save
```

The host already has the `pm2-rattanan` startup service enabled. Do not run PM2 with sudo or restart other applications.

For Nginx and HTTPS, run interactively (sudo password and any Certbot account prompts stay in your terminal):

```bash
bash scripts/setup-ma-web.sh
```

The script preserves existing site configuration, checks Nginx before reload, requests the domain certificate, tests renewal and verifies origin HTTPS. Nginx/Certbot are already installed. Ports 80/443 must reach this host. DNS currently uses Cloudflare; use Full (strict) after origin certificate issuance. Avoid Flexible mode with HTTPS redirects.

For a later code rollback, select a previously verified commit in Git, rebuild, and restart only `ma-next`. Keep `.env` and storage intact. The deployment above builds in place and is not a zero-downtime release procedure.

References: [PM2 ecosystem configuration](https://pm2.keymetrics.io/docs/usage/application-declaration/), [Certbot Nginx](https://eff-certbot.readthedocs.io/en/stable/using.html#nginx).
