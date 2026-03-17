import { FastifyPluginAsync } from 'fastify'
import { authenticate, authorize } from '../../shared/middleware/auth'
import { AppError } from '../../shared/errors'
import {
  generateStrategy,
  refineStrategy,
  saveStrategyContent,
  validateTransition,
} from './strategy.service'
import { generateStrategyPdf } from '../../shared/services/pdf.service'

const strategyRoutes: FastifyPluginAsync = async (fastify) => {
  const db = fastify.prisma as any
  const auth = [authenticate, authorize('manage', 'product')]

  // ── POST /strategy ─── Create + trigger async generation
  fastify.post('/', { preHandler: auth }, async (req, reply) => {
    const { title, context } = req.body as { title?: string; context?: any }

    const strategy = await db.strategy.create({
      data: {
        title:       title || `Tlaka Treats ${new Date().getFullYear()} Business Strategy`,
        status:      'GENERATING',
        contextJson: context || {},
      },
    })

    setImmediate(async () => {
      await generateStrategy(db, strategy.id)
    })

    return reply.code(202).send({ id: strategy.id, status: 'GENERATING' })
  })

  // ── GET /strategy ─── List
  fastify.get('/', { preHandler: auth }, async () => {
    return db.strategy.findMany({
      select: {
        id:             true,
        title:          true,
        status:         true,
        currentVersion: true,
        errorMessage:   true,
        createdAt:      true,
        updatedAt:      true,
      },
      orderBy: { createdAt: 'desc' },
      take: 30,
    })
  })

  // ── GET /strategy/:id ─── Single
  fastify.get('/:id', { preHandler: auth }, async (req) => {
    const { id } = req.params as { id: string }
    const s = await db.strategy.findUnique({ where: { id } })
    if (!s) throw new AppError('Strategy not found', 404, 'NOT_FOUND')
    return s
  })

  // ── PATCH /strategy/:id/content ─── Manual edit
  fastify.patch('/:id/content', { preHandler: auth }, async (req) => {
    const { id } = req.params as { id: string }
    const body = req.body as any
    return saveStrategyContent(db, id, body, body.changeNote)
  })

  // ── PATCH /strategy/:id/title ─── Rename
  fastify.patch('/:id/title', { preHandler: auth }, async (req) => {
    const { id } = req.params as { id: string }
    const { title } = req.body as { title: string }
    if (!title?.trim()) throw new AppError('Title is required', 400, 'INVALID_BODY')
    return db.strategy.update({ where: { id }, data: { title: title.trim() } })
  })

  // ── PATCH /strategy/:id/status ─── Workflow transition
  fastify.patch('/:id/status', { preHandler: auth }, async (req) => {
    const { id } = req.params as { id: string }
    const { status, notes } = req.body as { status: string; notes?: string }

    const s = await db.strategy.findUnique({ where: { id } })
    if (!s) throw new AppError('Strategy not found', 404, 'NOT_FOUND')

    validateTransition(s.status, status)

    return db.strategy.update({
      where: { id },
      data:  { status, ...(notes ? { errorMessage: notes } : {}) },
    })
  })

  // ── POST /strategy/:id/refine ─── AI refinement (fire-and-forget)
  fastify.post('/:id/refine', { preHandler: auth }, async (req, reply) => {
    const { id } = req.params as { id: string }
    const { prompt } = req.body as { prompt: string }

    if (!prompt?.trim()) throw new AppError('Refinement prompt is required', 400, 'INVALID_BODY')

    const s = await db.strategy.findUnique({ where: { id } })
    if (!s) throw new AppError('Strategy not found', 404, 'NOT_FOUND')
    if (!['DRAFT', 'CHANGES_REQUESTED'].includes(s.status)) {
      throw new AppError('Can only refine a DRAFT or CHANGES_REQUESTED strategy', 400, 'INVALID_STATUS')
    }

    // Mark as GENERATING while refining so the client can poll
    await db.strategy.update({ where: { id }, data: { status: 'GENERATING' } })

    setImmediate(async () => {
      await refineStrategy(db, id, prompt.trim())
      // Return to DRAFT after refinement
      await db.strategy.update({ where: { id }, data: { status: 'DRAFT' } }).catch(() => {})
    })

    return reply.code(202).send({ refining: true, status: 'GENERATING' })
  })

  // ── GET /strategy/:id/revisions ─── Version history
  fastify.get('/:id/revisions', { preHandler: auth }, async (req) => {
    const { id } = req.params as { id: string }
    return db.strategyRevision.findMany({
      where:   { strategyId: id },
      select:  { id: true, version: true, changeType: true, changeNote: true, createdAt: true },
      orderBy: { version: 'desc' },
    })
  })

  // ── GET /strategy/:id/revisions/:version ─── Single revision content
  fastify.get('/:id/revisions/:version', { preHandler: auth }, async (req) => {
    const { id, version } = req.params as { id: string; version: string }
    const rev = await db.strategyRevision.findFirst({
      where: { strategyId: id, version: Number(version) },
    })
    if (!rev) throw new AppError('Revision not found', 404, 'NOT_FOUND')
    return rev
  })

  // ── POST /strategy/:id/comments ─── Add comment
  fastify.post('/:id/comments', { preHandler: [authenticate] }, async (req, reply) => {
    const { id } = req.params as { id: string }
    const { body, section, author } = req.body as { body: string; section?: string; author?: string }
    if (!body?.trim()) throw new AppError('Comment body is required', 400, 'INVALID_BODY')

    const user = req.user as { id: string; firstName?: string; lastName?: string }
    const comment = await db.strategyComment.create({
      data: {
        strategyId: id,
        body:       body.trim(),
        section:    section || null,
        author:     author || null,
      },
    })
    return reply.code(201).send(comment)
  })

  // ── GET /strategy/:id/comments ─── List comments
  fastify.get('/:id/comments', { preHandler: [authenticate] }, async (req) => {
    const { id } = req.params as { id: string }
    const { section } = req.query as { section?: string }
    return db.strategyComment.findMany({
      where:   { strategyId: id, ...(section ? { section } : {}) },
      orderBy: { createdAt: 'asc' },
    })
  })

  // ── PATCH /strategy/:id/comments/:cid ─── Resolve comment
  fastify.patch('/:id/comments/:cid', { preHandler: [authenticate] }, async (req) => {
    const { cid } = req.params as { id: string; cid: string }
    const { resolved } = req.body as { resolved: boolean }
    return db.strategyComment.update({ where: { id: cid }, data: { resolved } })
  })

  // ── GET /strategy/:id/pdf ─── Download as PDF
  fastify.get('/:id/pdf', { preHandler: auth }, async (req, reply) => {
    const { id } = req.params as { id: string }
    const s = await db.strategy.findUnique({ where: { id } })
    if (!s) throw new AppError('Strategy not found', 404, 'NOT_FOUND')
    if (s.status === 'GENERATING') throw new AppError('Strategy is still generating', 400, 'NOT_READY')

    const buf = await generateStrategyPdf(s)
    const date = new Date(s.createdAt).toISOString().slice(0, 10)
    reply.header('Content-Type', 'application/pdf')
    reply.header('Content-Disposition', `attachment; filename="strategy-${date}.pdf"`)
    return reply.send(buf)
  })

  // ── DELETE /strategy/:id ─── Archive / hard delete
  fastify.delete('/:id', { preHandler: auth }, async (req, reply) => {
    const { id } = req.params as { id: string }
    await db.strategy.delete({ where: { id } })
    return reply.code(204).send()
  })
}

export default strategyRoutes
