import { FastifyPluginAsync } from 'fastify'
import { authenticate } from '../../shared/middleware/auth'
import { AppError } from '../../shared/errors'
import {
  seedDefaultStores,
  runPriceCheck,
  generateShoppingList,
  sendQuoteRequestEmail,
} from './pricing.service'

const pricingRoutes: FastifyPluginAsync = async (fastify) => {
  const db = fastify.prisma as any

  // ── Stores ───────────────────────────────────────────────────────────────────

  // GET /pricing/stores
  fastify.get('/stores', { preHandler: [authenticate] }, async () => {
    await seedDefaultStores(db)
    return db.pricingStore.findMany({ orderBy: { sortOrder: 'asc' } })
  })

  // POST /pricing/stores
  fastify.post('/stores', { preHandler: [authenticate] }, async (req, reply) => {
    const { name, domain } = req.body as { name: string; domain: string }
    if (!name?.trim())   throw new AppError('name is required',   400, 'INVALID_BODY')
    if (!domain?.trim()) throw new AppError('domain is required', 400, 'INVALID_BODY')
    const count = await db.pricingStore.count()
    const store = await db.pricingStore.create({
      data: { name: name.trim(), domain: domain.trim().replace(/^https?:\/\//, ''), sortOrder: count },
    })
    return reply.code(201).send(store)
  })

  // PATCH /pricing/stores/:id
  fastify.patch('/stores/:id', { preHandler: [authenticate] }, async (req) => {
    const { id } = req.params as { id: string }
    const body = req.body as any
    return db.pricingStore.update({
      where: { id },
      data: {
        ...(body.name     !== undefined ? { name:     body.name }     : {}),
        ...(body.domain   !== undefined ? { domain:   body.domain }   : {}),
        ...(body.isActive !== undefined ? { isActive: body.isActive } : {}),
      },
    })
  })

  // DELETE /pricing/stores/:id
  fastify.delete('/stores/:id', { preHandler: [authenticate] }, async (req, reply) => {
    const { id } = req.params as { id: string }
    await db.pricingStore.delete({ where: { id } })
    return reply.code(204).send()
  })

  // ── Price Check ──────────────────────────────────────────────────────────────

  // POST /pricing/check — run price check for selected items
  fastify.post('/check', { preHandler: [authenticate] }, async (req, reply) => {
    const { items } = req.body as {
      items: { stockItemId?: string; searchTerm: string }[]
    }
    if (!items?.length) throw new AppError('items array is required', 400, 'INVALID_BODY')
    const results = await runPriceCheck(db, items)
    return reply.send(results)
  })

  // ── Market Prices ────────────────────────────────────────────────────────────

  // GET /pricing/market-prices
  fastify.get('/market-prices', { preHandler: [authenticate] }, async () => {
    return db.marketPrice.findMany({
      orderBy: [{ searchTerm: 'asc' }, { source: 'asc' }],
      include: {
        stockItem: {
          select: { id: true, name: true, costPerUnit: true, uom: { select: { abbreviation: true } } },
        },
      },
    })
  })

  // DELETE /pricing/market-prices — clear all
  fastify.delete('/market-prices', { preHandler: [authenticate] }, async (_req, reply) => {
    await db.marketPrice.deleteMany({})
    return reply.code(204).send()
  })

  // DELETE /pricing/market-prices/:id
  fastify.delete('/market-prices/:id', { preHandler: [authenticate] }, async (req, reply) => {
    const { id } = req.params as { id: string }
    await db.marketPrice.delete({ where: { id } })
    return reply.code(204).send()
  })

  // ── Shopping List ────────────────────────────────────────────────────────────

  // POST /pricing/shopping-list
  fastify.post('/shopping-list', { preHandler: [authenticate] }, async (req) => {
    const { stockItemIds = [], customTerms = [] } = req.body as {
      stockItemIds?: string[]
      customTerms?: string[]
    }
    const list = await generateShoppingList(db, stockItemIds, customTerms)
    return { list, generatedAt: new Date().toISOString() }
  })

  // ── Supplier Quote Requests ──────────────────────────────────────────────────

  fastify.get('/quote-requests', { preHandler: [authenticate] }, async () => {
    return db.supplierQuoteRequest.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        supplier: { select: { id: true, name: true, email: true } },
        items: { include: { stockItem: { select: { id: true, name: true } } } },
        quotes: true,
      },
    })
  })

  fastify.post('/quote-requests', { preHandler: [authenticate] }, async (req, reply) => {
    const { supplierId, stockItemIds, notes } = req.body as {
      supplierId: string; stockItemIds: string[]; notes?: string
    }
    if (!supplierId)        throw new AppError('supplierId is required', 400, 'INVALID_BODY')
    if (!stockItemIds?.length) throw new AppError('stockItemIds must be a non-empty array', 400, 'INVALID_BODY')
    const result = await sendQuoteRequestEmail(db, supplierId, stockItemIds, notes)
    return reply.code(201).send(result)
  })

  fastify.patch('/quote-requests/:id', { preHandler: [authenticate] }, async (req) => {
    const { id } = req.params as { id: string }
    const { status } = req.body as { status: string }
    return db.supplierQuoteRequest.update({ where: { id }, data: { status } })
  })

  // ── Supplier Quotes ──────────────────────────────────────────────────────────

  fastify.get('/quotes', { preHandler: [authenticate] }, async () => {
    return db.supplierQuote.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        supplier:  { select: { id: true, name: true } },
        stockItem: { select: { id: true, name: true, costPerUnit: true, uom: { select: { abbreviation: true } } } },
      },
    })
  })

  fastify.post('/quotes', { preHandler: [authenticate] }, async (req, reply) => {
    const body = req.body as any
    if (!body.supplierId)   throw new AppError('supplierId is required',   400, 'INVALID_BODY')
    if (!body.stockItemId)  throw new AppError('stockItemId is required',  400, 'INVALID_BODY')
    if (!body.pricePerUnit) throw new AppError('pricePerUnit is required', 400, 'INVALID_BODY')
    const quote = await db.supplierQuote.create({
      data: {
        supplierId:   body.supplierId,
        stockItemId:  body.stockItemId,
        requestId:    body.requestId  || null,
        pricePerUnit: body.pricePerUnit,
        packSize:     body.packSize   || null,
        packPrice:    body.packPrice  || null,
        unitLabel:    body.unitLabel  || null,
        validUntil:   body.validUntil ? new Date(body.validUntil) : null,
        source:       body.source     || 'manual',
        notes:        body.notes      || null,
      },
      include: {
        supplier:  { select: { id: true, name: true } },
        stockItem: { select: { id: true, name: true, costPerUnit: true } },
      },
    })
    return reply.code(201).send(quote)
  })

  fastify.delete('/quotes/:id', { preHandler: [authenticate] }, async (req, reply) => {
    const { id } = req.params as { id: string }
    await db.supplierQuote.delete({ where: { id } })
    return reply.code(204).send()
  })
}

export default pricingRoutes
