import { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { ProductService } from './products.service'
import { authenticate, authorize } from '../../shared/middleware/auth'

const productRoutes: FastifyPluginAsync = async (fastify) => {
  const productService = new ProductService(fastify.prisma)

  // GET /products - public
  fastify.get('/', async (request) => {
    const query = request.query as { tier?: string }
    const tier = (query.tier as any) || 'RETAIL'
    return productService.getAll(tier)
  })

  // GET /products/:id - public
  fastify.get('/:id', async (request) => {
    const { id } = request.params as { id: string }
    return productService.getById(id)
  })

  // GET /products/admin - admin only, includes inactive
  fastify.get('/admin', {
    preHandler: [authenticate, authorize('create', 'product')],
  }, async () => {
    return productService.getAllAdmin()
  })

  // POST /products - admin only
  fastify.post('/', {
    preHandler: [authenticate, authorize('create', 'product')],
  }, async (request, reply) => {
    const body = request.body as any
    const product = await productService.create(body)
    return reply.code(201).send(product)
  })

  // PATCH /products/:id - admin only
  fastify.patch('/:id', {
    preHandler: [authenticate, authorize('update', 'product')],
  }, async (request) => {
    const { id } = request.params as { id: string }
    return productService.update(id, request.body as any)
  })

  // POST /products/:id/variants - add a variant to an existing product
  fastify.post('/:id/variants', {
    preHandler: [authenticate, authorize('update', 'product')],
  }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const variant = await productService.addVariant(id, request.body as any)
    return reply.code(201).send(variant)
  })
}

export default productRoutes
