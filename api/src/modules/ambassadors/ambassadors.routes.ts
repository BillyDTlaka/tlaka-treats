import { FastifyPluginAsync } from 'fastify'
import { authenticate, authorize } from '../../shared/middleware/auth'
import { AppError } from '../../shared/errors'

// NOTE: kycStatus / kycData / kycNote are new schema fields added in the latest
// migration. Until `prisma db push --schema=src/prisma/schema.prisma` is run
// the generated Prisma client will not include these fields, so we cast data
// objects to `any` so TypeScript compiles without errors on both old and new DB.

const ambassadorRoutes: FastifyPluginAsync = async (fastify) => {

  // ── Helper: assign AMBASSADOR role to a user ──────────────────────────────
  async function grantAmbassadorRole(userId: string) {
    const role = await fastify.prisma.role.findUnique({ where: { name: 'AMBASSADOR' } })
    if (role) {
      await fastify.prisma.userRole.upsert({
        where: { userId_roleId: { userId, roleId: role.id } },
        update: {},
        create: { userId, roleId: role.id },
      })
    }
  }

  // ── Helper: generate unique referral code ─────────────────────────────────
  async function generateCode(firstName: string): Promise<string> {
    const base = `TT-${firstName.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 4).padEnd(4, 'X')}`
    let code = ''
    for (let i = 0; i < 10; i++) {
      code = `${base}${Math.floor(Math.random() * 9000 + 1000)}`
      const existing = await fastify.prisma.ambassador.findUnique({ where: { code } })
      if (!existing) return code
    }
    return code
  }

  // ── POST /ambassadors/apply ───────────────────────────────────────────────
  // Any logged-in user can apply — creates a PENDING ambassador record
  fastify.post('/apply', { preHandler: [authenticate] }, async (request, reply) => {
    const user = request.user as { id: string }
    const { bio } = request.body as { bio?: string }

    const existing = await fastify.prisma.ambassador.findUnique({ where: { userId: user.id } })
    if (existing) throw new AppError('You have already applied to be an ambassador', 409)

    const dbUser = await fastify.prisma.user.findUnique({ where: { id: user.id } })
    if (!dbUser) throw new AppError('User not found', 404)

    const code = await generateCode(dbUser.firstName)
    const ambassador = await fastify.prisma.ambassador.create({
      data: { userId: user.id, code, bio, status: 'PENDING' } as any,
    })

    return reply.code(201).send(ambassador)
  })

  // ── POST /ambassadors/admin/create ────────────────────────────────────────
  // Admin manually adds an ambassador for an existing user (immediately ACTIVE)
  fastify.post('/admin/create', {
    preHandler: [authenticate, authorize('manage', 'ambassador')],
  }, async (request, reply) => {
    const { userId, email, commissionRate, bio, code: customCode } = request.body as any

    let dbUser: any
    if (userId) {
      dbUser = await fastify.prisma.user.findUnique({ where: { id: userId } })
    } else if (email) {
      dbUser = await fastify.prisma.user.findUnique({ where: { email } })
    }
    if (!dbUser) throw new AppError('User not found — check the email or user ID', 404)

    const existing = await fastify.prisma.ambassador.findUnique({ where: { userId: dbUser.id } })
    if (existing) throw new AppError('This user is already an ambassador', 409)

    const code = customCode || (await generateCode(dbUser.firstName))

    const ambassador = await fastify.prisma.ambassador.create({
      data: {
        userId: dbUser.id,
        code,
        commissionRate: commissionRate ?? 0.10,
        bio,
        status: 'ACTIVE',
        kycStatus: 'APPROVED',
        kycNote: 'Added directly by admin — KYC waived.',
      } as any,
      include: {
        user: { select: { id: true, email: true, phone: true, firstName: true, lastName: true } },
      },
    })

    await grantAmbassadorRole(dbUser.id)
    return reply.code(201).send(ambassador)
  })

  // ── GET /ambassadors/active ───────────────────────────────────────────────
  // Any authenticated user: list active ambassadors (for checkout picker)
  fastify.get('/active', { preHandler: [authenticate] }, async () => {
    return fastify.prisma.ambassador.findMany({
      where: { status: 'ACTIVE' },
      select: {
        id: true,
        code: true,
        user: { select: { firstName: true, lastName: true } },
      },
      orderBy: { createdAt: 'desc' },
    })
  })

  // ── GET /ambassadors ──────────────────────────────────────────────────────
  // Admin: list all ambassadors with earnings summary
  fastify.get('/', {
    preHandler: [authenticate, authorize('manage', 'ambassador')],
  }, async () => {
    return fastify.prisma.ambassador.findMany({
      include: {
        user: {
          select: { id: true, email: true, phone: true, firstName: true, lastName: true, status: true, createdAt: true },
        },
        _count: { select: { orders: true, commissions: true } },
        commissions: { select: { amount: true, status: true } },
      },
      orderBy: { createdAt: 'desc' },
    })
  })

  // ── GET /ambassadors/me ───────────────────────────────────────────────────
  // Ambassador views own profile, KYC status, and recent commissions
  fastify.get('/me', { preHandler: [authenticate] }, async (request) => {
    const user = request.user as { id: string }
    const ambassador = await fastify.prisma.ambassador.findUnique({
      where: { userId: user.id },
      include: {
        commissions: { orderBy: { createdAt: 'desc' }, take: 10 },
        _count: { select: { orders: true, commissions: true } },
      },
    })
    if (!ambassador) throw new AppError('Not an ambassador', 404)
    return ambassador
  })

  // ── GET /ambassadors/me/earnings ─────────────────────────────────────────
  // Ambassador: full commission + payout history with summary
  fastify.get('/me/earnings', { preHandler: [authenticate] }, async (request) => {
    const user = request.user as { id: string }
    const ambassador = await fastify.prisma.ambassador.findUnique({
      where: { userId: user.id },
      include: {
        commissions: {
          orderBy: { createdAt: 'desc' },
          include: {
            order: { select: { id: true, createdAt: true, total: true } },
            payout: { select: { id: true, createdAt: true, reference: true } },
          },
        },
        payouts: { orderBy: { createdAt: 'desc' } },
      },
    })
    if (!ambassador) throw new AppError('Not an ambassador', 404)

    const commissions = ambassador.commissions
    const totalEarned   = commissions.reduce((s, c) => s + Number(c.amount), 0)
    const totalPaid     = commissions.filter(c => c.status === 'PAID').reduce((s, c) => s + Number(c.amount), 0)
    const totalPending  = commissions.filter(c => c.status === 'PENDING').reduce((s, c) => s + Number(c.amount), 0)
    const pendingCount  = commissions.filter(c => c.status === 'PENDING').length

    return {
      commissionRate: ambassador.commissionRate,
      summary: { totalEarned, totalPaid, totalPending, pendingCount },
      commissions: ambassador.commissions,
      payouts: ambassador.payouts,
    }
  })

  // ── POST /ambassadors/me/payout-request ───────────────────────────────────
  // Ambassador: request withdrawal of all pending commissions
  fastify.post('/me/payout-request', { preHandler: [authenticate] }, async (request, reply) => {
    const user = request.user as { id: string }
    const { method = 'bank_transfer', notes } = request.body as { method?: string; notes?: string }

    const ambassador = await fastify.prisma.ambassador.findUnique({ where: { userId: user.id } })
    if (!ambassador) throw new AppError('Not an ambassador', 404)
    if (ambassador.status !== 'ACTIVE') throw new AppError('Your ambassador account must be active to request a payout', 403)

    const pendingCommissions = await fastify.prisma.commission.findMany({
      where: { ambassadorId: ambassador.id, status: 'PENDING' },
    })
    if (!pendingCommissions.length) throw new AppError('No pending earnings to withdraw', 400)

    const total = pendingCommissions.reduce((s, c) => s + Number(c.amount), 0)
    if (total < 50) throw new AppError(`Minimum payout is R50.00. Your balance is R${total.toFixed(2)}`, 400)

    const payout = await fastify.prisma.payout.create({
      data: {
        ambassadorId: ambassador.id,
        amount: total,
        method,
        notes: notes || null,
        status: 'PENDING',
        commissions: { connect: pendingCommissions.map(c => ({ id: c.id })) },
      },
    })

    return reply.code(201).send({ payout, total, commissionCount: pendingCommissions.length })
  })

  // ── PATCH /ambassadors/:id/status ─────────────────────────────────────────
  // Admin: ACTIVE / PENDING / SUSPENDED
  fastify.patch('/:id/status', {
    preHandler: [authenticate, authorize('manage', 'ambassador')],
  }, async (request) => {
    const { id } = request.params as { id: string }
    const { status, note } = request.body as { status: any; note?: string }

    const ambassador = await fastify.prisma.ambassador.update({
      where: { id },
      data: {
        status,
        ...(note ? { kycNote: note } : {}),
      } as any,
      include: {
        user: { select: { id: true, email: true, phone: true, firstName: true, lastName: true } },
      },
    })

    if (status === 'ACTIVE') await grantAmbassadorRole(ambassador.userId)
    return ambassador
  })

  // ── PATCH /ambassadors/:id/kyc ────────────────────────────────────────────
  // Ambassador submits KYC documents (phone, address, ID, certified document)
  fastify.patch('/:id/kyc', { preHandler: [authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const reqUser = request.user as { id: string }

    const ambassador = await fastify.prisma.ambassador.findUnique({ where: { id } }) as any
    if (!ambassador) throw new AppError('Ambassador not found', 404)
    if (ambassador.userId !== reqUser.id) throw new AppError('Not authorised', 403)
    if (ambassador.kycStatus === 'APPROVED') throw new AppError('KYC is already approved', 400)

    const { phone, address, idType, idNumber, idDocumentUrl } = request.body as any
    if (!idType || !idNumber || !idDocumentUrl) {
      throw new AppError('ID type, ID number, and ID document are required', 400)
    }

    const updated = await fastify.prisma.ambassador.update({
      where: { id },
      data: {
        kycStatus: 'SUBMITTED',
        kycNote: null,
        kycData: {
          phone,
          address,
          idType,
          idNumber,
          idDocumentUrl,
          submittedAt: new Date().toISOString(),
        },
      } as any,
    })

    return reply.code(200).send(updated)
  })

  // ── PATCH /ambassadors/:id/kyc/review ─────────────────────────────────────
  // Admin: APPROVED or REJECTED with a note
  fastify.patch('/:id/kyc/review', {
    preHandler: [authenticate, authorize('manage', 'ambassador')],
  }, async (request) => {
    const { id } = request.params as { id: string }
    const { kycStatus, kycNote } = request.body as { kycStatus: string; kycNote?: string }

    if (!['APPROVED', 'REJECTED'].includes(kycStatus)) {
      throw new AppError('kycStatus must be APPROVED or REJECTED', 400)
    }
    if (kycStatus === 'REJECTED' && !kycNote?.trim()) {
      throw new AppError('A reason is required when rejecting KYC', 400)
    }

    const updated = await fastify.prisma.ambassador.update({
      where: { id },
      data: { kycStatus, kycNote: kycNote || null } as any,
      include: {
        user: { select: { id: true, email: true, phone: true, firstName: true, lastName: true } },
      },
    })

    return updated
  })

  // ── PATCH /ambassadors/:id ────────────────────────────────────────────────
  // Admin: update commission rate, referral code, or bio
  fastify.patch('/:id', {
    preHandler: [authenticate, authorize('manage', 'ambassador')],
  }, async (request) => {
    const { id } = request.params as { id: string }
    const { commissionRate, code, bio } = request.body as any

    if (code) {
      const conflict = await fastify.prisma.ambassador.findFirst({ where: { code, NOT: { id } } })
      if (conflict) throw new AppError('That referral code is already in use', 409)
    }

    const updated = await fastify.prisma.ambassador.update({
      where: { id },
      data: {
        ...(commissionRate !== undefined ? { commissionRate } : {}),
        ...(code            !== undefined ? { code }           : {}),
        ...(bio             !== undefined ? { bio }            : {}),
      },
      include: {
        user: { select: { id: true, email: true, phone: true, firstName: true, lastName: true } },
      },
    })

    return updated
  })
}

export default ambassadorRoutes
