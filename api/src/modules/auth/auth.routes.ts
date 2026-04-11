import { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { AuthService } from './auth.service'
import { authenticate } from '../../shared/middleware/auth'

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  phone: z.string().optional(),
})

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
})

const authRoutes: FastifyPluginAsync = async (fastify) => {
  const authService = new AuthService(fastify.prisma)

  // POST /auth/register
  fastify.post('/register', async (request, reply) => {
    const body = registerSchema.parse(request.body)
    const user = await authService.register(body)
    const token = fastify.jwt.sign({
      id: user.id,
      email: user.email,
      roles: user.roles.map(r => r.role.name),
    })
    return reply.code(201).send({ token, user: { id: user.id, email: user.email, firstName: user.firstName, lastName: user.lastName, roles: user.roles.map((r: any) => r.role.name) } })
  })

  // POST /auth/login
  fastify.post('/login', async (request, reply) => {
    const { email, password } = loginSchema.parse(request.body)
    const user = await authService.login(email, password)
    const token = fastify.jwt.sign({
      id: user.id,
      email: user.email,
      roles: user.roles.map(r => r.role.name),
    })
    return { token, user: { id: user.id, email: user.email, firstName: user.firstName, lastName: user.lastName, roles: user.roles.map(r => r.role.name) } }
  })

  // GET /auth/me
  fastify.get('/me', { preHandler: [authenticate] }, async (request) => {
    const { id } = request.user as { id: string }
    return authService.getProfile(id)
  })

  // PATCH /auth/me — update own profile
  fastify.patch('/me', { preHandler: [authenticate] }, async (request) => {
    const { id } = request.user as { id: string }
    const { firstName, lastName, phone } = request.body as any
    const data: any = {}
    if (firstName !== undefined) data.firstName = firstName
    if (lastName  !== undefined) data.lastName  = lastName
    if (phone     !== undefined) data.phone      = phone || null
    return (fastify.prisma as any).user.update({ where: { id }, data, select: { id: true, email: true, firstName: true, lastName: true, phone: true } })
  })
}

export default authRoutes
