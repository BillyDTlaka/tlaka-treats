import { FastifyPluginAsync } from 'fastify'
import { authenticate } from '../../shared/middleware/auth'
import { AppError } from '../../shared/errors'
import { streamChatReply } from './chat.service'

const chatRoutes: FastifyPluginAsync = async (fastify) => {
  const db = fastify.prisma as any

  // ── Conversations ──────────────────────────────────────────────────────────

  // POST /chat/conversations — create new conversation
  fastify.post('/conversations', { preHandler: [authenticate] }, async (req, reply) => {
    const conv = await db.chatConversation.create({ data: {} })
    return reply.code(201).send(conv)
  })

  // GET /chat/conversations — list
  fastify.get('/conversations', { preHandler: [authenticate] }, async () => {
    return db.chatConversation.findMany({
      orderBy: { updatedAt: 'desc' },
      take:    50,
      select:  { id: true, title: true, createdAt: true, updatedAt: true },
    })
  })

  // GET /chat/conversations/:id — get with messages
  fastify.get('/conversations/:id', { preHandler: [authenticate] }, async (req) => {
    const { id } = req.params as { id: string }
    const conv = await db.chatConversation.findUnique({
      where:   { id },
      include: { messages: { orderBy: { createdAt: 'asc' } } },
    })
    if (!conv) throw new AppError('Conversation not found', 404, 'NOT_FOUND')
    return conv
  })

  // PATCH /chat/conversations/:id — rename
  fastify.patch('/conversations/:id', { preHandler: [authenticate] }, async (req) => {
    const { id } = req.params as { id: string }
    const { title } = req.body as { title: string }
    return db.chatConversation.update({ where: { id }, data: { title } })
  })

  // DELETE /chat/conversations/:id
  fastify.delete('/conversations/:id', { preHandler: [authenticate] }, async (req, reply) => {
    const { id } = req.params as { id: string }
    await db.chatConversation.delete({ where: { id } })
    return reply.code(204).send()
  })

  // ── Streaming message ──────────────────────────────────────────────────────

  // POST /chat/conversations/:id/message — send message, stream reply via SSE
  fastify.post('/conversations/:id/message', { preHandler: [authenticate] }, async (req, reply) => {
    const { id } = req.params as { id: string }
    const { content } = req.body as { content: string }

    if (!content?.trim()) throw new AppError('Message content is required', 400, 'INVALID_BODY')

    const conv = await db.chatConversation.findUnique({ where: { id } })
    if (!conv) throw new AppError('Conversation not found', 404, 'NOT_FOUND')

    // Save user message
    await db.chatMessage.create({ data: { conversationId: id, role: 'user', content: content.trim() } })

    // Update conversation title if first message
    if (conv.title === 'New Chat') {
      const title = content.trim().slice(0, 60) + (content.trim().length > 60 ? '…' : '')
      await db.chatConversation.update({ where: { id }, data: { title, updatedAt: new Date() } })
    } else {
      await db.chatConversation.update({ where: { id }, data: { updatedAt: new Date() } })
    }

    // Hijack reply and stream SSE
    reply.hijack()
    const res = reply.raw
    res.writeHead(200, {
      'Content-Type':  'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection':    'keep-alive',
      'X-Accel-Buffering': 'no',
    })

    try {
      let fullText = ''
      fullText = await streamChatReply(db, id, content.trim(), (chunk) => {
        res.write(`data: ${JSON.stringify({ text: chunk })}\n\n`)
      })

      // Save assistant message
      await db.chatMessage.create({ data: { conversationId: id, role: 'assistant', content: fullText } })

      res.write('data: [DONE]\n\n')
    } catch (err: any) {
      fastify.log.error({ err }, '[chat] stream error')
      res.write(`data: ${JSON.stringify({ error: err?.message || 'Stream failed' })}\n\n`)
    } finally {
      res.end()
    }
  })

  // ── Knowledge Documents ────────────────────────────────────────────────────

  // GET /chat/documents
  fastify.get('/documents', { preHandler: [authenticate] }, async () => {
    return db.knowledgeDocument.findMany({
      orderBy: { createdAt: 'desc' },
      select:  { id: true, name: true, description: true, fileType: true, createdAt: true },
    })
  })

  // GET /chat/documents/:id
  fastify.get('/documents/:id', { preHandler: [authenticate] }, async (req) => {
    const { id } = req.params as { id: string }
    const doc = await db.knowledgeDocument.findUnique({ where: { id } })
    if (!doc) throw new AppError('Document not found', 404, 'NOT_FOUND')
    return doc
  })

  // POST /chat/documents — create document
  fastify.post('/documents', { preHandler: [authenticate] }, async (req, reply) => {
    const { name, description, content, fileType } = req.body as {
      name: string; description?: string; content: string; fileType?: string
    }
    if (!name?.trim())    throw new AppError('Name is required', 400, 'INVALID_BODY')
    if (!content?.trim()) throw new AppError('Content is required', 400, 'INVALID_BODY')
    const doc = await db.knowledgeDocument.create({
      data: { name: name.trim(), description: description?.trim(), content: content.trim(), fileType: fileType || 'text' },
    })
    return reply.code(201).send(doc)
  })

  // PATCH /chat/documents/:id
  fastify.patch('/documents/:id', { preHandler: [authenticate] }, async (req) => {
    const { id } = req.params as { id: string }
    const body = req.body as any
    return db.knowledgeDocument.update({
      where: { id },
      data:  {
        ...(body.name        ? { name:        body.name.trim()        } : {}),
        ...(body.description !== undefined ? { description: body.description } : {}),
        ...(body.content     ? { content:     body.content.trim()     } : {}),
      },
    })
  })

  // DELETE /chat/documents/:id
  fastify.delete('/documents/:id', { preHandler: [authenticate] }, async (req, reply) => {
    const { id } = req.params as { id: string }
    await db.knowledgeDocument.delete({ where: { id } })
    return reply.code(204).send()
  })
}

export default chatRoutes
