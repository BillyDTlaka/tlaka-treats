import { FastifyPluginAsync } from 'fastify'
import { authenticate, authorize } from '../../shared/middleware/auth'

const recipeRoutes: FastifyPluginAsync = async (fastify) => {
  const db = fastify.prisma as any

  // ── GET /recipes ─── All recipes with ingredients
  fastify.get('/', { preHandler: [authenticate, authorize('manage', 'product')] }, async () => {
    return db.recipe.findMany({
      include: {
        ingredients: {
          include: { stockItem: { select: { id: true, name: true, unit: true, currentStock: true } } },
        },
        _count: { select: { productionRuns: true } },
      },
      orderBy: { name: 'asc' },
    })
  })

  // ── GET /recipes/:id ─── Single recipe detail
  fastify.get('/:id', { preHandler: [authenticate, authorize('manage', 'product')] }, async (req) => {
    const { id } = req.params as { id: string }
    const r = await db.recipe.findUnique({
      where: { id },
      include: {
        ingredients: {
          include: { stockItem: true },
        },
        productionRuns: { orderBy: { createdAt: 'desc' }, take: 10 },
      },
    })
    if (!r) throw { statusCode: 404, message: 'Recipe not found' }
    return r
  })

  // ── POST /recipes ─── Create recipe
  fastify.post('/', { preHandler: [authenticate, authorize('manage', 'product')] }, async (req, reply) => {
    const { name, productId, yieldQty, yieldUnit, notes, ingredients } = req.body as any
    const recipe = await db.recipe.create({
      data: {
        name,
        productId: productId || undefined,
        yieldQty: yieldQty || 1,
        yieldUnit: yieldUnit || 'batch',
        notes,
        ingredients: ingredients?.length
          ? { create: ingredients.map((i: any) => ({ stockItemId: i.stockItemId, quantity: i.quantity, unit: i.unit, notes: i.notes })) }
          : undefined,
      },
      include: { ingredients: { include: { stockItem: true } } },
    })
    return reply.code(201).send(recipe)
  })

  // ── PATCH /recipes/:id ─── Update recipe header
  fastify.patch('/:id', { preHandler: [authenticate, authorize('manage', 'product')] }, async (req) => {
    const { id } = req.params as { id: string }
    const { name, productId, yieldQty, yieldUnit, notes, isActive } = req.body as any
    return db.recipe.update({
      where: { id },
      data: { name, productId: productId || undefined, yieldQty, yieldUnit, notes, isActive },
    })
  })

  // ── POST /recipes/:id/ingredients ─── Add or replace all ingredients
  fastify.post('/:id/ingredients', { preHandler: [authenticate, authorize('manage', 'product')] }, async (req, reply) => {
    const { id } = req.params as { id: string }
    const { ingredients } = req.body as any
    // Delete existing and replace
    await db.recipeIngredient.deleteMany({ where: { recipeId: id } })
    const updated = await db.recipe.update({
      where: { id },
      data: {
        ingredients: {
          create: (ingredients as any[]).map(i => ({
            stockItemId: i.stockItemId,
            quantity: i.quantity,
            unit: i.unit,
            notes: i.notes || undefined,
          })),
        },
      },
      include: { ingredients: { include: { stockItem: true } } },
    })
    return reply.code(200).send(updated)
  })

  // ── DELETE /recipes/:id ─── Soft-delete recipe
  fastify.delete('/:id', { preHandler: [authenticate, authorize('manage', 'product')] }, async (req) => {
    const { id } = req.params as { id: string }
    return db.recipe.update({ where: { id }, data: { isActive: false } })
  })
}

export default recipeRoutes
