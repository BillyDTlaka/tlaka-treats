import { FastifyPluginAsync } from 'fastify'
import { authenticate, authorize } from '../../shared/middleware/auth'
import { buildSnapshot } from './board.context'
import { runBoardMeeting } from './board.service'

const boardRoutes: FastifyPluginAsync = async (fastify) => {
  const db = fastify.prisma as any

  // ── POST /board/meeting ─── Run a new board meeting
  fastify.post('/meeting', { preHandler: [authenticate, authorize('manage', 'product')] }, async (req, reply) => {
    const { periodDays = 30, includeDebate = false } = req.body as any

    const snapshot = await buildSnapshot(db, Number(periodDays))
    const report   = await runBoardMeeting(snapshot, { includeDebate: Boolean(includeDebate) })

    const saved = await db.boardMeeting.create({
      data: {
        periodDays:    Number(periodDays),
        debateEnabled: Boolean(includeDebate),
        snapshotJson:  snapshot as any,
        reportJson:    report as any,
      },
    })

    return reply.code(201).send({ id: saved.id, ...report })
  })

  // ── GET /board/meetings ─── History (last 20)
  fastify.get('/meetings', { preHandler: [authenticate, authorize('manage', 'product')] }, async () => {
    return db.boardMeeting.findMany({
      select: {
        id:           true,
        periodDays:   true,
        debateEnabled: true,
        createdAt:    true,
        reportJson:   true,
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
    })
  })

  // ── GET /board/meetings/:id ─── Single meeting
  fastify.get('/meetings/:id', { preHandler: [authenticate, authorize('manage', 'product')] }, async (req) => {
    const { id } = req.params as { id: string }
    const meeting = await db.boardMeeting.findUnique({ where: { id } })
    if (!meeting) throw { statusCode: 404, message: 'Board meeting not found' }
    return meeting
  })
}

export default boardRoutes
