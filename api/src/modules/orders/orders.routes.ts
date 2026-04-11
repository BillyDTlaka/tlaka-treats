import { FastifyPluginAsync } from 'fastify'
import bcrypt from 'bcryptjs'
import { OrderService } from './orders.service'
import { authenticate, authorize } from '../../shared/middleware/auth'
import { AppError, NotFoundError } from '../../shared/errors'

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

  // POST /orders/for-customer - ambassador places order on behalf of a customer
  // Finds or creates the customer by phone, auto-applies ambassador's own code
  fastify.post('/for-customer', { preHandler: [authenticate] }, async (request, reply) => {
    const reqUser = request.user as { id: string }

    const ambassador = await fastify.prisma.ambassador.findUnique({
      where: { userId: reqUser.id },
    })
    if (!ambassador || ambassador.status !== 'ACTIVE') {
      throw new AppError('Only active ambassadors can place orders for customers', 403)
    }

    const { firstName, lastName, phone, items, notes, address, paymentMethod } = request.body as {
      firstName: string
      lastName: string
      phone: string
      items: Array<{ variantId: string; quantity: number }>
      notes?: string
      address?: string
      paymentMethod?: string
    }

    if (!firstName?.trim() || !lastName?.trim() || !phone?.trim()) {
      throw new AppError('Customer first name, last name, and phone are required', 400)
    }
    if (!items?.length) throw new AppError('At least one item is required', 400)

    // Find existing customer by phone, or create a guest account
    let customer = await fastify.prisma.user.findUnique({ where: { phone: phone.trim() } })
    if (!customer) {
      const digits = phone.trim().replace(/\D/g, '')
      const guestEmail = `guest.${digits}@tlakatreats.local`
      const passwordHash = await bcrypt.hash(Math.random().toString(36) + Date.now(), 10)
      const customerRole = await fastify.prisma.role.findUnique({ where: { name: 'CUSTOMER' } })
      customer = await fastify.prisma.user.create({
        data: {
          email: guestEmail,
          phone: phone.trim(),
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          passwordHash,
          ...(customerRole ? { roles: { create: { roleId: customerRole.id } } } : {}),
        },
      })
    }

    const orderNotes = [
      address?.trim() ? `Delivery: ${address.trim()}` : null,
      notes?.trim() || null,
    ].filter(Boolean).join(' | ') || undefined

    const order = await orderService.create({
      customerId: customer.id,
      items,
      ambassadorCode: ambassador.code,
      notes: orderNotes,
    })

    // Store payment method on the created order
    if (paymentMethod) {
      await (fastify.prisma as any).order.update({
        where: { id: order.id },
        data: {
          paymentMethod,
          paymentStatus: paymentMethod === 'CARD' ? 'PENDING' : null,
        },
      })
    }

    return reply.code(201).send({ ...order, paymentMethod: paymentMethod ?? null })
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

  // GET /orders/ambassador/customers - unique customers linked to this ambassador
  fastify.get('/ambassador/customers', { preHandler: [authenticate] }, async (request) => {
    const user = request.user as { id: string }
    const ambassador = await fastify.prisma.ambassador.findUnique({ where: { userId: user.id } })
    if (!ambassador) return []

    const orders = await fastify.prisma.order.findMany({
      where: { ambassadorId: ambassador.id },
      include: {
        customer: { select: { id: true, firstName: true, lastName: true, phone: true, email: true } },
      },
      orderBy: { createdAt: 'desc' },
    })

    // Deduplicate — one entry per customer, most recent order first
    const seen = new Set<string>()
    const customers: any[] = []
    for (const o of orders) {
      if (o.customer && !seen.has(o.customerId)) {
        seen.add(o.customerId)
        customers.push(o.customer)
      }
    }
    return customers
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
