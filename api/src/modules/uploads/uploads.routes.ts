import { FastifyPluginAsync } from 'fastify'
import { pipeline } from 'stream/promises'
import fs from 'fs'
import path from 'path'
import crypto from 'crypto'
import { authenticate } from '../../shared/middleware/auth'

const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(process.cwd(), 'uploads', 'kyc')
const BASE_URL   = process.env.BASE_URL  || 'http://localhost:3000'

const uploadsRoutes: FastifyPluginAsync = async (fastify) => {

  // Ensure upload directory exists
  if (!fs.existsSync(UPLOAD_DIR)) {
    fs.mkdirSync(UPLOAD_DIR, { recursive: true })
  }

  // ── POST /uploads/kyc ─────────────────────────────────────────────────────
  // Authenticated user uploads a KYC document (image or PDF).
  // Returns: { url } — absolute URL the client stores in kycData.idDocumentUrl
  fastify.post('/kyc', { preHandler: [authenticate] }, async (request, reply) => {
    const data = await (request as any).file()
    if (!data) {
      return reply.code(400).send({ error: 'NO_FILE', message: 'No file provided' })
    }

    // Validate mime type — only images and PDFs
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
    if (!allowed.includes(data.mimetype)) {
      // Drain the stream to avoid leaking
      data.file.resume()
      return reply.code(400).send({ error: 'INVALID_TYPE', message: 'Only JPG, PNG, WEBP, or PDF files are accepted' })
    }

    // Build a safe, unique filename
    const ext  = data.mimetype === 'application/pdf' ? '.pdf'
               : data.mimetype === 'image/webp'       ? '.webp'
               : data.mimetype === 'image/png'        ? '.png'
               : '.jpg'
    const rand = crypto.randomBytes(16).toString('hex')
    const filename = `${rand}${ext}`
    const dest     = path.join(UPLOAD_DIR, filename)

    try {
      await pipeline(data.file, fs.createWriteStream(dest))
    } catch (err) {
      fastify.log.error(err, 'KYC upload write failed')
      return reply.code(500).send({ error: 'UPLOAD_FAILED', message: 'Failed to save file' })
    }

    const url = `${BASE_URL}/uploads/kyc/${filename}`
    return reply.code(201).send({ url, filename, mimetype: data.mimetype })
  })
}

export default uploadsRoutes
