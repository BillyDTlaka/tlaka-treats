import { FastifyPluginAsync } from 'fastify'
import { DiscountRuleService } from './discount-rules.service'
import { authenticate, authorize } from '../../shared/middleware/auth'

const discountRuleRoutes: FastifyPluginAsync = async (fastify) => {
  const svc = new DiscountRuleService(fastify.prisma)

  // GET /discount-rules/active — any logged-in user (for applying on quotes)
  fastify.get('/active', { preHandler: [authenticate] }, async () => svc.getActive())

  // GET /discount-rules — admin only
  fastify.get('/', {
    preHandler: [authenticate, authorize('manage', 'order')],
  }, async () => svc.getAll())

  // POST /discount-rules
  fastify.post('/', {
    preHandler: [authenticate, authorize('manage', 'order')],
  }, async (request, reply) => {
    const rule = await svc.create(request.body as any)
    return reply.code(201).send(rule)
  })

  // PATCH /discount-rules/:id
  fastify.patch('/:id', {
    preHandler: [authenticate, authorize('manage', 'order')],
  }, async (request) => {
    const { id } = request.params as { id: string }
    return svc.update(id, request.body as any)
  })

  // DELETE /discount-rules/:id
  fastify.delete('/:id', {
    preHandler: [authenticate, authorize('manage', 'order')],
  }, async (request, reply) => {
    const { id } = request.params as { id: string }
    await svc.remove(id)
    return reply.code(204).send()
  })
}

export default discountRuleRoutes
