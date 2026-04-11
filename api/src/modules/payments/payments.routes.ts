import { FastifyPluginAsync } from 'fastify'
import crypto from 'crypto'
import { authenticate } from '../../shared/middleware/auth'
import { AppError } from '../../shared/errors'

// ── PayFast helpers ────────────────────────────────────────────────────────────

function buildPayFastSignature(params: Record<string, string>, passphrase?: string): string {
  // Sort keys alphabetically, build query string
  const sorted = Object.keys(params)
    .sort()
    .filter((k) => params[k] !== '' && params[k] !== undefined)
    .map((k) => `${k}=${encodeURIComponent(params[k]).replace(/%20/g, '+')}`)
    .join('&')

  const str = passphrase
    ? `${sorted}&passphrase=${encodeURIComponent(passphrase).replace(/%20/g, '+')}`
    : sorted

  return crypto.createHash('md5').update(str).digest('hex')
}

function getEftDetails() {
  return {
    bankName:      process.env.EFT_BANK_NAME      ?? 'Standard Bank',
    accountName:   process.env.EFT_ACCOUNT_NAME   ?? 'Tlaka Treats (Pty) Ltd',
    accountNumber: process.env.EFT_ACCOUNT_NUMBER ?? '0000000000',
    branchCode:    process.env.EFT_BRANCH_CODE    ?? '051001',
    accountType:   process.env.EFT_ACCOUNT_TYPE   ?? 'Current Account',
  }
}

const paymentsRoutes: FastifyPluginAsync = async (fastify) => {

  // ── GET /payments/eft-details ──────────────────────────────────────────────
  // Returns the bank details ambassadors show to customers for EFT payments
  fastify.get('/eft-details', { preHandler: [authenticate] }, async () => {
    return getEftDetails()
  })

  // ── POST /payments/payfast/initiate ────────────────────────────────────────
  // Ambassador initiates a PayFast payment for an existing order
  fastify.post('/payfast/initiate', { preHandler: [authenticate] }, async (request) => {
    const { orderId } = request.body as { orderId: string }
    if (!orderId) throw new AppError('orderId is required', 400)

    const order = await fastify.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        customer: { select: { firstName: true, lastName: true, email: true, phone: true } },
      },
    }) as any
    if (!order) throw new AppError('Order not found', 404)

    const merchantId  = process.env.PAYFAST_MERCHANT_ID  ?? '10000100'
    const merchantKey = process.env.PAYFAST_MERCHANT_KEY ?? '46f0cd694581a'
    const passphrase  = process.env.PAYFAST_PASSPHRASE   ?? ''
    const isSandbox   = process.env.PAYFAST_SANDBOX !== 'false'
    const apiBase     = process.env.RAILWAY_PUBLIC_DOMAIN
      ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}`
      : (process.env.API_URL ?? 'http://localhost:3000')

    const orderRef = `TT-${orderId.slice(-8).toUpperCase()}`
    const amount   = Number(order.total).toFixed(2)

    const params: Record<string, string> = {
      merchant_id:    merchantId,
      merchant_key:   merchantKey,
      return_url:     `${apiBase}/payments/result?status=success&orderId=${orderId}`,
      cancel_url:     `${apiBase}/payments/result?status=cancel&orderId=${orderId}`,
      notify_url:     `${apiBase}/payments/payfast/notify`,
      name_first:     order.customer?.firstName ?? 'Customer',
      name_last:      order.customer?.lastName  ?? '',
      email_address:  order.customer?.email     ?? `guest@tlakatreats.co.za`,
      m_payment_id:   orderId,
      amount,
      item_name:      `Tlaka Treats – ${orderRef}`,
      item_description: `Order ${orderRef}`,
    }

    if (order.customer?.phone) params.cell_number = order.customer.phone.replace(/\D/g, '')

    params.signature = buildPayFastSignature(params, passphrase || undefined)

    const baseUrl = isSandbox
      ? 'https://sandbox.payfast.co.za/eng/process'
      : 'https://www.payfast.co.za/eng/process'

    const query = Object.entries(params)
      .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
      .join('&')

    const paymentUrl = `${baseUrl}?${query}`

    // Mark order as CARD payment pending
    await (fastify.prisma as any).order.update({
      where: { id: orderId },
      data: { paymentMethod: 'CARD', paymentStatus: 'PENDING' },
    })

    return { paymentUrl, orderRef, amount }
  })

  // ── POST /payments/payfast/notify ─────────────────────────────────────────
  // PayFast ITN webhook — NO authentication (PayFast calls this directly)
  fastify.post('/payfast/notify', async (request, reply) => {
    const data = request.body as Record<string, string>

    const orderId      = data.m_payment_id
    const paymentId    = data.pf_payment_id
    const paymentStatus = data.payment_status  // 'COMPLETE' | 'FAILED' | 'CANCELLED'

    if (!orderId) return reply.code(200).send('OK')

    try {
      if (paymentStatus === 'COMPLETE') {
        await (fastify.prisma as any).order.update({
          where: { id: orderId },
          data: {
            paymentStatus: 'PAID',
            payfastId: paymentId ?? null,
            paidAt: new Date(),
            paymentRef: paymentId ?? null,
          },
        })
      } else {
        await (fastify.prisma as any).order.update({
          where: { id: orderId },
          data: { paymentStatus: 'FAILED', payfastId: paymentId ?? null },
        })
      }
    } catch {
      // Don't let DB errors cause a non-200 — PayFast will retry
    }

    return reply.code(200).send('OK')
  })

  // ── GET /payment/result ────────────────────────────────────────────────────
  // Simple browser page shown after PayFast redirects back
  fastify.get('/result', async (request, reply) => {
    const { status, orderId } = request.query as { status: string; orderId: string }
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8">
      <meta name="viewport" content="width=device-width,initial-scale=1">
      <title>Payment ${status === 'success' ? 'Successful' : 'Cancelled'}</title>
      <style>body{font-family:sans-serif;text-align:center;padding:40px;background:#FDF6F0}
      h1{color:#8B3A3A}p{color:#555}a{color:#8B3A3A}</style></head>
      <body>
        ${status === 'success'
          ? `<h1>✅ Payment Successful</h1><p>Your order has been paid. You can close this window and return to the app.</p>`
          : `<h1>❌ Payment Cancelled</h1><p>Your order was not completed. You can close this window and try again.</p>`
        }
        <p style="font-size:12px;color:#aaa">Order ref: TT-${(orderId ?? '').slice(-8).toUpperCase()}</p>
      </body></html>`
    return reply.type('text/html').send(html)
  })
}

export default paymentsRoutes
