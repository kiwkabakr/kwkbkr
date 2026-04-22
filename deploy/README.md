# Deploy — Czutka.gg on a single Ubuntu VPS

Three apps on one box:

- **nginx** → serves built frontend + reverse-proxies `/api/*` to backend
- **backend** (Node/Express) on `127.0.0.1:3000` via systemd
- **telegrambot** (Python) via systemd, talks to backend over loopback

Before you start: **rotate any secret that was ever committed or shared** —
Mongo password, `TELEGRAM_BOT_TOKEN`, `ALCHEMY_API_KEY`, `BOT_API_KEY`,
and especially `MASTER_MNEMONIC`. Make `BOT_API_KEY` a fresh long random
string, independent from the bot token.

---

## How this connects to the domain (czutka.gg)

- **Web + API in one place** — Users only open `https://czutka.gg`. The static frontend is served at `/`, and the Node backend is reached at **`/api/...` on the same host** (nginx proxies to `127.0.0.1:3000`). You do not need `api.czutka.gg` unless you change the architecture.
- **Telegram bot** — Runs on the same VPS, talks to the backend at **`http://127.0.0.1:3000`**. The bot uses **long polling** (outbound to Telegram), so it does **not** need a public URL or domain for webhooks. Only the bot process and Telegram’s servers are involved.
- **Backend env** — Set `FRONTEND_URL=https://czutka.gg` (exact CORS origin). Leave `VITE_API_URL` empty in production so the browser calls the same origin (`/api/...`).

Run the steps below as a sudo user.

### 1. Packages + app user

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y nginx git ufw python3-venv python3-pip certbot python3-certbot-nginx
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

sudo useradd -r -m -d /srv/czutkagg -s /bin/bash czutkagg
sudo mkdir -p /etc/czutkagg && sudo chmod 750 /etc/czutkagg
```

### 2. Firewall

```bash
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'
sudo ufw enable
```

### 3. DNS (nameservers vs records)

- **What you must have:** an **`A` record** for `czutka.gg` (sometimes shown as `@`) pointing to your VPS **public IP**, and the same (or a `CNAME` from `www` to the apex) for **`www.czutka.gg`**. Wait for DNS to propagate before certbot.
- **Nameservers:** you only *change* nameservers if you want another provider (e.g. Cloudflare) to host your DNS. If your **registrar’s panel** already lets you add **A / CNAME** records, you can leave nameservers as-is and just add those records there. After DNS points to the server, `czutka.gg` resolves; nginx and Certbot do the rest.

### 4. Clone the code

```bash
sudo -iu czutkagg git clone <your-repo-url> /srv/czutkagg
```

### 5. Backend

```bash
sudo -iu czutkagg bash -c 'cd /srv/czutkagg/backend && npm ci && npm run build'

sudo install -o czutkagg -g czutkagg -m 600 \
  /srv/czutkagg/backend/.env.production.example /etc/czutkagg/backend.env
sudo -e /etc/czutkagg/backend.env   # fill in real values; set FRONTEND_URL=https://czutka.gg
```

### 6. Telegram bot

```bash
sudo -iu czutkagg bash -c '
  cd /srv/czutkagg/telegrambot
  python3 -m venv venv
  ./venv/bin/pip install -r requirements.txt
'

sudo install -o czutkagg -g czutkagg -m 600 \
  /srv/czutkagg/telegrambot/.env.production.example /etc/czutkagg/telegrambot.env
sudo -e /etc/czutkagg/telegrambot.env   # BOT_TOKEN, BOT_API_KEY; keep BACKEND_URL=http://127.0.0.1:3000
```

### 7. Frontend build + nginx

```bash
sudo -iu czutkagg bash -c 'cd /srv/czutkagg/frontend && npm ci && npm run build'

sudo mkdir -p /var/www/czutkagg
sudo rsync -a --delete /srv/czutkagg/frontend/dist/ /var/www/czutkagg/dist/
sudo chown -R www-data:www-data /var/www/czutkagg

sudo cp /srv/czutkagg/deploy/nginx/czutkagg.conf /etc/nginx/sites-available/czutkagg
# If you use a different hostname, edit server_name in that file
sudo ln -sf /etc/nginx/sites-available/czutkagg /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl reload nginx
```

### 8. HTTPS

```bash
sudo certbot --nginx -d czutka.gg -d www.czutka.gg
```

Certbot rewrites the vhost with `listen 443 ssl` and a `:80 -> :443` redirect.
Renewal runs automatically via the `certbot.timer` unit.

### 9. Services

```bash
sudo cp /srv/czutkagg/deploy/systemd/*.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now czutkagg-backend czutkagg-telegrambot
```

Smoke test:

```bash
curl -sf https://czutka.gg/api/health
# -> {"ok":true}
```

Logs:

```bash
journalctl -u czutkagg-backend -f
journalctl -u czutkagg-telegrambot -f
```

---

## Re-deploy (after code changes)

```bash
cd /srv/czutkagg && sudo -u czutkagg git pull

# backend
sudo -u czutkagg bash -c 'cd backend && npm ci && npm run build'
sudo systemctl restart czutkagg-backend

# telegram bot
sudo -u czutkagg bash -c 'cd telegrambot && ./venv/bin/pip install -r requirements.txt'
sudo systemctl restart czutkagg-telegrambot

# frontend
sudo -u czutkagg bash -c 'cd frontend && npm ci && npm run build'
sudo rsync -a --delete /srv/czutkagg/frontend/dist/ /var/www/czutkagg/dist/
```

---

## Troubleshooting

- **502 Bad Gateway on /api** — backend isn't listening. Check
  `systemctl status czutkagg-backend` and `journalctl -u czutkagg-backend -n 100`.
- **CORS error in browser** — `FRONTEND_URL` in `/etc/czutkagg/backend.env`
  must exactly match the site origin (scheme + host, no trailing slash).
- **Bot can't reach backend** — `BACKEND_URL` must be
  `http://127.0.0.1:3000`, and `BOT_API_KEY` must match on both sides.
- **New frontend build not showing** — browsers cache `index.html` aggressively
  via some CDNs/proxies. The nginx config already sends `no-cache` on `/index.html`;
  hard-reload to confirm.
