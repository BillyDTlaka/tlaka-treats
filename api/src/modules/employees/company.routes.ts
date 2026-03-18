import { FastifyPluginAsync } from 'fastify'
import { authenticate, authorize } from '../../shared/middleware/auth'

const companyRoutes: FastifyPluginAsync = async (fastify) => {
  const db = fastify.prisma as any
  const auth = [authenticate, authorize('manage', 'employee')]

  // GET /company — get (or seed) company record
  fastify.get('/', { preHandler: [authenticate] }, async () => {
    let company = await db.company.findFirst()
    if (!company) company = await db.company.create({ data: { name: 'Tlaka Treats' } })
    return company
  })

  // PATCH /company — update company info
  fastify.patch('/', { preHandler: auth }, async (req) => {
    let company = await db.company.findFirst()
    if (!company) company = await db.company.create({ data: { name: 'Tlaka Treats' } })
    const body = req.body as any
    return db.company.update({
      where: { id: company.id },
      data: {
        name:           body.name           || company.name,
        tradingName:    body.tradingName    ?? company.tradingName,
        registrationNo: body.registrationNo ?? company.registrationNo,
        vatNo:          body.vatNo          ?? company.vatNo,
        address:        body.address        ?? company.address,
        city:           body.city           ?? company.city,
        province:       body.province       ?? company.province,
        postalCode:     body.postalCode     ?? company.postalCode,
        phone:          body.phone          ?? company.phone,
        email:          body.email          ?? company.email,
        website:        body.website        ?? company.website,
      },
    })
  })
}

export default companyRoutes
