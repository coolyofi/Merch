import { z } from 'zod'
import { prisma } from '../db.js'
import { APP_RULE_VERSION, DEFAULT_RULE_SET_PAYLOAD } from '../constants.js'

const createRuleSchema = z.object({
  version: z.string().min(1),
  description: z.string().optional(),
  payload: z.any(),
  status: z.enum(['DRAFT', 'REVIEW', 'PUBLISHED', 'RETIRED']).default('DRAFT'),
})

const updateStatusSchema = z.object({
  status: z.enum(['DRAFT', 'REVIEW', 'PUBLISHED', 'RETIRED']),
})

const ALLOWED = {
  DRAFT: ['REVIEW'],
  REVIEW: ['DRAFT', 'PUBLISHED'],
  PUBLISHED: ['RETIRED'],
  RETIRED: [],
}

export default async function rulesRoutes(fastify) {
  fastify.get('/rules', { preHandler: [fastify.requireAuth] }, async () => {
    const rules = await prisma.ruleSet.findMany({ orderBy: { publishedAt: 'desc' } })
    return rules
  })

  fastify.get('/rules/:version', { preHandler: [fastify.requireAuth] }, async (request) => {
    const version = request.params.version || APP_RULE_VERSION
    const rule = await prisma.ruleSet.findUnique({ where: { version } })
    if (rule) return rule
    if (version === APP_RULE_VERSION) {
      return {
        id: 'builtin',
        version: APP_RULE_VERSION,
        description: 'Built-in fallback rule set',
        payload: DEFAULT_RULE_SET_PAYLOAD,
        status: 'PUBLISHED',
        publishedAt: '2025-11-13T00:00:00.000Z',
      }
    }
    return null
  })

  fastify.post('/rules', { preHandler: [fastify.requireAuth] }, async (request, reply) => {
    const parsed = createRuleSchema.safeParse(request.body)
    if (!parsed.success) return reply.code(400).send({ message: 'Invalid payload', issues: parsed.error.issues })

    const created = await prisma.ruleSet.create({ data: parsed.data })
    await fastify.writeAudit({
      actorId: request.user.sub,
      action: 'rule.create',
      targetType: 'rule_set',
      targetId: created.id,
      afterData: { version: created.version, status: created.status },
    })
    return created
  })

  fastify.post('/rules/:id/status', { preHandler: [fastify.requireAuth] }, async (request, reply) => {
    const parsed = updateStatusSchema.safeParse(request.body)
    if (!parsed.success) return reply.code(400).send({ message: 'Invalid payload', issues: parsed.error.issues })
    const rule = await prisma.ruleSet.findUnique({ where: { id: request.params.id } })
    if (!rule) return reply.code(404).send({ message: 'Rule not found' })
    const target = parsed.data.status
    if (!ALLOWED[rule.status]?.includes(target)) {
      return reply.code(409).send({ message: `Invalid transition ${rule.status} -> ${target}` })
    }

    const updated = await prisma.$transaction(async (tx) => {
      if (target === 'PUBLISHED') {
        await tx.ruleSet.updateMany({
          where: { status: 'PUBLISHED', id: { not: rule.id } },
          data: { status: 'RETIRED' },
        })
      }
      return tx.ruleSet.update({
        where: { id: rule.id },
        data: {
          status: target,
          publishedAt: target === 'PUBLISHED' ? new Date() : rule.publishedAt,
        },
      })
    })

    await fastify.writeAudit({
      actorId: request.user.sub,
      action: 'rule.status.update',
      targetType: 'rule_set',
      targetId: updated.id,
      beforeData: { status: rule.status },
      afterData: { status: updated.status },
    })
    return updated
  })
}
