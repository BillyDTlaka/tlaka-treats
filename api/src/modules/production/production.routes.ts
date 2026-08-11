import { FastifyPluginAsync } from 'fastify'
import { authenticate, authorize } from '../../shared/middleware/auth'
import { AppError, NotFoundError } from '../../shared/errors'

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
    if (!run) throw new NotFoundError('Production run')
    return run
  })

  // ── POST /production ─── Create a new production run
  fastify.post('/', { preHandler: [authenticate, authorize('manage', 'product')] }, async (req, reply) => {
    const { recipeId, batches, plannedDate, notes } = req.body as any
    if (!recipeId) throw new AppError('recipeId is required', 400)
    if (batches != null && Number(batches) <= 0) throw new AppError('batches must be greater than 0', 400)
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
        recipe: { include: { ingredients: { include: { stockItem: true } } } },
      },
    })
    if (!run) throw new NotFoundError('Production run')
    if (run.status === 'COMPLETED') throw new AppError('Run already completed', 400)
    if (run.status === 'CANCELLED') throw new AppError('Run is cancelled', 400)

    const batches = Number(run.batches)

    // Refuse to push stock negative — the ingredient panel already shows a "✗ Short"
    // warning per item before this point, so this is the backend actually enforcing it
    // rather than only decorating it.
    const shortages = run.recipe.ingredients
      .map((ing: any) => ({
        name: ing.stockItem.name,
        need: Number(ing.quantity) * batches,
        have: Number(ing.stockItem.currentStock),
      }))
      .filter((s: any) => s.have < s.need)
    if (shortages.length) {
      const detail = shortages.map((s: any) => `${s.name} (need ${s.need}, have ${s.have})`).join(', ')
      throw new AppError(`Not enough stock to complete this run: ${detail}`, 400)
    }

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
