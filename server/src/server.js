import 'dotenv/config'
import Fastify from 'fastify'
import cors from '@fastify/cors'
import jwt from '@fastify/jwt'
import { prisma, closeDb } from './db.js'
import { APP_RULE_VERSION, DEFAULT_RULE_SET_PAYLOAD } from './constants.js'
import authGuard from './auth-guard.js'
import authRoutes from './routes/auth.js'
import layoutRoutes from './routes/layouts.js'
import rulesRoutes from './routes/rules.js'
import catalogRoutes from './routes/catalog.js'
import auditRoutes from './routes/audits.js'

const app = Fastify({ logger: true })

await app.register(cors, {
  origin: true,
  credentials: true,
})

await app.register(jwt, {
  secret: process.env.JWT_SECRET || 'dev-secret-change-me',
})

await app.register(authGuard)

await app.register(authRoutes)
await app.register(layoutRoutes)
await app.register(rulesRoutes)
await app.register(catalogRoutes)
await app.register(auditRoutes)

app.get('/healthz', async () => ({ ok: true, service: 'merch-server' }))

async function ensureDefaultRuleSet() {
  const exists = await prisma.ruleSet.findUnique({ where: { version: APP_RULE_VERSION } })
  if (exists) return
  await prisma.ruleSet.create({
    data: {
      version: APP_RULE_VERSION,
      description: 'Baseline rule set from Merchandising Principles',
      payload: DEFAULT_RULE_SET_PAYLOAD,
      status: 'PUBLISHED',
      publishedAt: new Date('2025-11-13T00:00:00.000Z'),
    },
  })
}

const port = Number(process.env.PORT || 8787)
const host = '0.0.0.0'

try {
  await ensureDefaultRuleSet()
  await app.listen({ port, host })
  app.log.info(`server listening on ${host}:${port}`)
} catch (err) {
  app.log.error(err)
  await closeDb()
  process.exit(1)
}

for (const sig of ['SIGINT', 'SIGTERM']) {
  process.on(sig, async () => {
    await app.close()
    await closeDb()
    process.exit(0)
  })
}
