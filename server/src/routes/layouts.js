import { z } from 'zod'
import { prisma } from '../db.js'
import { APP_RULE_VERSION, DEFAULT_RULE_SET_PAYLOAD } from '../constants.js'
import { recomputeLayoutFromInput } from '../engine.js'

const layoutCreateSchema = z.object({
  storeId: z.string().min(1).optional(),
  name: z.string().min(1).optional(),
  scene: z.string().optional(),
  ruleVersion: z.string().min(1).default(APP_RULE_VERSION),
  payload: z.any(),
})

const versionCreateSchema = z.object({
  ruleVersion: z.string().min(1).default(APP_RULE_VERSION),
  payload: z.any(),
  note: z.string().optional(),
})

const replaySchema = z.object({
  versionId: z.string().min(1).optional(),
  targetRuleVersion: z.string().min(1).default(APP_RULE_VERSION),
  saveAsNewVersion: z.boolean().default(true),
  note: z.string().optional(),
})

async function ensureLayoutAccess(fastify, request, reply, layoutId, roles = ['OWNER', 'EDITOR', 'VIEWER']) {
  const layout = await prisma.layout.findUnique({ where: { id: layoutId } })
  if (!layout) {
    reply.code(404).send({ message: 'Layout not found' })
    return null
  }
  request.params.storeId = layout.storeId
  const ok = await fastify.requireStoreRole(request, reply, roles)
  if (!ok) return null
  return layout
}

export default async function layoutRoutes(fastify) {
  fastify.get('/layouts', { preHandler: [fastify.requireAuth] }, async (request, reply) => {
    let storeId = request.query?.storeId
    if (!storeId) {
      const firstMembership = await prisma.storeMember.findFirst({
        where: { userId: request.user.sub },
        select: { storeId: true },
      })
      storeId = firstMembership?.storeId
    }
    if (!storeId) return reply.code(400).send({ message: 'storeId is required or user must belong to a store' })
    request.query = { ...(request.query || {}), storeId }
    const ok = await fastify.requireStoreRole(request, reply)
    if (!ok) return

    const layouts = await prisma.layout.findMany({
      where: { storeId, archived: false },
      orderBy: { updatedAt: 'desc' },
      include: {
        versions: {
          take: 1,
          orderBy: { versionNo: 'desc' },
          select: { id: true, versionNo: true, ruleVersion: true, createdAt: true },
        },
      },
    })
    return layouts
  })

  fastify.post('/layouts', { preHandler: [fastify.requireAuth] }, async (request, reply) => {
    const parsed = layoutCreateSchema.safeParse(request.body)
    if (!parsed.success) return reply.code(400).send({ message: 'Invalid payload', issues: parsed.error.issues })

    let { storeId, name, scene, payload, ruleVersion } = parsed.data
    if (!storeId) {
      const firstMembership = await prisma.storeMember.findFirst({
        where: { userId: request.user.sub },
        select: { storeId: true },
      })
      storeId = firstMembership?.storeId
    }
    if (!storeId) return reply.code(400).send({ message: 'storeId is required or user must belong to a store' })
    request.body = { ...(request.body || {}), storeId }
    const ok = await fastify.requireStoreRole(request, reply, ['OWNER', 'EDITOR'])
    if (!ok) return

    const created = await prisma.$transaction(async (tx) => {
      const layout = await tx.layout.create({
        data: {
          storeId,
          scene,
          name: name || `Layout ${new Date().toISOString().slice(0, 10)}`,
          createdById: request.user.sub,
        },
      })
      const version = await tx.layoutVersion.create({
        data: {
          layoutId: layout.id,
          versionNo: 1,
          ruleVersion,
          inputPayload: payload,
          computedResult: payload.computedResult ?? payload,
          createdById: request.user.sub,
        },
      })
      return { layout, version }
    })

    await fastify.writeAudit({
      actorId: request.user.sub,
      storeId,
      layoutId: created.layout.id,
      action: 'layout.create',
      targetType: 'layout',
      targetId: created.layout.id,
      afterData: { version: created.version.versionNo },
    })

    return {
      id: created.layout.id,
      storeId,
      name: created.layout.name,
      scene: created.layout.scene,
      versionId: created.version.id,
      versionNo: created.version.versionNo,
      ruleVersion,
    }
  })

  fastify.get('/layouts/:id/versions', { preHandler: [fastify.requireAuth] }, async (request, reply) => {
    const layout = await ensureLayoutAccess(fastify, request, reply, request.params.id)
    if (!layout) return

    const versions = await prisma.layoutVersion.findMany({
      where: { layoutId: layout.id },
      orderBy: { versionNo: 'desc' },
    })
    return versions
  })

  fastify.get('/layouts/:id/versions/:versionId', { preHandler: [fastify.requireAuth] }, async (request, reply) => {
    const layout = await ensureLayoutAccess(fastify, request, reply, request.params.id)
    if (!layout) return
    const version = await prisma.layoutVersion.findFirst({
      where: { id: request.params.versionId, layoutId: layout.id },
    })
    if (!version) return reply.code(404).send({ message: 'Version not found' })
    return version
  })

  fastify.post('/layouts/:id/versions', { preHandler: [fastify.requireAuth] }, async (request, reply) => {
    const layout = await ensureLayoutAccess(fastify, request, reply, request.params.id, ['OWNER', 'EDITOR'])
    if (!layout) return

    const parsed = versionCreateSchema.safeParse(request.body)
    if (!parsed.success) return reply.code(400).send({ message: 'Invalid payload', issues: parsed.error.issues })

    const { payload, note, ruleVersion } = parsed.data

    const latest = await prisma.layoutVersion.findFirst({
      where: { layoutId: layout.id },
      orderBy: { versionNo: 'desc' },
      select: { versionNo: true },
    })

    const versionNo = (latest?.versionNo || 0) + 1
    const version = await prisma.layoutVersion.create({
      data: {
        layoutId: layout.id,
        versionNo,
        note,
        ruleVersion,
        inputPayload: payload,
        computedResult: payload.computedResult ?? payload,
        createdById: request.user.sub,
      },
    })

    await fastify.writeAudit({
      actorId: request.user.sub,
      storeId: layout.storeId,
      layoutId: layout.id,
      action: 'layout.version.create',
      targetType: 'layout_version',
      targetId: version.id,
      afterData: { versionNo, ruleVersion },
    })

    return version
  })

  fastify.post('/layouts/:id/replay', { preHandler: [fastify.requireAuth] }, async (request, reply) => {
    const layout = await ensureLayoutAccess(fastify, request, reply, request.params.id, ['OWNER', 'EDITOR'])
    if (!layout) return
    const parsed = replaySchema.safeParse(request.body)
    if (!parsed.success) return reply.code(400).send({ message: 'Invalid payload', issues: parsed.error.issues })
    const { versionId, targetRuleVersion, saveAsNewVersion, note } = parsed.data

    const sourceVersion = versionId
      ? await prisma.layoutVersion.findFirst({ where: { id: versionId, layoutId: layout.id } })
      : await prisma.layoutVersion.findFirst({ where: { layoutId: layout.id }, orderBy: { versionNo: 'desc' } })
    if (!sourceVersion) return reply.code(404).send({ message: 'Source version not found' })

    const targetRule = await prisma.ruleSet.findUnique({ where: { version: targetRuleVersion } })
    const rulePayload = targetRule?.payload || DEFAULT_RULE_SET_PAYLOAD
    const inputPayload = { ...(sourceVersion.inputPayload || {}), ruleVersion: targetRuleVersion }
    const computedResult = recomputeLayoutFromInput(inputPayload, rulePayload)
    if (!computedResult) {
      return reply.code(422).send({ message: 'Replay failed: payload is invalid for selected rule version' })
    }

    let newVersion = null
    if (saveAsNewVersion) {
      const latest = await prisma.layoutVersion.findFirst({
        where: { layoutId: layout.id },
        orderBy: { versionNo: 'desc' },
        select: { versionNo: true },
      })
      const versionNo = (latest?.versionNo || 0) + 1
      newVersion = await prisma.layoutVersion.create({
        data: {
          layoutId: layout.id,
          versionNo,
          ruleVersion: targetRuleVersion,
          note: note || `Replay from v${sourceVersion.versionNo}`,
          inputPayload,
          computedResult,
          createdById: request.user.sub,
        },
      })
    }

    await fastify.writeAudit({
      actorId: request.user.sub,
      storeId: layout.storeId,
      layoutId: layout.id,
      action: 'layout.replay',
      targetType: 'layout_version',
      targetId: sourceVersion.id,
      afterData: { sourceVersionNo: sourceVersion.versionNo, targetRuleVersion, createdVersionNo: newVersion?.versionNo || null },
    })

    return {
      sourceVersion,
      targetRuleVersion,
      computedResult,
      newVersion,
    }
  })

  fastify.post('/layouts/:id/archive', { preHandler: [fastify.requireAuth] }, async (request, reply) => {
    const layout = await ensureLayoutAccess(fastify, request, reply, request.params.id, ['OWNER', 'EDITOR'])
    if (!layout) return

    const updated = await prisma.layout.update({
      where: { id: layout.id },
      data: { archived: true },
    })

    await fastify.writeAudit({
      actorId: request.user.sub,
      storeId: layout.storeId,
      layoutId: layout.id,
      action: 'layout.archive',
      targetType: 'layout',
      targetId: layout.id,
      beforeData: { archived: layout.archived },
      afterData: { archived: updated.archived },
    })

    return { id: layout.id, archived: true }
  })
}
