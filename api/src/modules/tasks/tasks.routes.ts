import { FastifyPluginAsync } from 'fastify'
import { authenticate, authorize } from '../../shared/middleware/auth'
import { TaskService } from './tasks.service'

const taskRoutes: FastifyPluginAsync = async (fastify) => {
  const svc = new TaskService(fastify.prisma)

  fastify.get('/', { preHandler: [authenticate] }, async (req) => {
    const { status, priority } = req.query as { status?: string; priority?: string }
    return svc.list({ status, priority })
  })

  fastify.get('/counts', { preHandler: [authenticate] }, async () => svc.counts())

  fastify.post('/', { preHandler: [authenticate] }, async (req, reply) => {
    const task = await svc.create(req.body as any)
    return reply.code(201).send(task)
  })

  fastify.post('/from-board/:meetingId', { preHandler: [authenticate, authorize('manage', 'product')] }, async (req, reply) => {
    const { meetingId } = req.params as { meetingId: string }
    const result = await svc.createFromBoardMeeting(meetingId)
    return reply.code(201).send(result)
  })

  fastify.get('/:id', { preHandler: [authenticate] }, async (req) => {
    const { id } = req.params as { id: string }
    return svc.getById(id)
  })

  fastify.patch('/:id', { preHandler: [authenticate] }, async (req) => {
    const { id } = req.params as { id: string }
    return svc.update(id, req.body as any)
  })

  fastify.delete('/:id', { preHandler: [authenticate] }, async (req, reply) => {
    const { id } = req.params as { id: string }
    await svc.delete(id)
    return reply.code(204).send()
  })
}

export default taskRoutes
