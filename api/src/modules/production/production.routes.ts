import { FastifyPluginAsync } from 'fastify'
import { authenticate, authorize } from '../../shared/middleware/auth'

const productionRoutes: FastifyPluginAsync = async (fastify) => {
  const db = fastify.prisma as any

  // ── GET /production ─── All production runs
  fastify.get('/', { preHandler: [authenticate, authorize('manage', 'product')] }, async () => {
    return db.productionRun.findMany({
      include: {
        recipe: { select: { id: true, name: true, yieldQty: true, yieldUnit: true, outputProductId: true, yieldPerBatch: true } },
        packagingRun: true,
        _count: { select: { stockMovements: true } },
      },
      orderBy: { createdAt: 'desc' },
    })
  })

  // ── GET /production/:id ─── Single run detail
  fastify.get('/:id', { preHandler: [authenticate, authorize('manage', 'product')] }, async (req) => {
    const { id } = req.params as { id: string }
    const run = await db.productionRun.findUnique({
      where: { id },
      include: {
        recipe: {
          include: { ingredients: { include: { stockItem: true } } },
        },
        stockMovements: { include: { stockItem: { select: { id: true, name: true, unit: true } } } },
      },
    })
    if (!run) throw { statusCode: 404, message: 'Production run not found' }
    return run
  })

  // ── POST /production ─── Create a new production run
  fastify.post('/', { preHandler: [authenticate, authorize('manage', 'product')] }, async (req, reply) => {
    const { recipeId, batches, plannedDate, notes } = req.body as any
    const run = await db.productionRun.create({
      data: {
        recipeId,
        batches: batches || 1,
        plannedDate: plannedDate ? new Date(plannedDate) : undefined,
        notes,
        status: 'PLANNED',
      },
      include: { recipe: { select: { id: true, name: true } } },
    })
    return reply.code(201).send(run)
  })

  // ── PATCH /production/:id ─── Update status or notes
  fastify.patch('/:id', { preHandler: [authenticate, authorize('manage', 'product')] }, async (req) => {
    const { id } = req.params as { id: string }
    const { status, notes, batches, plannedDate } = req.body as any
    const data: any = {}
    if (status)      data.status      = status
    if (notes)       data.notes       = notes
    if (batches)     data.batches     = batches
    if (plannedDate) data.plannedDate = new Date(plannedDate)
    if (status === 'IN_PROGRESS') data.startedAt  = new Date()
    if (status === 'CANCELLED')   data.completedAt = new Date()
    return db.productionRun.update({ where: { id }, data })
  })

  // ── POST /production/:id/complete ─── Mark complete + consume stock
  fastify.post('/:id/complete', { preHandler: [authenticate, authorize('manage', 'product')] }, async (req, reply) => {
    const { id } = req.params as { id: string }
    const run = await db.productionRun.findUnique({
      where: { id },
      include: {
        recipe: { include: { ingredients: true } },
      },
    })
    if (!run) throw { statusCode: 404, message: 'Production run not found' }
    if (run.status === 'COMPLETED') throw { statusCode: 400, message: 'Run already completed' }
    if (run.status === 'CANCELLED') throw { statusCode: 400, message: 'Run is cancelled' }

    const batches = Number(run.batches)

    // Deduct each ingredient × batches from stock
    for (const ingredient of run.recipe.ingredients) {
      const consume = Number(ingredient.quantity) * batches
      await db.stockMovement.create({
        data: {
          stockItemId:    ingredient.stockItemId,
          type:           'PRODUCTION_USE',
          quantity:       -consume,
          reference:      id,
          productionRunId: id,
          note:           `Used in production: ${run.recipe.name} × ${batches} batch(es)`,
        },
      })
      await db.stockItem.update({
        where: { id: ingredient.stockItemId },
        data:  { currentStock: { decrement: consume } },
      })
    }

    const updated = await db.productionRun.update({
      where: { id },
      data:  { status: 'COMPLETED', completedAt: new Date() },
      include: { recipe: true, packagingRun: true },
    })

    // Auto-create a PackagingRun for this completed production run
    await db.packagingRun.create({
      data: {
        productionRunId: run.id,
        batchCount: Math.round(batches),
        status: 'PENDING',
      },
    })

    return reply.code(200).send(updated)
  })
}

export default productionRoutes
