import { FastifyPluginAsync } from 'fastify'
import { authenticate, authorize } from '../../shared/middleware/auth'

const uomRoutes: FastifyPluginAsync = async (fastify) => {
  const db = fastify.prisma as any

  // GET /uom — all active UOMs (public, needed for dropdowns)
  fastify.get('/', async () => {
    return db.unitOfMeasure.findMany({
      where: { isActive: true },
      orderBy: [{ type: 'asc' }, { name: 'asc' }],
    })
  })

  // GET /uom/all — all including inactive (admin)
  fastify.get('/all', { preHandler: [authenticate, authorize('manage', 'product')] }, async () => {
    return db.unitOfMeasure.findMany({
      orderBy: [{ type: 'asc' }, { name: 'asc' }],
      include: {
        _count: { select: { products: true, stockItems: true, recipeIngredients: true } },
      },
    })
  })

  // POST /uom — create
  fastify.post('/', { preHandler: [authenticate, authorize('manage', 'product')] }, async (req, reply) => {
    const { name, abbreviation, type, toBaseFactor } = req.body as any
    const uom = await db.unitOfMeasure.create({
      data: { name, abbreviation, type: type || 'OTHER', toBaseFactor: toBaseFactor ?? 1 },
    })
    return reply.code(201).send(uom)
  })

  // PATCH /uom/:id — update
  fastify.patch('/:id', { preHandler: [authenticate, authorize('manage', 'product')] }, async (req) => {
    const { id } = req.params as { id: string }
    const { name, abbreviation, type, isActive, toBaseFactor } = req.body as any
    const data: any = {}
    if (name !== undefined) data.name = name
    if (abbreviation !== undefined) data.abbreviation = abbreviation
    if (type !== undefined) data.type = type
    if (isActive !== undefined) data.isActive = isActive
    if (toBaseFactor !== undefined) data.toBaseFactor = toBaseFactor
    return db.unitOfMeasure.update({ where: { id }, data })
  })

  // DELETE /uom/:id — deactivate (soft delete)
  fastify.delete('/:id', { preHandler: [authenticate, authorize('manage', 'product')] }, async (req) => {
    const { id } = req.params as { id: string }
    return db.unitOfMeasure.update({ where: { id }, data: { isActive: false } })
  })

  // POST /uom/seed — seed default UOMs
  fastify.post('/seed', { preHandler: [authenticate, authorize('manage', 'product')] }, async (req, reply) => {
    // toBaseFactor: how many of this unit equal 1 base unit of its type (kg for
    // WEIGHT, l for VOLUME) — drives automatic conversion, e.g. between a recipe
    // written in grams and a stock item costed per kilogram. COUNT/OTHER units
    // stay at 1 (no fixed universal size, so no auto-conversion between them).
    const defaults = [
      // Weight (base: kg)
      { name: 'Kilogram',   abbreviation: 'kg',    type: 'WEIGHT', toBaseFactor: 1 },
      { name: 'Gram',       abbreviation: 'g',     type: 'WEIGHT', toBaseFactor: 0.001 },
      { name: 'Milligram',  abbreviation: 'mg',    type: 'WEIGHT', toBaseFactor: 0.000001 },
      // Volume (base: l)
      { name: 'Litre',      abbreviation: 'l',     type: 'VOLUME', toBaseFactor: 1 },
      { name: 'Millilitre', abbreviation: 'ml',    type: 'VOLUME', toBaseFactor: 0.001 },
      // Count
      { name: 'Unit',       abbreviation: 'unit',  type: 'COUNT', toBaseFactor: 1 },
      { name: 'Piece',      abbreviation: 'pcs',   type: 'COUNT', toBaseFactor: 1 },
      { name: 'Pack',       abbreviation: 'pack',  type: 'COUNT', toBaseFactor: 1 },
      { name: 'Box',        abbreviation: 'box',   type: 'COUNT', toBaseFactor: 1 },
      { name: 'Bag',        abbreviation: 'bag',   type: 'COUNT', toBaseFactor: 1 },
      { name: 'Dozen',      abbreviation: 'doz',   type: 'COUNT', toBaseFactor: 1 },
      { name: 'Tray',       abbreviation: 'tray',  type: 'COUNT', toBaseFactor: 1 },
      // Other
      { name: 'Batch',      abbreviation: 'batch', type: 'OTHER', toBaseFactor: 1 },
    ]
    let created = 0, updated = 0
    for (const uom of defaults) {
      const existing = await db.unitOfMeasure.findUnique({ where: { abbreviation: uom.abbreviation } })
      if (!existing) {
        await db.unitOfMeasure.create({ data: uom })
        created++
      } else if (Number(existing.toBaseFactor) !== uom.toBaseFactor) {
        // Backfill the conversion factor on rows created before toBaseFactor existed —
        // these are fixed physical constants, safe to correct unconditionally.
        await db.unitOfMeasure.update({ where: { id: existing.id }, data: { toBaseFactor: uom.toBaseFactor } })
        updated++
      }
    }
    return reply.code(201).send({ seeded: created, backfilled: updated, total: defaults.length })
  })
}

export default uomRoutes
