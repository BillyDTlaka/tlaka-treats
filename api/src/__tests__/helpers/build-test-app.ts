/**
 * Builds a Fastify test instance with a mock Prisma injected.
 * Avoids touching the real database — all DB calls go through jest.fn().
 */
import Fastify, { FastifyInstance } from 'fastify'
import cors from '@fastify/cors'
import jwt from '@fastify/jwt'
import { AppError } from '../../shared/errors'

// Routes under test
import authRoutes      from '../../modules/auth/auth.routes'
import productRoutes   from '../../modules/products/products.routes'
import orderRoutes     from '../../modules/orders/orders.routes'
import ambassadorRoutes from '../../modules/ambassadors/ambassadors.routes'

const TEST_JWT_SECRET = 'test-jwt-secret'

export async function buildTestApp(mockPrisma: any): Promise<FastifyInstance> {
  const app = Fastify({ logger: false })

  await app.register(cors, { origin: true })
  await app.register(jwt, { secret: TEST_JWT_SECRET })

  // Inject the mock prisma so all modules pick it up via fastify.prisma
  app.decorate('prisma', mockPrisma)

  // Mirror production error handler
  app.setErrorHandler((error, _req, reply) => {
    if (error instanceof AppError) {
      return reply.code(error.statusCode).send({
        error: error.code || 'ERROR',
        message: error.message,
      })
    }
    if (error.name === 'ZodError') {
      return reply.code(400).send({
        error: 'VALIDATION_ERROR',
        message: 'Invalid request data',
        issues: (error as any).errors,
      })
    }
    app.log.error(error)
    return reply.code(500).send({ error: 'INTERNAL_SERVER_ERROR', message: 'Something went wrong' })
  })

  await app.register(authRoutes,       { prefix: '/auth'       })
  await app.register(productRoutes,    { prefix: '/products'   })
  await app.register(orderRoutes,      { prefix: '/orders'     })
  await app.register(ambassadorRoutes, { prefix: '/ambassadors' })

  await app.ready()
  return app
}

/** Sign a JWT that the test app will accept. */
export function signToken(app: FastifyInstance, payload: object): string {
  return (app as any).jwt.sign(payload)
}

/** Convenience: sign a customer token. */
export function customerToken(app: FastifyInstance, userId = 'user-1') {
  return signToken(app, { id: userId, email: 'customer@test.com', roles: ['CUSTOMER'] })
}

/** Convenience: sign an admin token. */
export function adminToken(app: FastifyInstance, userId = 'admin-1') {
  return signToken(app, { id: userId, email: 'admin@test.com', roles: ['ADMIN'] })
}

/** Convenience: sign an ambassador token. */
export function ambassadorToken(app: FastifyInstance, userId = 'amb-user-1') {
  return signToken(app, { id: userId, email: 'ambassador@test.com', roles: ['AMBASSADOR'] })
}
