import Fastify from 'fastify'
import cors from '@fastify/cors'
import jwt from '@fastify/jwt'
import { config } from './config'
import prismaPlugin from './shared/plugins/prisma'
import { AppError } from './shared/errors'

// Routes
import authRoutes from './modules/auth/auth.routes'
import productRoutes from './modules/products/products.routes'
import orderRoutes from './modules/orders/orders.routes'
import ambassadorRoutes from './modules/ambassadors/ambassadors.routes'
import customerRoutes    from './modules/customers/customers.routes'
import addressRoutes    from './modules/addresses/addresses.routes'
import supplierRoutes   from './modules/suppliers/suppliers.routes'
import inventoryRoutes  from './modules/inventory/inventory.routes'
import recipeRoutes     from './modules/recipes/recipes.routes'
import productionRoutes from './modules/production/production.routes'
import financeRoutes    from './modules/finance/finance.routes'
import quoteRoutes       from './modules/quotes/quotes.routes'
import discountRuleRoutes from './modules/discount-rules/discount-rules.routes'
import packagingRoutes   from './modules/packaging/packaging.routes'
import uomRoutes         from './modules/uom/uom.routes'
import reportsRoutes     from './modules/reports/reports.routes'

export async function buildApp() {
  const app = Fastify({
    logger: config.isDev
      ? { transport: { target: 'pino-pretty' } }
      : true,
  })

  // ─── Plugins ──────────────────────────────────────────────────────────────
  await app.register(cors, { origin: true })
  await app.register(jwt, { secret: config.jwtSecret })
  await app.register(prismaPlugin)

  // ─── Global Error Handler ─────────────────────────────────────────────────
  app.setErrorHandler((error, request, reply) => {
    if (error instanceof AppError) {
      return reply.code(error.statusCode).send({
        error: error.code || 'ERROR',
        message: error.message,
      })
    }

    // Zod validation errors
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

  // ─── Routes ───────────────────────────────────────────────────────────────
  await app.register(authRoutes, { prefix: '/auth' })
  await app.register(productRoutes, { prefix: '/products' })
  await app.register(orderRoutes, { prefix: '/orders' })
  await app.register(ambassadorRoutes, { prefix: '/ambassadors' })
  await app.register(customerRoutes,    { prefix: '/customers' })
  await app.register(addressRoutes,    { prefix: '/addresses' })
  await app.register(supplierRoutes,    { prefix: '/suppliers' })
  await app.register(inventoryRoutes,   { prefix: '/inventory' })
  await app.register(recipeRoutes,      { prefix: '/recipes' })
  await app.register(productionRoutes,  { prefix: '/production' })
  await app.register(financeRoutes,     { prefix: '/finance' })
  await app.register(quoteRoutes,       { prefix: '/quotes' })
  await app.register(discountRuleRoutes, { prefix: '/discount-rules' })
  await app.register(packagingRoutes,    { prefix: '/packaging' })
  await app.register(uomRoutes,          { prefix: '/uom' })
  await app.register(reportsRoutes,      { prefix: '/reports' })

  // Health check
  app.get('/health', async () => ({ status: 'ok', timestamp: new Date().toISOString() }))

  return app
}
