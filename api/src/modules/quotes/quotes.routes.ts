import { FastifyPluginAsync } from 'fastify'
import { QuoteService } from './quotes.service'
import { authenticate, authorize } from '../../shared/middleware/auth'
import { generateQuotePdf } from '../../shared/services/pdf.service'
import { sendQuoteEmail, sendQuoteWhatsApp } from '../../shared/services/notify.service'
import { AppError } from '../../shared/errors'
import { config } from '../../config'

const quoteRoutes: FastifyPluginAsync = async (fastify) => {
  const svc = new QuoteService(fastify.prisma)

  // GET /quotes — admin: all quotes
  fastify.get('/', {
    preHandler: [authenticate, authorize('manage', 'order')],
  }, async () => svc.getAll())

  // GET /quotes/my — ambassador/user: own quotes
  fastify.get('/my', { preHandler: [authenticate] }, async (request) => {
    const user = request.user as { id: string }
    return svc.getMy(user.id)
  })

  // GET /quotes/:id
  fastify.get('/:id', { preHandler: [authenticate] }, async (request) => {
    const { id } = request.params as { id: string }
    return svc.getById(id)
  })

  // POST /quotes — create
  fastify.post('/', { preHandler: [authenticate] }, async (request, reply) => {
    const user = request.user as { id: string }
    const body = request.body as any
    const quote = await svc.create({ ...body, createdById: user.id })
    return reply.code(201).send(quote)
  })

  // PATCH /quotes/:id — update (DRAFT only)
  fastify.patch('/:id', { preHandler: [authenticate] }, async (request) => {
    const { id } = request.params as { id: string }
    return svc.update(id, request.body as any)
  })

  // PATCH /quotes/:id/status — change status
  fastify.patch('/:id/status', { preHandler: [authenticate] }, async (request) => {
    const { id } = request.params as { id: string }
    const { status } = request.body as { status: string }
    return svc.updateStatus(id, status)
  })

  // POST /quotes/:id/convert — convert to order
  fastify.post('/:id/convert', { preHandler: [authenticate] }, async (request) => {
    const { id } = request.params as { id: string }
    return svc.convert(id)
  })

  // DELETE /quotes/:id — delete DRAFT
  fastify.delete('/:id', { preHandler: [authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string }
    await svc.remove(id)
    return reply.code(204).send()
  })

  // GET /quotes/:id/pdf — download the quote as a PDF
  fastify.get('/:id/pdf', { preHandler: [authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const quote  = await svc.getById(id)
    const buffer = await generateQuotePdf(quote)
    const name   = `${quote.number || 'quote'}.pdf`
    return reply
      .header('Content-Type', 'application/pdf')
      .header('Content-Disposition', `attachment; filename="${name}"`)
      .send(buffer)
  })

  // POST /quotes/:id/send — send the quote via email or whatsapp
  fastify.post('/:id/send', { preHandler: [authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const { channel, to } = request.body as { channel: 'email' | 'whatsapp'; to?: string }

    if (!channel || !['email', 'whatsapp'].includes(channel)) {
      throw new AppError('channel must be "email" or "whatsapp"', 400)
    }

    const quote = await svc.getById(id)

    // Resolve recipient — fall back to customer's stored contact
    const recipient =
      to?.trim() ||
      (channel === 'email'     ? quote.customer?.email : quote.customer?.phone) ||
      ''

    if (!recipient) {
      throw new AppError(`No ${channel === 'email' ? 'email address' : 'phone number'} provided`, 400)
    }

    if (channel === 'email') {
      await sendQuoteEmail(quote, recipient)
    } else {
      // Build a public URL for the PDF so Twilio can attach it
      const pdfUrl = `${config.appUrl}/quotes/${id}/pdf`
      await sendQuoteWhatsApp(quote, recipient, pdfUrl)
    }

    // Auto-advance DRAFT → SENT on first send
    if (quote.status === 'DRAFT') {
      await svc.updateStatus(id, 'SENT')
    }

    return reply.send({ ok: true, channel, to: recipient })
  })
}

export default quoteRoutes
