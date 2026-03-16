import { FastifyPluginAsync } from 'fastify'
import { authenticate, authorize } from '../../shared/middleware/auth'

const reportsRoutes: FastifyPluginAsync = async (fastify) => {
  const db = fastify.prisma as any
  const auth = [authenticate, authorize('manage', 'product')]

  // ── GET /reports/inventory ─── Stock levels, low stock, movement summary
  fastify.get('/inventory', { preHandler: auth }, async () => {
    const [stockItems, movementSummary, lowStock] = await Promise.all([
      db.stockItem.findMany({
        include: {
          uom: { select: { abbreviation: true } },
          product: { select: { id: true, name: true, classification: true } },
        },
        orderBy: { name: 'asc' },
      }),
      db.stockMovement.groupBy({
        by: ['type'],
        _sum: { quantity: true },
        _count: true,
        where: { createdAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } },
      }),
      db.stockItem.findMany({
        where: {
          minStockLevel: { gt: 0 },
          currentStock: { lt: db.stockItem.fields?.minStockLevel ?? undefined },
        },
        include: {
          uom: { select: { abbreviation: true } },
          product: { select: { name: true } },
        },
      }),
    ])

    // Low stock: items where currentStock < minStockLevel
    const actualLowStock = stockItems.filter(
      (i: any) => Number(i.minStockLevel) > 0 && Number(i.currentStock) < Number(i.minStockLevel)
    )
    const zeroStock = stockItems.filter((i: any) => Number(i.currentStock) <= 0)

    // Top items by stock value
    const byValue = stockItems
      .map((i: any) => ({
        id: i.id,
        name: i.name,
        currentStock: Number(i.currentStock),
        costPerUnit: Number(i.costPerUnit),
        stockValue: Number(i.currentStock) * Number(i.costPerUnit),
        uom: i.uom?.abbreviation || i.unit || '',
      }))
      .sort((a: any, b: any) => b.stockValue - a.stockValue)
      .slice(0, 10)

    const totalStockValue = stockItems.reduce(
      (s: number, i: any) => s + Number(i.currentStock) * Number(i.costPerUnit), 0
    )

    return {
      summary: {
        totalItems: stockItems.length,
        lowStockCount: actualLowStock.length,
        zeroStockCount: zeroStock.length,
        totalStockValue,
      },
      lowStock: actualLowStock.map((i: any) => ({
        id: i.id,
        name: i.name,
        currentStock: Number(i.currentStock),
        minStockLevel: Number(i.minStockLevel),
        uom: i.uom?.abbreviation || i.unit || '',
        product: i.product?.name,
      })),
      topByValue: byValue,
      movementSummary: movementSummary.map((m: any) => ({
        type: m.type,
        count: m._count,
        totalQuantity: Number(m._sum.quantity || 0),
      })),
    }
  })

  // ── GET /reports/production ─── Production runs, batch counts, yield by recipe
  fastify.get('/production', { preHandler: auth }, async (req) => {
    const { from, to } = req.query as any
    const dateFilter: any = {}
    if (from) dateFilter.gte = new Date(from)
    if (to)   dateFilter.lte = new Date(to)
    const where: any = Object.keys(dateFilter).length ? { createdAt: dateFilter } : {}

    const [runs, packagingRuns, outputMovements] = await Promise.all([
      db.productionRun.findMany({
        where,
        include: {
          recipe: { select: { id: true, name: true, outputProductId: true, yieldPerBatch: true } },
          packagingRun: { select: { id: true, status: true, completedAt: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      db.packagingRun.findMany({
        where: Object.keys(dateFilter).length ? { createdAt: dateFilter } : {},
        include: {
          productionRun: { include: { recipe: { select: { name: true } } } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      db.stockMovement.findMany({
        where: { type: 'PRODUCTION_OUTPUT', ...(Object.keys(dateFilter).length ? { createdAt: dateFilter } : {}) },
        include: { stockItem: { select: { name: true } } },
      }),
    ])

    // Summarise by status
    const byStatus: Record<string, number> = {}
    for (const r of runs) {
      byStatus[r.status] = (byStatus[r.status] || 0) + 1
    }

    // Summarise by recipe
    const byRecipe: Record<string, any> = {}
    for (const r of runs) {
      const key = r.recipe.id
      if (!byRecipe[key]) byRecipe[key] = { recipeName: r.recipe.name, runs: 0, totalBatches: 0, unitsProduced: 0, yieldPerBatch: Number(r.recipe.yieldPerBatch || 0) }
      byRecipe[key].runs++
      if (r.status === 'COMPLETED') byRecipe[key].totalBatches += Number(r.batches || 0)
    }

    // Add units produced from PRODUCTION_OUTPUT movements
    for (const m of outputMovements) {
      // Match to recipe via packagingRun reference
      const pr = packagingRuns.find((p: any) => p.id === m.reference)
      if (pr) {
        const recipeId = pr.productionRun?.recipe ? pr.productionRun.recipeId : null
        if (recipeId && byRecipe[recipeId]) {
          byRecipe[recipeId].unitsProduced += Number(m.quantity)
        }
      }
    }

    const totalUnitsProduced = outputMovements.reduce((s: number, m: any) => s + Number(m.quantity), 0)
    const completedPackaging = packagingRuns.filter((p: any) => p.status === 'COMPLETED').length

    return {
      summary: {
        totalRuns: runs.length,
        byStatus,
        completedPackagingRuns: completedPackaging,
        totalUnitsProduced,
      },
      byRecipe: Object.values(byRecipe).sort((a: any, b: any) => b.runs - a.runs),
      recentRuns: runs.slice(0, 20).map((r: any) => ({
        id: r.id,
        recipe: r.recipe.name,
        batches: Number(r.batches),
        status: r.status,
        createdAt: r.createdAt,
        completedAt: r.completedAt,
        packagingStatus: r.packagingRun?.status || null,
      })),
    }
  })

  // ── GET /reports/sales ─── Sales summary (date-ranged)
  fastify.get('/sales', { preHandler: auth }, async (req) => {
    const { from, to } = req.query as any
    const dateFilter: any = {}
    if (from) dateFilter.gte = new Date(from)
    if (to)   dateFilter.lte = new Date(to)
    const where: any = Object.keys(dateFilter).length ? { createdAt: dateFilter } : {}

    const [orders, topProducts] = await Promise.all([
      db.order.findMany({
        where,
        include: {
          items: { include: { variant: { include: { product: { select: { name: true } } } } } },
          ambassador: { select: { code: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      db.orderItem.groupBy({
        by: ['variantId'],
        _sum: { quantity: true, subtotal: true },
        _count: true,
        orderBy: { _sum: { subtotal: 'desc' } },
        take: 10,
        where: Object.keys(dateFilter).length ? { order: { createdAt: dateFilter } } : {},
      }),
    ])

    const delivered = orders.filter((o: any) => o.status === 'DELIVERED')
    const revenue = delivered.reduce((s: number, o: any) => s + Number(o.total || 0), 0)
    const avgOrder = delivered.length ? revenue / delivered.length : 0

    return {
      summary: {
        totalOrders: orders.length,
        deliveredOrders: delivered.length,
        cancelledOrders: orders.filter((o: any) => o.status === 'CANCELLED').length,
        totalRevenue: revenue,
        avgOrderValue: avgOrder,
      },
      orders: orders.slice(0, 50),
    }
  })
}

export default reportsRoutes
