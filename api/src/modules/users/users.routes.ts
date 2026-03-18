import { FastifyPluginAsync } from 'fastify'
import { authenticate, authorize } from '../../shared/middleware/auth'
import { AppError } from '../../shared/errors'
import bcrypt from 'bcryptjs'

const auth = [authenticate, authorize('manage', 'user')]

const USER_SELECT = {
  id:        true,
  email:     true,
  firstName: true,
  lastName:  true,
  phone:     true,
  status:    true,
  createdAt: true,
  roles: {
    include: { role: { select: { id: true, name: true, description: true } } },
  },
}

const usersRoutes: FastifyPluginAsync = async (fastify) => {
  const db = fastify.prisma as any

  // ── Users ──────────────────────────────────────────────────────────────────

  // GET /users — list all users
  fastify.get('/', { preHandler: auth }, async (req) => {
    const { status, search } = req.query as { status?: string; search?: string }
    return db.user.findMany({
      where: {
        ...(status ? { status } : {}),
        ...(search ? {
          OR: [
            { email:     { contains: search, mode: 'insensitive' } },
            { firstName: { contains: search, mode: 'insensitive' } },
            { lastName:  { contains: search, mode: 'insensitive' } },
          ],
        } : {}),
      },
      select: USER_SELECT,
      orderBy: { createdAt: 'desc' },
    })
  })

  // POST /users — create user (admin)
  fastify.post('/', { preHandler: auth }, async (req, reply) => {
    const { email, password, firstName, lastName, phone, roleIds } = req.body as any
    if (!email?.trim() || !password || !firstName?.trim()) {
      throw new AppError('email, password and firstName are required', 400, 'INVALID_BODY')
    }
    const existing = await db.user.findUnique({ where: { email: email.trim().toLowerCase() } })
    if (existing) throw new AppError('Email already in use', 409, 'DUPLICATE_EMAIL')

    const passwordHash = await bcrypt.hash(password, 10)
    const user = await db.user.create({
      data: {
        email:     email.trim().toLowerCase(),
        passwordHash,
        firstName: firstName.trim(),
        lastName:  lastName?.trim() || '',
        phone:     phone || null,
        roles: (roleIds?.length)
          ? { create: roleIds.map((rid: string) => ({ roleId: rid })) }
          : undefined,
      },
      select: USER_SELECT,
    })
    return reply.code(201).send(user)
  })

  // PATCH /users/:id — update user
  fastify.patch('/:id', { preHandler: auth }, async (req) => {
    const { id } = req.params as { id: string }
    const { firstName, lastName, phone, status, password } = req.body as any
    const data: any = {}
    if (firstName !== undefined) data.firstName = firstName.trim()
    if (lastName  !== undefined) data.lastName  = lastName.trim()
    if (phone     !== undefined) data.phone      = phone || null
    if (status    !== undefined) data.status     = status
    if (password?.length >= 8)  data.passwordHash = await bcrypt.hash(password, 10)
    return db.user.update({ where: { id }, data, select: USER_SELECT })
  })

  // DELETE /users/:id — delete user (hard delete, careful)
  fastify.delete('/:id', { preHandler: auth }, async (req, reply) => {
    const { id } = req.params as { id: string }
    const me = (req.user as any).id
    if (id === me) throw new AppError('Cannot delete your own account', 400, 'SELF_DELETE')
    await db.user.delete({ where: { id } })
    return reply.code(204).send()
  })

  // POST /users/:id/roles — assign role
  fastify.post('/:id/roles', { preHandler: auth }, async (req, reply) => {
    const { id } = req.params as { id: string }
    const { roleId } = req.body as { roleId: string }
    await db.userRole.upsert({
      where: { userId_roleId: { userId: id, roleId } },
      create: { userId: id, roleId },
      update: {},
    })
    return reply.code(201).send({ userId: id, roleId })
  })

  // DELETE /users/:id/roles/:roleId — remove role
  fastify.delete('/:id/roles/:roleId', { preHandler: auth }, async (req, reply) => {
    const { id, roleId } = req.params as { id: string; roleId: string }
    await db.userRole.delete({ where: { userId_roleId: { userId: id, roleId } } })
    return reply.code(204).send()
  })

  // ── Roles ──────────────────────────────────────────────────────────────────

  // GET /users/roles — list all roles with permissions
  fastify.get('/roles', { preHandler: auth }, async () => {
    return db.role.findMany({
      include: {
        permissions: true,
        _count: { select: { users: true } },
      },
      orderBy: { name: 'asc' },
    })
  })

  // POST /users/roles — create role
  fastify.post('/roles', { preHandler: auth }, async (req, reply) => {
    const { name, description } = req.body as any
    if (!name?.trim()) throw new AppError('Role name is required', 400, 'INVALID_BODY')
    const role = await db.role.create({
      data: { name: name.trim().toUpperCase(), description: description?.trim() },
      include: { permissions: true, _count: { select: { users: true } } },
    })
    return reply.code(201).send(role)
  })

  // PATCH /users/roles/:id — update role
  fastify.patch('/roles/:id', { preHandler: auth }, async (req) => {
    const { id } = req.params as { id: string }
    const { name, description } = req.body as any
    return db.role.update({
      where: { id },
      data: {
        ...(name        ? { name: name.trim().toUpperCase() } : {}),
        ...(description !== undefined ? { description } : {}),
      },
      include: { permissions: true, _count: { select: { users: true } } },
    })
  })

  // DELETE /users/roles/:id — delete role
  fastify.delete('/roles/:id', { preHandler: auth }, async (req, reply) => {
    const { id } = req.params as { id: string }
    const role = await db.role.findUnique({ where: { id }, include: { _count: { select: { users: true } } } })
    if (!role) throw new AppError('Role not found', 404, 'NOT_FOUND')
    if (role._count.users > 0) throw new AppError(`Cannot delete role — ${role._count.users} user(s) assigned`, 400, 'ROLE_IN_USE')
    await db.role.delete({ where: { id } })
    return reply.code(204).send()
  })

  // POST /users/roles/:id/permissions — add permission to role
  fastify.post('/roles/:id/permissions', { preHandler: auth }, async (req, reply) => {
    const { id } = req.params as { id: string }
    const { action, subject } = req.body as { action: string; subject: string }
    if (!action || !subject) throw new AppError('action and subject required', 400, 'INVALID_BODY')
    const perm = await db.permission.upsert({
      where:  { action_subject_roleId: { action, subject, roleId: id } },
      create: { action, subject, roleId: id },
      update: {},
    })
    return reply.code(201).send(perm)
  })

  // DELETE /users/roles/:id/permissions/:permId — remove permission
  fastify.delete('/roles/:id/permissions/:permId', { preHandler: auth }, async (req, reply) => {
    const { permId } = req.params as { id: string; permId: string }
    await db.permission.delete({ where: { id: permId } })
    return reply.code(204).send()
  })
}

export default usersRoutes
