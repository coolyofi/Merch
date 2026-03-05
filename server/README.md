# Merch Server (MySQL + Fastify + Prisma)

## Scope
Implements core backend services for the merchandising app:
- Auth: register/login/me
- Layouts: create/list/archive + version history + replay/recalc
- Rules: list/get/create + status workflow (draft -> review -> published)
- Catalog: list/create
- Audit: store-scoped operation logs

## Quick Start
1. Copy env:
```bash
cp .env.example .env
```
2. Ensure MySQL is running (example Homebrew):
```bash
brew install mysql
/opt/homebrew/opt/mysql/bin/mysqld --datadir=/opt/homebrew/var/mysql --socket=/tmp/mysql.sock --port=3307 --bind-address=127.0.0.1
```
3. Create database:
```bash
mysql -u root -h 127.0.0.1 -P 3307 -e "CREATE DATABASE IF NOT EXISTS merch_ops CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
```
4. Install deps + migrate:
```bash
npm install
npm run prisma:generate
npm run prisma:migrate -- --name init
```
5. Start server:
```bash
npm run dev
```

Default URL: `http://localhost:8787`

## API summary
- `POST /auth/register`
- `POST /auth/login`
- `GET /auth/me`
- `GET /layouts?storeId=...`
- `POST /layouts`
- `GET /layouts/:id/versions`
- `GET /layouts/:id/versions/:versionId`
- `POST /layouts/:id/versions`
- `POST /layouts/:id/replay`
- `POST /layouts/:id/archive`
- `GET /rules`
- `GET /rules/:version`
- `POST /rules`
- `POST /rules/:id/status`
- `GET /catalog`
- `POST /catalog`
- `GET /audits?storeId=...`

## Key Tables
Defined in [`prisma/schema.prisma`](/Users/yofiqian/计算小助手/server/prisma/schema.prisma):
- `users`
- `stores`
- `store_members`
- `layouts`
- `layout_versions`
- `catalog_items`
- `rule_sets`
- `audit_logs`

## Notes
- `ruleVersion` is saved per `layout_versions` row for replayability.
- On publish, existing published rule sets are retired automatically.
- Replay endpoint can compute and optionally persist a new layout version.
- Password reset endpoint is placeholder and must be wired to an email provider.

## VPS Deployment
- For one-command VPS deployment (`web + backend + mysql`), see `../docs/vps-deploy.md`.
