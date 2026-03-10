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
    const { name, abbreviation, type } = req.body as any
    const uom = await db.unitOfMeasure.create({
      data: { name, abbreviation, type: type || 'OTHER' },
    })
    return reply.code(201).send(uom)
  })

  // PATCH /uom/:id — update
  fastify.patch('/:id', { preHandler: [authenticate, authorize('manage', 'product')] }, async (req) => {
    const { id } = req.params as { id: string }
    const { name, abbreviation, type, isActive } = req.body as any
    const data: any = {}
    if (name !== undefined) data.name = name
    if (abbreviation !== undefined) data.abbreviation = abbreviation
    if (type !== undefined) data.type = type
    if (isActive !== undefined) data.isActive = isActive
    return db.unitOfMeasure.update({ where: { id }, data })
  })

  // DELETE /uom/:id — deactivate (soft delete)
  fastify.delete('/:id', { preHandler: [authenticate, authorize('manage', 'product')] }, async (req) => {
    const { id } = req.params as { id: string }
    return db.unitOfMeasure.update({ where: { id }, data: { isActive: false } })
  })

  // POST /uom/seed — seed default UOMs
  fastify.post('/seed', { preHandler: [authenticate, authorize('manage', 'product')] }, async (req, reply) => {
    const defaults = [
      // Weight
      { name: 'Kilogram',   abbreviation: 'kg',    type: 'WEIGHT' },
      { name: 'Gram',       abbreviation: 'g',     type: 'WEIGHT' },
      { name: 'Milligram',  abbreviation: 'mg',    type: 'WEIGHT' },
      // Volume
      { name: 'Litre',      abbreviation: 'l',     type: 'VOLUME' },
      { name: 'Millilitre', abbreviation: 'ml',    type: 'VOLUME' },
      // Count
      { name: 'Unit',       abbreviation: 'unit',  type: 'COUNT' },
      { name: 'Piece',      abbreviation: 'pcs',   type: 'COUNT' },
      { name: 'Pack',       abbreviation: 'pack',  type: 'COUNT' },
      { name: 'Box',        abbreviation: 'box',   type: 'COUNT' },
      { name: 'Bag',        abbreviation: 'bag',   type: 'COUNT' },
      { name: 'Dozen',      abbreviation: 'doz',   type: 'COUNT' },
      { name: 'Tray',       abbreviation: 'tray',  type: 'COUNT' },
      // Other
      { name: 'Batch',      abbreviation: 'batch', type: 'OTHER' },
    ]
    const created = []
    for (const uom of defaults) {
      const existing = await db.unitOfMeasure.findUnique({ where: { abbreviation: uom.abbreviation } })
      if (!existing) {
        created.push(await db.unitOfMeasure.create({ data: uom }))
      }
    }
    return reply.code(201).send({ seeded: created.length, total: defaults.length })
  })
}

export default uomRoutes
