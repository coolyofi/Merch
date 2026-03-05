import bcrypt from 'bcryptjs'
import { z } from 'zod'
import { prisma } from '../db.js'

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(1).optional(),
  storeName: z.string().min(1).optional(),
})

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
})

export default async function authRoutes(fastify) {
  fastify.post('/auth/register', async (request, reply) => {
    const parsed = registerSchema.safeParse(request.body)
    if (!parsed.success) return reply.code(400).send({ message: 'Invalid payload', issues: parsed.error.issues })
    const { email, password, name, storeName } = parsed.data

    const exists = await prisma.user.findUnique({ where: { email } })
    if (exists) return reply.code(409).send({ message: 'Email already exists' })

    const passwordHash = await bcrypt.hash(password, 10)
    const user = await prisma.user.create({ data: { email, passwordHash, name } })

    const defaultStoreName = storeName || `${email.split('@')[0]} Store`
    const store = await prisma.store.create({ data: { name: defaultStoreName } })
    await prisma.storeMember.create({
      data: {
        storeId: store.id,
        userId: user.id,
        role: 'OWNER',
      },
    })

    const token = await reply.jwtSign({ sub: user.id, email: user.email })
    return {
      token,
      user: { id: user.id, email: user.email, name: user.name },
      store: store ? { id: store.id, name: store.name } : null,
    }
  })

  fastify.post('/auth/login', async (request, reply) => {
    const parsed = loginSchema.safeParse(request.body)
    if (!parsed.success) return reply.code(400).send({ message: 'Invalid payload', issues: parsed.error.issues })
    const { email, password } = parsed.data

    const user = await prisma.user.findUnique({ where: { email } })
    if (!user) return reply.code(401).send({ message: 'Invalid email or password' })

    const ok = await bcrypt.compare(password, user.passwordHash)
    if (!ok) return reply.code(401).send({ message: 'Invalid email or password' })

    const token = await reply.jwtSign({ sub: user.id, email: user.email })
    return { token, user: { id: user.id, email: user.email, name: user.name } }
  })

  fastify.post('/auth/forgot-password', async (_request, _reply) => {
    return { message: 'Password reset flow should be wired to email provider in production.' }
  })

  fastify.get('/auth/me', { preHandler: [fastify.requireAuth] }, async (request) => {
    const user = await prisma.user.findUnique({
      where: { id: request.user.sub },
      select: {
        id: true,
        email: true,
        name: true,
        memberships: {
          select: {
            role: true,
            store: { select: { id: true, name: true } },
          },
        },
      },
    })
    return user
  })
}
