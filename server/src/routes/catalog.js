import { z } from 'zod'
import { prisma } from '../db.js'

const createCatalogSchema = z.object({
  key: z.string().min(1),
  name: z.string().min(1),
  category: z.string().min(1),
  productType: z.string().min(1),
  widthIn: z.number().positive(),
  metadata: z.any().optional(),
  status: z.enum(['DRAFT', 'REVIEW', 'PUBLISHED', 'RETIRED']).default('DRAFT'),
})

export default async function catalogRoutes(fastify) {
  fastify.get('/catalog', { preHandler: [fastify.requireAuth] }, async (request) => {
    const status = request.query?.status
    const where = status ? { status } : {}
    return prisma.catalogItem.findMany({ where, orderBy: { updatedAt: 'desc' } })
  })

  fastify.post('/catalog', { preHandler: [fastify.requireAuth] }, async (request, reply) => {
    const parsed = createCatalogSchema.safeParse(request.body)
    if (!parsed.success) return reply.code(400).send({ message: 'Invalid payload', issues: parsed.error.issues })

    const created = await prisma.catalogItem.create({ data: parsed.data })
    await fastify.writeAudit({
      actorId: request.user.sub,
      action: 'catalog.create',
      targetType: 'catalog_item',
      targetId: created.id,
      afterData: { key: created.key, status: created.status },
    })
    return created
  })
}
