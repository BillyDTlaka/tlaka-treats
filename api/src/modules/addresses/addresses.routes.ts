import { FastifyPluginAsync } from 'fastify'
import { authenticate } from '../../shared/middleware/auth'

const addressRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /addresses — get current user's saved addresses
  fastify.get('/', { preHandler: [authenticate] }, async (request) => {
    const user = request.user as { id: string }
    return fastify.prisma.address.findMany({
      where: { userId: user.id },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
    })
  })

  // POST /addresses — save a new address
  fastify.post('/', { preHandler: [authenticate] }, async (request, reply) => {
    const user = request.user as { id: string }
    const { label, street, suburb, city, province, postalCode, isDefault } = request.body as any

    // If this is default, unset all other defaults first
    if (isDefault) {
      await fastify.prisma.address.updateMany({
        where: { userId: user.id },
        data: { isDefault: false },
      })
    }

    const address = await fastify.prisma.address.create({
      data: {
        userId: user.id,
        label:      label      || undefined,
        street:     street,
        suburb:     suburb     || undefined,
        city:       city,
        province:   province,
        postalCode: postalCode,
        isDefault:  isDefault  ?? false,
      },
    })
    return reply.code(201).send(address)
  })

  // PATCH /addresses/:id — update an address
  fastify.patch('/:id', { preHandler: [authenticate] }, async (request) => {
    const user = request.user as { id: string }
    const { id } = request.params as { id: string }
    const body = request.body as any

    const address = await fastify.prisma.address.findUnique({ where: { id } })
    if (!address || address.userId !== user.id) {
      throw { statusCode: 404, message: 'Address not found' }
    }

    if (body.isDefault) {
      await fastify.prisma.address.updateMany({
        where: { userId: user.id },
        data: { isDefault: false },
      })
    }

    return fastify.prisma.address.update({ where: { id }, data: body })
  })

  // DELETE /addresses/:id — remove an address
  fastify.delete('/:id', { preHandler: [authenticate] }, async (request, reply) => {
    const user = request.user as { id: string }
    const { id } = request.params as { id: string }

    const address = await fastify.prisma.address.findUnique({ where: { id } })
    if (!address || address.userId !== user.id) {
      throw { statusCode: 404, message: 'Address not found' }
    }

    await fastify.prisma.address.delete({ where: { id } })
    return reply.code(204).send()
  })
}

export default addressRoutes
