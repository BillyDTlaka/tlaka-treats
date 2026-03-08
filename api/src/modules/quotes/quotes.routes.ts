import { FastifyPluginAsync } from 'fastify'
import { QuoteService } from './quotes.service'
import { authenticate, authorize } from '../../shared/middleware/auth'

const quoteRoutes: FastifyPluginAsync = async (fastify) => {
  const svc = new QuoteService(fastify.prisma)

  // GET /quotes — admin: all quotes
  fastify.get('/', {
    preHandler: [authenticate, authorize('manage', 'order')],
  }, async () => svc.getAll())

  // GET /quotes/my — ambassador/user: own quotes
  fastify.get('/my', { preHandler: [authenticate] }, async (request) => {
    const user = request.user as { id: string }
    return svc.getMy(user.id)
  })

  // GET /quotes/:id
  fastify.get('/:id', { preHandler: [authenticate] }, async (request) => {
    const { id } = request.params as { id: string }
    return svc.getById(id)
  })

  // POST /quotes — create
  fastify.post('/', { preHandler: [authenticate] }, async (request, reply) => {
    const user = request.user as { id: string }
    const body = request.body as any
    const quote = await svc.create({ ...body, createdById: user.id })
    return reply.code(201).send(quote)
  })

  // PATCH /quotes/:id — update (DRAFT only)
  fastify.patch('/:id', { preHandler: [authenticate] }, async (request) => {
    const { id } = request.params as { id: string }
    return svc.update(id, request.body as any)
  })

  // PATCH /quotes/:id/status — change status
  fastify.patch('/:id/status', { preHandler: [authenticate] }, async (request) => {
    const { id } = request.params as { id: string }
    const { status } = request.body as { status: string }
    return svc.updateStatus(id, status)
  })

  // POST /quotes/:id/convert — convert to order
  fastify.post('/:id/convert', { preHandler: [authenticate] }, async (request) => {
    const { id } = request.params as { id: string }
    return svc.convert(id)
  })

  // DELETE /quotes/:id — delete DRAFT
  fastify.delete('/:id', { preHandler: [authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string }
    await svc.remove(id)
    return reply.code(204).send()
  })
}

export default quoteRoutes
