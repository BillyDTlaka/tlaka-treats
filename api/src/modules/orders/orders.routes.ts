import { FastifyPluginAsync } from 'fastify'
import { OrderService } from './orders.service'
import { authenticate, authorize } from '../../shared/middleware/auth'
import { NotFoundError } from '../../shared/errors'

const orderRoutes: FastifyPluginAsync = async (fastify) => {
  const orderService = new OrderService(fastify.prisma)

  // POST /orders/admin - admin places order on behalf of a client
  fastify.post('/admin', {
    preHandler: [authenticate, authorize('manage', 'order')],
  }, async (request, reply) => {
    const { customerId, items, addressId, ambassadorCode, notes } = request.body as {
      customerId: string
      items: Array<{ variantId: string; quantity: number }>
      addressId?: string
      ambassadorCode?: string
      notes?: string
    }

    const customer = await fastify.prisma.user.findUnique({ where: { id: customerId } })
    if (!customer) throw new NotFoundError('Customer')

    const order = await orderService.create({ customerId, items, addressId, ambassadorCode, notes })
    return reply.code(201).send(order)
  })

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

  // GET /orders/:id - admin gets single order
  fastify.get('/:id', {
    preHandler: [authenticate, authorize('manage', 'order')],
  }, async (request) => {
    const { id } = request.params as { id: string }
    return orderService.getById(id)
  })

  // PUT /orders/:id/items - admin replaces all order items
  fastify.put('/:id/items', {
    preHandler: [authenticate, authorize('manage', 'order')],
  }, async (request) => {
    const { id } = request.params as { id: string }
    const { items } = request.body as { items: Array<{ variantId: string; quantity: number }> }
    return orderService.updateItems(id, items)
  })

  // PATCH /orders/:id - admin edits order fields
  fastify.patch('/:id', {
    preHandler: [authenticate, authorize('manage', 'order')],
  }, async (request) => {
    const { id } = request.params as { id: string }
    const { notes, deliveryFee, ambassadorCode } = request.body as {
      notes?: string
      deliveryFee?: number
      ambassadorCode?: string | null
    }
    return orderService.update(id, { notes, deliveryFee, ambassadorCode })
  })

  // POST /orders/:id/invoice - admin generates invoice
  fastify.post('/:id/invoice', {
    preHandler: [authenticate, authorize('manage', 'order')],
  }, async (request) => {
    const { id } = request.params as { id: string }
    return orderService.generateInvoice(id)
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
