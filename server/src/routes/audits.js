import { prisma } from '../db.js'

export default async function auditRoutes(fastify) {
  fastify.get('/audits', { preHandler: [fastify.requireAuth] }, async (request, reply) => {
    const storeId = request.query?.storeId
    if (!storeId) return reply.code(400).send({ message: 'storeId is required' })
    const ok = await fastify.requireStoreRole(request, reply)
    if (!ok) return

    return prisma.auditLog.findMany({
      where: { storeId },
      orderBy: { createdAt: 'desc' },
      take: 200,
    })
  })
}
