# VPS Deployment (Docker Compose)

This deployment uses:
- `web`: Vite build served by Nginx
- `backend`: Fastify + Prisma API
- `mysql`: MySQL 8.4

## 1. Prepare VPS

Install Docker + Docker Compose plugin, then clone the repo:

```bash
git clone https://github.com/coolyofi/Merch.git
cd Merch
```

## 2. Configure Environment

Create root `.env` from template:

```bash
cp deploy/.env.example .env
```

Edit `.env` and set strong secrets:
- `MYSQL_ROOT_PASSWORD`
- `MYSQL_PASSWORD`
- `JWT_SECRET`

## 3. Start Services

```bash
docker compose up -d --build
```

First startup runs Prisma migration automatically in backend container.

## 4. Verify

```bash
docker compose ps
curl http://127.0.0.1/api/healthz
```

Expected health response:

```json
{"ok":true,"service":"merch-server"}
```

## 5. Update Release

```bash
git pull
docker compose up -d --build
```

## 6. Optional: HTTPS

Recommended production options:
- Put Cloudflare in front of VPS (SSL mode Full/Strict).
- Or place Caddy/Nginx with Let's Encrypt in front of `web`.
