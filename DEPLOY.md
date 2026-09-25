# Self-hosting: Docker on a private network, published through Cloudflare Tunnel

```
Internet ──HTTPS──► Cloudflare edge (TLS, WAF, optional Access login)
                          ▲
                          │ outbound-only tunnel (cloudflared dials out, no inbound ports)
┌─────────────────────────┴──────────── private network / Docker host ─┐
│  cloudflared container ──http──► atlas container (nginx :8080)        │
│            (compose network "okta-docs-atlas")                       │
└──────────────────────────────────────────────────────────────────────┘
```

The site is static files served by unprivileged nginx. There is no backend, no database, and no secret apart from the tunnel token. You don't need port forwarding or firewall openings for inbound traffic.

## What's in the repo

| File | Purpose |
|---|---|
| `Dockerfile` | Multi-stage build: Node 22 builds the app, `nginx-unprivileged` serves `dist/` on port 8080 as a non-root user |
| `deploy/nginx.conf` | SPA fallback, long cache for fingerprinted assets, `no-cache` for `index.html`, security headers incl. CSP, `/healthz`, logs with the visitor IP from `CF-Connecting-IP` |
| `docker-compose.yml` | `atlas` web container plus a `cloudflared` sidecar on a private compose network. Read-only root filesystem, all capabilities dropped |
| `.env.example` | Tunnel token and optional LAN test binding |

## Prerequisites

- Docker Engine 24 or later with the Compose v2 plugin (`docker compose version`)
- A domain whose DNS is managed by Cloudflare (a free plan is enough)
- Outbound access from the Docker host to Cloudflare on **port 7844** (TCP and UDP) and 443. If UDP 7844 is blocked, cloudflared falls back to HTTP/2 over TCP

## 1. Test on the LAN first (no Cloudflare)

```bash
docker build -t okta-docs-atlas .
docker run -d --name atlas-test -p 127.0.0.1:8080:8080 \
  --read-only --tmpfs /tmp --tmpfs /var/cache/nginx --cap-drop ALL okta-docs-atlas
curl -I http://127.0.0.1:8080/          # expect 200 and a Content-Security-Policy header
curl http://127.0.0.1:8080/healthz      # expect "ok"
docker rm -f atlas-test
```

Replace `127.0.0.1` with the server's private IP to reach it from other machines on the LAN.

## 2. Create the tunnel in Cloudflare

1. In the Cloudflare dashboard, open **Networking → Tunnels** (in older layouts: **Zero Trust → Networks → Tunnels**) and select **Create a tunnel**.
2. Choose **Cloudflared** as the connector type and name the tunnel, for example `okta-docs-atlas`.
3. On the install step, pick **Docker**. The page shows a command like `docker run cloudflare/cloudflared:latest tunnel --no-autoupdate run --token eyJh…`. Copy only the token (the long string after `--token`). Don't run that command.
4. Add a route (called **Public hostname** or **Published application route**, depending on dashboard version):
   - **Subdomain:** `atlas` (or whatever you want)
   - **Domain:** your Cloudflare zone
   - **Service:** type `HTTP`, URL `atlas:8080`
   
   `atlas` is the compose service name. cloudflared resolves it on the shared compose network. Don't use `localhost` here: inside the cloudflared container, localhost is cloudflared itself.
5. Save. Cloudflare creates the proxied DNS record for the hostname automatically.

## 3. Start the stack

```bash
cp .env.example .env
# edit .env and paste the token into TUNNEL_TOKEN=
chmod 600 .env
docker compose up -d --build
docker compose ps          # atlas should show "healthy", cloudflared "running"
docker compose logs -f cloudflared   # look for "Registered tunnel connection" (normally 4 connections)
```

The tunnel should show **Healthy** in the dashboard. Open `https://atlas.<your-domain>`.

Once the public URL works, delete the `ports:` block from the `atlas` service in `docker-compose.yml` and run `docker compose up -d`. After that, the only way in is through Cloudflare.

## 4. Baseline Cloudflare settings

- **SSL/TLS → Edge Certificates:** turn on *Always Use HTTPS*. Enable HSTS only after the site has worked over HTTPS for a while, because HSTS is hard to undo.
- **Speed / optimisation:** turn off *Rocket Loader*, *Email Address Obfuscation* and automatic *Web Analytics* injection for this hostname. They inject scripts that the site's Content-Security-Policy blocks by design. If you want Cloudflare Web Analytics, add `https://static.cloudflareinsights.com` to `script-src` and `https://cloudflareinsights.com` to `connect-src` in both `deploy/nginx.conf` and the `CSP` list in `vite.config.ts`, and update `public/privacy.html`, because analytics needs consent under ePrivacy rules.
- **Caching:** defaults are fine. `/assets/*` files are fingerprinted and sent with a one-year immutable cache header, and `index.html` is `no-cache`, so a new deploy is visible right away without purging.
- **Security → WAF / Bots:** the managed rules and Bot Fight Mode are safe to turn on. The site has no forms or APIs to break.

## 5. Decide who can see it (Cloudflare Access)

The content is public Okta documentation, so a public site is reasonable. To limit it to your team or customers, put Cloudflare Access in front of it. The container doesn't change.

1. **Zero Trust → Access → Applications → Add an application → Self-hosted.**
2. Application domain: the same `atlas.<your-domain>` hostname.
3. Add a policy, for example *Allow* where *Emails ending in* `@your-company.com`.
4. Identity: one-time PIN works immediately. For SSO, add Okta under **Settings → Authentication → Login methods** as an OIDC provider, using an Okta OIDC web app with redirect URI `https://<team-name>.cloudflareaccess.com/cdn-cgi/access/callback`.

## Updating

| Change | Command |
|---|---|
| New release data or map pages (edit `src/data/*.ts`) | `docker compose up -d --build` |
| Newer cloudflared | bump the image tag in `docker-compose.yml`, then `docker compose pull cloudflared && docker compose up -d` |
| Newer nginx base image | `docker compose build --pull && docker compose up -d` |

The cloudflared image is pinned to `2026.9.3`, the newest release tag on the cloudflared GitHub repo when this was written. Check that the tag exists on Docker Hub before the first `up`. If it doesn't, use the newest tag Docker Hub lists.

## Troubleshooting

| Symptom | Likely cause |
|---|---|
| Browser shows Cloudflare **502 / Bad gateway** | The route's service URL is wrong. It must be `http://atlas:8080`, not `localhost`, not `https` |
| Tunnel stays **Inactive / Down** | Outbound 7844 blocked. Add `--protocol http2` to the cloudflared `command:` to use TCP 443 instead |
| `required variable TUNNEL_TOKEN is missing` | `.env` missing or empty; it must sit next to `docker-compose.yml` |
| Page loads but the map is blank | WebGL is disabled in that browser, or a Cloudflare feature injected a script. Check the browser console for CSP errors |
| Visitor IPs in logs show `-` | Normal for requests that didn't come through Cloudflare (for example LAN tests) |

### Already running cloudflared elsewhere?

Skip the `cloudflared` service: delete it from `docker-compose.yml`. Bind the site to the server's private IP (`LAN_BIND=192.168.x.y` in `.env`) and point your existing tunnel's route at `http://192.168.x.y:8080`.
