import { FastifyPluginAsync } from 'fastify'
import { ProductService } from './products.service'
import { authenticate, authorize } from '../../shared/middleware/auth'
import { syncProductVariantToOdoo } from '../../shared/services/odoo-product.service'

const productRoutes: FastifyPluginAsync = async (fastify) => {
  const productService = new ProductService(fastify.prisma)

  // ── Categories ────────────────────────────────────────────────────────────

  // GET /products/categories - public (customer app needs them too)
  fastify.get('/categories', async () => {
    return productService.listCategories()
  })

  // POST /products/categories - admin only
  fastify.post('/categories', {
    preHandler: [authenticate, authorize('create', 'product')],
  }, async (request, reply) => {
    const { name, description } = request.body as { name: string; description?: string }
    const category = await productService.createCategory(name, description)
    return reply.code(201).send(category)
  })

  // DELETE /products/categories/:id - admin only
  fastify.delete('/categories/:id', {
    preHandler: [authenticate, authorize('create', 'product')],
  }, async (request, reply) => {
    const { id } = request.params as { id: string }
    await productService.deleteCategory(id)
    return reply.code(204).send()
  })

  // PATCH /products/categories/:id/odoo-income-account - set the account.account code (e.g. "500010") this category's products post revenue against
  fastify.patch('/categories/:id/odoo-income-account', {
    preHandler: [authenticate, authorize('update', 'product')],
  }, async (request) => {
    const { id } = request.params as { id: string }
    const { odooIncomeAccountCode } = request.body as { odooIncomeAccountCode?: string | null }
    return productService.updateCategoryOdooIncomeAccount(id, odooIncomeAccountCode ?? null)
  })

  // ── Products ──────────────────────────────────────────────────────────────

  // GET /products - public
  fastify.get('/', async (request) => {
    const query = request.query as { tier?: string }
    const tier = (query.tier as any) || 'RETAIL'
    return productService.getAll(tier)
  })

  // GET /products/admin - admin only, includes inactive
  fastify.get('/admin', {
    preHandler: [authenticate, authorize('create', 'product')],
  }, async () => {
    return productService.getAllAdmin()
  })

  // GET /products/:id - public
  fastify.get('/:id', async (request) => {
    const { id } = request.params as { id: string }
    return productService.getById(id)
  })

  // POST /products - admin only
  fastify.post('/', {
    preHandler: [authenticate, authorize('create', 'product')],
  }, async (request, reply) => {
    const product = await productService.create(request.body as any)
    return reply.code(201).send(product)
  })

  // PATCH /products/:id - admin only
  fastify.patch('/:id', {
    preHandler: [authenticate, authorize('update', 'product')],
  }, async (request) => {
    const { id } = request.params as { id: string }
    return productService.update(id, request.body as any)
  })

  // DELETE /products/:id/variants/:variantId - admin only
  fastify.delete('/:id/variants/:variantId', {
    preHandler: [authenticate, authorize('update', 'product')],
  }, async (request, reply) => {
    const { variantId } = request.params as { id: string; variantId: string }
    await productService.deleteVariant(variantId)
    return reply.code(204).send()
  })

  // POST /products/:id/variants - add a variant
  fastify.post('/:id/variants', {
    preHandler: [authenticate, authorize('update', 'product')],
  }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const variant = await productService.addVariant(id, request.body as any)
    return reply.code(201).send(variant)
  })

  // PATCH /products/:id/variants/:variantId/prices - update retail price
  fastify.patch('/:id/variants/:variantId/prices', {
    preHandler: [authenticate, authorize('update', 'product')],
  }, async (request) => {
    const { variantId } = request.params as { id: string; variantId: string }
    return productService.updateVariantPrice(variantId, request.body as any)
  })

  // PATCH /products/:id/variants/:variantId/odoo-mapping - set the Odoo default_code this variant maps to
  fastify.patch('/:id/variants/:variantId/odoo-mapping', {
    preHandler: [authenticate, authorize('update', 'product')],
  }, async (request) => {
    const { variantId } = request.params as { id: string; variantId: string }
    const { odooProductReference } = request.body as { odooProductReference?: string | null }
    return productService.updateVariantOdooMapping(variantId, { odooProductReference })
  })

  // POST /products/:id/variants/:variantId/odoo-sync/retry - admin manually (re)runs the Odoo product sync
  fastify.post('/:id/variants/:variantId/odoo-sync/retry', {
    preHandler: [authenticate, authorize('update', 'product')],
  }, async (request) => {
    const { variantId } = request.params as { id: string; variantId: string }
    try {
      await syncProductVariantToOdoo(fastify.prisma, variantId)
      return { ok: true }
    } catch (err: any) {
      return { ok: false, error: err?.message || 'Unknown Odoo sync error' }
    }
  })
}

export default productRoutes
