import { FastifyPluginAsync } from 'fastify'
import { authenticate, authorize } from '../../shared/middleware/auth'
import { AppError } from '../../shared/errors'

const departmentRoutes: FastifyPluginAsync = async (fastify) => {
  const db = fastify.prisma as any
  const auth = [authenticate, authorize('manage', 'employee')]

  const include = {
    manager: { select: { id: true, jobTitle: true, user: { select: { firstName: true, lastName: true } } } },
    employees: {
      where: { status: 'ACTIVE' },
      select: { id: true, jobTitle: true, employmentType: true, hourlyRate: true, monthlyRate: true,
                user: { select: { firstName: true, lastName: true } } },
    },
  }

  fastify.get('/', { preHandler: [authenticate] }, async () => {
    return db.department.findMany({ include, orderBy: { name: 'asc' } })
  })

  fastify.post('/', { preHandler: auth }, async (req, reply) => {
    const { name, description, managerId } = req.body as any
    if (!name?.trim()) throw new AppError('Department name is required', 400, 'INVALID_BODY')
    const dept = await db.department.create({
      data: { name: name.trim(), description: description?.trim(), managerId: managerId || null },
      include,
    })
    return reply.code(201).send(dept)
  })

  fastify.patch('/:id', { preHandler: auth }, async (req) => {
    const { id } = req.params as { id: string }
    const body = req.body as any
    return db.department.update({
      where: { id },
      data: {
        ...(body.name        ? { name:        body.name.trim()        } : {}),
        ...(body.description !== undefined ? { description: body.description } : {}),
        ...(body.managerId   !== undefined ? { managerId:   body.managerId || null } : {}),
      },
      include,
    })
  })

  fastify.delete('/:id', { preHandler: auth }, async (req, reply) => {
    const { id } = req.params as { id: string }
    // Unlink employees first
    await db.employee.updateMany({ where: { departmentId: id }, data: { departmentId: null } })
    await db.department.delete({ where: { id } })
    return reply.code(204).send()
  })
}

export default departmentRoutes
