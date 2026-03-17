import { FastifyPluginAsync } from 'fastify'
import { authenticate } from '../../shared/middleware/auth'
import { AppError } from '../../shared/errors'
import {
  searchIngredientPrices,
  runPriceCheckAll,
  generatePricingInsights,
  sendQuoteRequestEmail,
} from './pricing.service'

const pricingRoutes: FastifyPluginAsync = async (fastify) => {
  const db = fastify.prisma as any

  // ── Market Prices ────────────────────────────────────────────────────────────

  // POST /pricing/check — run web price check for all ingredients
  fastify.post('/check', { preHandler: [authenticate] }, async (_req, reply) => {
    // Fire and forget
    runPriceCheckAll(db).catch(e => fastify.log.error({ err: e }, '[pricing] check error'))
    return reply.code(202).send({ message: 'Price check started' })
  })

  // POST /pricing/check/:stockItemId — check single ingredient
  fastify.post('/check/:stockItemId', { preHandler: [authenticate] }, async (req) => {
    const { stockItemId } = req.params as { stockItemId: string }
    return searchIngredientPrices(db, stockItemId)
  })

  // GET /pricing/market-prices — list all market prices
  fastify.get('/market-prices', { preHandler: [authenticate] }, async () => {
    return db.marketPrice.findMany({
      orderBy: { checkedAt: 'desc' },
      include: { stockItem: { select: { id: true, name: true, costPerUnit: true, uom: { select: { abbreviation: true } } } } },
    })
  })

  // DELETE /pricing/market-prices/:id
  fastify.delete('/market-prices/:id', { preHandler: [authenticate] }, async (req, reply) => {
    const { id } = req.params as { id: string }
    await db.marketPrice.delete({ where: { id } })
    return reply.code(204).send()
  })

  // GET /pricing/insights — AI analysis
  fastify.get('/insights', { preHandler: [authenticate] }, async () => {
    const text = await generatePricingInsights(db)
    return { insights: text, generatedAt: new Date().toISOString() }
  })

  // ── Supplier Quote Requests ──────────────────────────────────────────────────

  // GET /pricing/quote-requests
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

  // POST /pricing/quote-requests — send quote request email
  fastify.post('/quote-requests', { preHandler: [authenticate] }, async (req, reply) => {
    const { supplierId, stockItemIds, notes } = req.body as {
      supplierId: string
      stockItemIds: string[]
      notes?: string
    }
    if (!supplierId) throw new AppError('supplierId is required', 400, 'INVALID_BODY')
    if (!stockItemIds?.length) throw new AppError('stockItemIds must be a non-empty array', 400, 'INVALID_BODY')

    const result = await sendQuoteRequestEmail(db, supplierId, stockItemIds, notes)
    return reply.code(201).send(result)
  })

  // PATCH /pricing/quote-requests/:id — update status
  fastify.patch('/quote-requests/:id', { preHandler: [authenticate] }, async (req) => {
    const { id } = req.params as { id: string }
    const { status } = req.body as { status: string }
    return db.supplierQuoteRequest.update({ where: { id }, data: { status } })
  })

  // ── Supplier Quotes (received) ───────────────────────────────────────────────

  // GET /pricing/quotes
  fastify.get('/quotes', { preHandler: [authenticate] }, async () => {
    return db.supplierQuote.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        supplier: { select: { id: true, name: true } },
        stockItem: { select: { id: true, name: true, costPerUnit: true, uom: { select: { abbreviation: true } } } },
      },
    })
  })

  // POST /pricing/quotes — log a received quote manually
  fastify.post('/quotes', { preHandler: [authenticate] }, async (req, reply) => {
    const body = req.body as any
    if (!body.supplierId)   throw new AppError('supplierId is required',   400, 'INVALID_BODY')
    if (!body.stockItemId)  throw new AppError('stockItemId is required',  400, 'INVALID_BODY')
    if (!body.pricePerUnit) throw new AppError('pricePerUnit is required', 400, 'INVALID_BODY')

    const quote = await db.supplierQuote.create({
      data: {
        supplierId:   body.supplierId,
        stockItemId:  body.stockItemId,
        requestId:    body.requestId || null,
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

  // DELETE /pricing/quotes/:id
  fastify.delete('/quotes/:id', { preHandler: [authenticate] }, async (req, reply) => {
    const { id } = req.params as { id: string }
    await db.supplierQuote.delete({ where: { id } })
    return reply.code(204).send()
  })

  // GET /pricing/summary — aggregated comparison view per ingredient
  fastify.get('/summary', { preHandler: [authenticate] }, async () => {
    const stockItems = await db.stockItem.findMany({
      where: { product: { classification: { in: ['INGREDIENT', 'PACKAGING'] } }, isActive: true },
      include: {
        uom: { select: { abbreviation: true } },
        product: { select: { name: true, classification: true } },
        marketPrices: { orderBy: { checkedAt: 'desc' }, take: 5 },
        supplierQuotes: {
          orderBy: { createdAt: 'desc' },
          take: 5,
          include: { supplier: { select: { name: true } } },
        },
      },
    })
    return stockItems
  })
}

export default pricingRoutes
