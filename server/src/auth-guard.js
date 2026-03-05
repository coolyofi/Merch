import fp from 'fastify-plugin'
import { prisma } from './db.js'

async function guardPlugin(fastify) {
  fastify.decorate('requireAuth', async function requireAuth(request, reply) {
    try {
      const payload = await request.jwtVerify()
      request.user = payload
    } catch {
      return reply.code(401).send({ message: 'Unauthorized' })
    }
  })

  fastify.decorate('requireStoreRole', async function requireStoreRole(request, reply, roles = ['OWNER', 'EDITOR', 'VIEWER']) {
    const storeId = request.params?.storeId || request.query?.storeId || request.body?.storeId
    if (!storeId) {
      reply.code(400).send({ message: 'storeId is required' })
      return false
    }
    const member = await prisma.storeMember.findUnique({
      where: {
        storeId_userId: {
          storeId,
          userId: request.user.sub,
        },
      },
    })
    if (!member) {
      reply.code(403).send({ message: 'No access to this store' })
      return false
    }
    if (!roles.includes(member.role)) {
      reply.code(403).send({ message: 'Insufficient permissions' })
      return false
    }
    request.memberRole = member.role
    return true
  })

  fastify.decorate('writeAudit', async function writeAudit(data) {
    try {
      await prisma.auditLog.create({ data })
    } catch (err) {
      fastify.log.error({ err }, 'failed to write audit log')
    }
  })
}

export default fp(guardPlugin)
