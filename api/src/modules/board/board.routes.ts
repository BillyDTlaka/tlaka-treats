import { FastifyPluginAsync } from 'fastify'
import { authenticate, authorize } from '../../shared/middleware/auth'
import { buildSnapshot } from './board.context'
import { runBoardMeeting } from './board.service'
import { generateBoardPdf } from '../../shared/services/pdf.service'

const boardRoutes: FastifyPluginAsync = async (fastify) => {
  const db = fastify.prisma as any

  // ── POST /board/meeting ─── Start a meeting (returns immediately, runs in background)
  fastify.post('/meeting', { preHandler: [authenticate, authorize('manage', 'product')] }, async (req, reply) => {
    const { periodDays = 30, includeDebate = false } = req.body as any

    // Create a RUNNING record immediately so the client has an ID to poll
    const meeting = await db.boardMeeting.create({
      data: {
        periodDays:    Number(periodDays),
        debateEnabled: Boolean(includeDebate),
        status:        'RUNNING',
      },
    })

    // Fire-and-forget — do NOT await, return the ID now
    setImmediate(async () => {
      try {
        const snapshot = await buildSnapshot(db, Number(periodDays))
        const report   = await runBoardMeeting(snapshot, { includeDebate: Boolean(includeDebate) })
        await db.boardMeeting.update({
          where: { id: meeting.id },
          data: { status: 'COMPLETED', snapshotJson: snapshot as any, reportJson: report as any },
        })
      } catch (err: any) {
        fastify.log.error({ err }, 'Board meeting failed')
        const message = err?.error?.message || err?.message || 'Unknown error'
        await db.boardMeeting.update({
          where: { id: meeting.id },
          data: { status: 'FAILED', errorMessage: message },
        }).catch(() => {})
      }
    })

    return reply.code(202).send({ id: meeting.id, status: 'RUNNING' })
  })

  // ── GET /board/meetings/:id ─── Poll for result
  fastify.get('/meetings/:id', { preHandler: [authenticate, authorize('manage', 'product')] }, async (req) => {
    const { id } = req.params as { id: string }
    const meeting = await db.boardMeeting.findUnique({ where: { id } })
    if (!meeting) throw { statusCode: 404, message: 'Board meeting not found' }
    return meeting
  })

  // ── GET /board/meetings/:id/pdf ─── Download report as PDF
  fastify.get('/meetings/:id/pdf', { preHandler: [authenticate, authorize('manage', 'product')] }, async (req, reply) => {
    const { id } = req.params as { id: string }
    const meeting = await db.boardMeeting.findUnique({ where: { id } })
    if (!meeting) throw { statusCode: 404, message: 'Board meeting not found' }
    if (meeting.status !== 'COMPLETED') throw { statusCode: 400, message: 'Meeting is not completed yet' }
    const buf = await generateBoardPdf(meeting)
    const date = new Date(meeting.createdAt).toISOString().slice(0, 10)
    reply.header('Content-Type', 'application/pdf')
    reply.header('Content-Disposition', `attachment; filename="board-report-${date}.pdf"`)
    return reply.send(buf)
  })

  // ── GET /board/snapshot ─── Debug: see raw snapshot without running AI
  fastify.get('/snapshot', { preHandler: [authenticate, authorize('manage', 'product')] }, async (req) => {
    const { periodDays = 60 } = req.query as { periodDays?: number }
    const snapshot = await buildSnapshot(db, Number(periodDays))
    // Also include raw counts so we can see if queries are hitting data
    const [orderCount, txnCount, stockCount, prodCount] = await Promise.all([
      db.order.count(),
      db.financeTransaction.count(),
      db.stockItem.count(),
      db.productionRun.count(),
    ])
    return { snapshot, debug: { totalOrdersInDb: orderCount, totalTransactionsInDb: txnCount, totalStockItemsInDb: stockCount, totalProductionRunsInDb: prodCount, periodDays: Number(periodDays) } }
  })

  // ── GET /board/meetings ─── History (last 20)
  fastify.get('/meetings', { preHandler: [authenticate, authorize('manage', 'product')] }, async () => {
    return db.boardMeeting.findMany({
      select: {
        id:            true,
        periodDays:    true,
        debateEnabled: true,
        status:        true,
        errorMessage:  true,
        createdAt:     true,
        reportJson:    true,
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
    })
  })
}

export default boardRoutes
