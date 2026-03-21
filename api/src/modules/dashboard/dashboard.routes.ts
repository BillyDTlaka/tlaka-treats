import { FastifyPluginAsync } from 'fastify'
import { authenticate } from '../../shared/middleware/auth'

const dashboardRoutes: FastifyPluginAsync = async (fastify) => {
  const db = fastify.prisma as any

  // GET /dashboard/summary — single endpoint for mobile KPI cards
  fastify.get('/summary', { preHandler: [authenticate] }, async () => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const todayEnd = new Date(today)
    todayEnd.setHours(23, 59, 59, 999)

    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

    const [
      todayRevenue,
      pendingOrders,
      recentOrders,
      lowStockCount,
      lowStockItems,
      todayProduction,
      monthRevenue,
      pendingLeave,
    ] = await Promise.all([
      // Today's revenue from completed/delivered orders
      db.order.aggregate({
        where: { status: { in: ['COMPLETED', 'DELIVERED'] }, createdAt: { gte: today, lte: todayEnd } },
        _sum: { total: true },
      }).catch(() => ({ _sum: { total: 0 } })),

      // Pending orders count
      db.order.count({ where: { status: { in: ['PENDING', 'CONFIRMED'] } } }).catch(() => 0),

      // Recent 6 orders
      db.order.findMany({
        take: 6,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true, status: true, total: true, createdAt: true,
          customer: { select: { firstName: true, lastName: true } },
          items: { select: { quantity: true, variant: { select: { product: { select: { name: true } } } } }, take: 1 },
        },
      }).catch(() => []),

      // Low stock count (currentStock <= reorderPoint or <= 5)
      db.stockItem.count({
        where: { OR: [{ currentStock: { lte: 5 } }, { reorderPoint: { gt: 0 }, currentStock: { lte: db.stockItem.fields?.reorderPoint } }] },
      }).catch(() =>
        db.stockItem.count({ where: { currentStock: { lte: 5 } } }).catch(() => 0)
      ),

      // Low stock items list
      db.stockItem.findMany({
        where: { currentStock: { lte: 10 } },
        select: { id: true, name: true, currentStock: true, uom: { select: { abbreviation: true } } },
        orderBy: { currentStock: 'asc' },
        take: 5,
      }).catch(() => []),

      // Today's production runs completed
      db.productionRun.count({
        where: { status: 'COMPLETED', updatedAt: { gte: today } },
      }).catch(() => 0),

      // Month revenue
      db.order.aggregate({
        where: { status: { in: ['COMPLETED', 'DELIVERED'] }, createdAt: { gte: thirtyDaysAgo } },
        _sum: { total: true },
        _count: true,
      }).catch(() => ({ _sum: { total: 0 }, _count: 0 })),

      // Pending leave requests
      db.leaveRequest.count({ where: { status: 'PENDING' } }).catch(() => 0),
    ])

    return {
      today: {
        revenue:    Number(todayRevenue._sum?.total || 0),
        orders:     pendingOrders,
        production: todayProduction,
      },
      month: {
        revenue:    Number(monthRevenue._sum?.total || 0),
        orderCount: monthRevenue._count || 0,
      },
      alerts: {
        lowStock:    lowStockCount,
        pendingLeave,
        pendingOrders,
      },
      recentOrders,
      lowStockItems,
    }
  })
}

export default dashboardRoutes
