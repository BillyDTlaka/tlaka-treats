import { FastifyRequest, FastifyReply } from 'fastify'
import { UnauthorizedError, ForbiddenError } from '../errors'

export async function authenticate(request: FastifyRequest, reply: FastifyReply) {
  try {
    await request.jwtVerify()
  } catch {
    throw new UnauthorizedError('Invalid or expired token')
  }
}

export function authorize(action: string, subject: string) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.user as { id: string; roles: string[] }

    const permissions = await request.server.prisma.permission.findMany({
      where: {
        role: { users: { some: { userId: user.id } } },
        subject,
        action: { in: [action, 'manage'] },
      },
    })

    if (permissions.length === 0) {
      throw new ForbiddenError(`You don't have permission to ${action} ${subject}`)
    }
  }
}
