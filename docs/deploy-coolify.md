# Deploy pno-table with Coolify

pno-table runs as a single Node container with a persistent volume for its SQLite metadata database.

## Prerequisites

- A [Coolify](https://coolify.io/) instance (v4+)
- A Git repository containing this project
- Network access from the Coolify host to your Postgres servers

Generate a master key:

```bash
openssl rand -hex 32
```

Store it securely. **Do not change it after deployment** — encrypted connection passwords become unreadable if the key changes.

## Option A — Dockerfile application (recommended)

1. In Coolify, create a **New Resource → Application**.
2. Connect your Git repository and select the branch to deploy.
3. Set **Build Pack** to **Dockerfile** (Coolify detects `Dockerfile` in the repo root).
4. Set **Port** to `3000`.
5. Under **Environment Variables**, add:

   | Variable | Value |
   |----------|-------|
   | `PNO_MASTER_KEY` | Output of `openssl rand -hex 32` |
   | `PNO_DATA_DIR` | `/data` |
   | `PNO_AUTH_PASSWORD` | Strong shared password (enables login gate) |

6. Under **Persistent Storage**, add a volume:

   | Mount path | Description |
   |------------|-------------|
   | `/data` | SQLite metadata (saved connections) |

7. Enable **HTTPS** on your Coolify domain (Traefik/Caddy proxy handles TLS).
8. Deploy.

On each deploy, the container runs `drizzle-kit push` before starting the server so the SQLite schema stays in sync.

## Option B — Docker Compose

If you prefer a Compose resource in Coolify:

1. Create **New Resource → Docker Compose**.
2. Point at this repository (`docker-compose.yml` in the root).
3. Set `PNO_MASTER_KEY` in the Compose environment (or Coolify secrets).
4. Ensure the `pno-data` volume is retained across redeploys.

Coolify injects its own proxy; you usually do not need to publish host ports in Compose.

## Security notes

pno-table uses a **single shared password** when `PNO_AUTH_PASSWORD` is set — suitable for a small trusted team behind HTTPS, not multi-tenant SaaS.

Before exposing the app beyond a trusted network:

- Put it behind VPN, IP allowlisting, or an SSO reverse proxy (Authelia, Cloudflare Access, etc.).
- Use read-only Postgres roles where possible.
- Back up `/data/pno-table.sqlite` regularly together with your `PNO_MASTER_KEY`.

## Local smoke test

```bash
export PNO_MASTER_KEY="$(openssl rand -hex 32)"
docker compose up --build
```

Open http://localhost:3000 (Coolify will assign its own domain in production).

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| Container exits immediately | Check `PNO_MASTER_KEY` is set (min 16 chars). |
| Connections disappear after redeploy | Persistent volume missing at `/data`. |
| Cannot reach Postgres | Firewall / security group must allow egress from the Coolify host to Postgres port 5432. |
| `better-sqlite3` build errors | Ensure Coolify builds on Linux amd64/arm64 with the provided Dockerfile (do not use a Node buildpack without native module support). |
