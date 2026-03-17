import { FastifyPluginAsync } from 'fastify'
import { authenticate } from '../../shared/middleware/auth'
import { AppError } from '../../shared/errors'
import { runLeadSearch, generateOutreach } from './leads.service'

const leadsRoutes: FastifyPluginAsync = async (fastify) => {
  const db = fastify.prisma as any

  // GET /leads
  fastify.get('/', { preHandler: [authenticate] }, async (req) => {
    const { status, eventType, leadType } = req.query as any
    return db.lead.findMany({
      where: {
        ...(status    ? { status }    : {}),
        ...(eventType ? { eventType } : {}),
        ...(leadType  ? { leadType }  : {}),
      },
      orderBy: { createdAt: 'desc' },
    })
  })

  // POST /leads — manual add
  fastify.post('/', { preHandler: [authenticate] }, async (req, reply) => {
    const body = req.body as any
    const lead = await db.lead.create({
      data: {
        name:        body.name        || null,
        contact:     body.contact     || null,
        sourceName:  body.sourceName  || null,
        sourceUrl:   body.sourceUrl   || null,
        leadType:    body.leadType    || 'GENERAL',
        eventType:   body.eventType   || null,
        eventDate:   body.eventDate   ? new Date(body.eventDate) : null,
        location:    body.location    || null,
        description: body.description || null,
        status:      'NEW',
        notes:       body.notes       || null,
      },
    })
    return reply.code(201).send(lead)
  })

  // PATCH /leads/:id
  fastify.patch('/:id', { preHandler: [authenticate] }, async (req) => {
    const { id } = req.params as { id: string }
    const body = req.body as any
    return db.lead.update({
      where: { id },
      data: {
        ...(body.name        !== undefined ? { name:        body.name }                      : {}),
        ...(body.contact     !== undefined ? { contact:     body.contact }                  : {}),
        ...(body.status      !== undefined ? { status:      body.status }                   : {}),
        ...(body.notes       !== undefined ? { notes:       body.notes }                    : {}),
        ...(body.outreach    !== undefined ? { outreach:    body.outreach }                 : {}),
        ...(body.eventType   !== undefined ? { eventType:   body.eventType }                : {}),
        ...(body.eventDate   !== undefined ? { eventDate:   body.eventDate ? new Date(body.eventDate) : null } : {}),
        ...(body.location    !== undefined ? { location:    body.location }                 : {}),
        ...(body.description !== undefined ? { description: body.description }              : {}),
        ...(body.leadType    !== undefined ? { leadType:    body.leadType }                 : {}),
      },
    })
  })

  // DELETE /leads/:id
  fastify.delete('/:id', { preHandler: [authenticate] }, async (req, reply) => {
    const { id } = req.params as { id: string }
    await db.lead.delete({ where: { id } })
    return reply.code(204).send()
  })

  // POST /leads/search — trigger AI lead search
  fastify.post('/search', { preHandler: [authenticate] }, async (req, reply) => {
    const { area, eventTypes = [], keywords = [] } = req.body as {
      area: string
      eventTypes?: string[]
      keywords?: string[]
    }
    if (!area?.trim()) throw new AppError('area is required', 400, 'INVALID_BODY')
    const result = await runLeadSearch(db, area.trim(), eventTypes, keywords)
    return reply.send(result)
  })

  // POST /leads/:id/outreach — generate AI outreach message
  fastify.post('/:id/outreach', { preHandler: [authenticate] }, async (req) => {
    const { id } = req.params as { id: string }
    const lead = await db.lead.findUnique({ where: { id } })
    if (!lead) throw new AppError('Lead not found', 404, 'NOT_FOUND')
    const outreach = await generateOutreach(lead)
    await db.lead.update({ where: { id }, data: { outreach } })
    return { outreach }
  })

  // GET /leads/stats
  fastify.get('/stats', { preHandler: [authenticate] }, async () => {
    const [total, byStatus] = await Promise.all([
      db.lead.count(),
      db.lead.groupBy({ by: ['status'], _count: { _all: true } }),
    ])
    return {
      total,
      byStatus: Object.fromEntries(byStatus.map((s: any) => [s.status, s._count._all])),
    }
  })
}

export default leadsRoutes
