import { FastifyPluginAsync } from 'fastify'
import { OrderService } from './orders.service'
import { authenticate, authorize } from '../../shared/middleware/auth'

const orderRoutes: FastifyPluginAsync = async (fastify) => {
  const orderService = new OrderService(fastify.prisma)

  // POST /orders - customer creates order
  fastify.post('/', { preHandler: [authenticate] }, async (request, reply) => {
    const user = request.user as { id: string }
    const body = request.body as any
    const order = await orderService.create({ ...body, customerId: user.id })
    return reply.code(201).send(order)
  })

  // GET /orders - admin gets all orders
  fastify.get('/', {
    preHandler: [authenticate, authorize('manage', 'order')],
  }, async () => {
    return orderService.getAll()
  })

  // GET /orders/my - customer gets their own orders
  fastify.get('/my', { preHandler: [authenticate] }, async (request) => {
    const user = request.user as { id: string }
    return orderService.getForCustomer(user.id)
  })

  // GET /orders/ambassador - ambassador gets attributed orders
  fastify.get('/ambassador', { preHandler: [authenticate] }, async (request) => {
    const user = request.user as { id: string }
    const ambassador = await fastify.prisma.ambassador.findUnique({ where: { userId: user.id } })
    if (!ambassador) return []
    return orderService.getForAmbassador(ambassador.id)
  })

  // PATCH /orders/:id/status - admin updates order status
  fastify.patch('/:id/status', {
    preHandler: [authenticate, authorize('update', 'order')],
  }, async (request) => {
    const { id } = request.params as { id: string }
    const { status, note } = request.body as { status: any; note?: string }
    return orderService.updateStatus(id, status, note)
  })
}

export default orderRoutes
