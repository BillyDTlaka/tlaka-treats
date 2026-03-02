import { FastifyPluginAsync } from 'fastify'
import { authenticate, authorize } from '../../shared/middleware/auth'

const customerRoutes: FastifyPluginAsync = async (fastify) => {

  // ── GET /customers ── Admin: list all users with orders + ambassador info
  fastify.get('/', {
    preHandler: [authenticate, authorize('manage', 'user')],
  }, async () => {
    const users = await fastify.prisma.user.findMany({
      include: {
        roles: { include: { role: { select: { name: true } } } },
        orders: {
          select: { id: true, total: true, status: true, createdAt: true },
          orderBy: { createdAt: 'desc' },
        },
        ambassador: {
          select: { id: true, code: true, status: true, commissionRate: true },
        },
        addresses: {
          select: { id: true, label: true, street: true, suburb: true, city: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    return users.map(u => ({
      id:         u.id,
      email:      u.email,
      phone:      u.phone,
      firstName:  u.firstName,
      lastName:   u.lastName,
      status:     u.status,
      createdAt:  u.createdAt,
      updatedAt:  u.updatedAt,
      roles:      u.roles.map(r => r.role.name),
      orderCount: u.orders.length,
      totalSpent: u.orders.reduce((s, o) => s + Number(o.total || 0), 0),
      lastOrder:  u.orders[0] ?? null,
      orders:     u.orders,
      ambassador: u.ambassador,
      addresses:  u.addresses,
    }))
  })

  // ── PATCH /customers/:id/status ── Admin: activate or suspend a user
  fastify.patch('/:id/status', {
    preHandler: [authenticate, authorize('manage', 'user')],
  }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const { status } = request.body as { status: 'ACTIVE' | 'SUSPENDED' }

    if (!['ACTIVE', 'SUSPENDED'].includes(status)) {
      return reply.code(400).send({ error: 'INVALID_STATUS', message: 'Status must be ACTIVE or SUSPENDED' })
    }

    const updated = await fastify.prisma.user.update({
      where: { id },
      data: { status },
      select: { id: true, email: true, firstName: true, lastName: true, status: true },
    })

    return updated
  })
}

export default customerRoutes
