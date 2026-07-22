# Deployment Guide — JustRentLah Singpass Verification

This app runs as a Docker container. These steps deploy it to the office
Unraid server (`192.168.2.15`) and expose it publicly over HTTPS (required by
Singpass) via a Cloudflare Tunnel.

> Run everything below **on a machine on the office network** (or SSH'd into
> the Unraid box). This repo's cloud/CI environment cannot reach `192.168.2.15`.

---

## 1. Get the code onto the server

SSH into Unraid:

```bash
ssh root@192.168.2.15
mkdir -p /mnt/user/appdata/justrentlah-verify
cd /mnt/user/appdata/justrentlah-verify
git clone https://github.com/jvlarc/import-configurations.git .
cd singpass-verify
```

(To update later: `git pull` in this directory, then re-run step 5.)

---

## 2. Generate the Singpass keys (on the server)

```bash
docker run --rm -v "$PWD":/app -w /app node:20-alpine \
  sh -c "npm ci --omit=dev >/dev/null 2>&1 && node scripts/generate-keys.js"
```

This prints four values (`SIGNING_KID`, `ENCRYPTION_KID`,
`SIGNING_PRIVATE_KEY_B64`, `ENCRYPTION_PRIVATE_KEY_B64`) and writes the public
`keys/jwks.json`. Keep the private values secret — never commit them.

> Do NOT reuse any keys generated elsewhere (e.g. a laptop demo). Generate
> them here, on the box that will run the container.

---

## 3. Create the `.env` file

```bash
cp .env.example .env
nano .env
```

Fill in:

| Variable | Where it comes from |
|---|---|
| `SINGPASS_CLIENT_ID` | Developer Portal → your app → Configuration → Credentials → **App ID** |
| `SINGPASS_REDIRECT_URI` | `https://verify.justrentlah.com/auth/callback` |
| `SIGNING_KID`, `ENCRYPTION_KID` | printed in step 2 |
| `SIGNING_PRIVATE_KEY_B64`, `ENCRYPTION_PRIVATE_KEY_B64` | printed in step 2 |
| `MYINFO_SCOPES` | leave as default (free-tier Standard scopes) |
| `BOOQABLE_COMPANY_SLUG` | `justrentlah` |
| `BOOQABLE_API_KEY` | Booqable → Settings → API access |
| `APP_URL` | `https://verify.justrentlah.com` |
| `SESSION_SECRET` | run `openssl rand -hex 32` |
| `ADMIN_USERNAME`, `ADMIN_PASSWORD` | your choice — protects `/admin` and `/counter` |

Staging vs production: `.env.example` ships with **staging** (`stg-id`)
endpoints. When Singpass approves production, swap `stg-id` → `id` in the
three Singpass URLs.

---

## 4. Build and run the container

```bash
docker compose up -d --build
```

Check it's healthy on the LAN:

```bash
curl http://192.168.2.15:8947/health          # -> {"status":"ok"}
curl http://192.168.2.15:8947/.well-known/jwks.json   # -> your public JWKS
```

The compose file maps host port **8947** → container 3000 and persists the
verification store in `./data`.

### Adding it via the Unraid Docker UI (alternative to CLI)
- Docker tab → **Add Container**
- Repository: build locally, or point to the compose stack via the
  **Compose Manager** plugin (recommended — it reads `docker-compose.yml`).
- Map port `8947:3000`, bind `./data` → `/app/data`, and load the `.env` file.

---

## 5. Expose publicly over HTTPS (Cloudflare Tunnel)

Singpass staging/production must be able to reach your JWKS + callback over
HTTPS, so `192.168.2.15:8947` needs a public hostname.

```bash
# Install cloudflared (or use the Unraid Community Apps "cloudflared" template)
cloudflared tunnel login
cloudflared tunnel create justrentlah-verify
cloudflared tunnel route dns justrentlah-verify verify.justrentlah.com
```

Point the tunnel ingress at the container:

```yaml
# ~/.cloudflared/config.yml
tunnel: justrentlah-verify
credentials-file: /root/.cloudflared/<tunnel-id>.json
ingress:
  - hostname: verify.justrentlah.com
    service: http://192.168.2.15:8947
  - service: http_status:404
```

```bash
cloudflared tunnel run justrentlah-verify   # or install as a service
```

Verify from **outside** the network:

```
https://verify.justrentlah.com/.well-known/jwks.json
https://verify.justrentlah.com/verify
```

> Alternative: Nginx Proxy Manager (Unraid Community Apps) with a Let's Encrypt
> cert, reverse-proxying `verify.justrentlah.com` → `192.168.2.15:8947`.

---

## 6. Wire up Singpass + test

1. In the Developer Portal, confirm the app's **Redirect URL** is
   `https://verify.justrentlah.com/auth/callback` and the **JWKS endpoint** is
   `https://verify.justrentlah.com/.well-known/jwks.json`.
2. Go to `https://verify.justrentlah.com/verify` and click **Verify with Singpass**.
3. Scan with a **staging test persona** (e.g. foreigner `G4440433N`, PR
   `S7790722Z`, citizen `S7790720C`).
4. Check `https://verify.justrentlah.com/admin` — the persona should appear with
   the correct local/foreigner flag.

---

## Operating notes

- **No SLA.** Singpass gives no uptime guarantee and total liability is capped
  at SGD 100/yr. Always keep a manual fallback (staff / passport check) so a
  Singpass outage never blocks a collection.
- **24-hour breach reporting.** If the app or server is breached, you must
  notify GovTech (`partnersupport@singpass.gov.sg`) within 24 hours. Keep the
  `data/` logs and know who reports.
- **Backups.** The `data/verifications.json` store holds verification records —
  include `/mnt/user/appdata/justrentlah-verify` in your Unraid backup.
- **Secrets.** `.env` and `keys/` are gitignored. Never commit them.
