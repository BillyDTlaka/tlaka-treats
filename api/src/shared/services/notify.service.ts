import nodemailer from 'nodemailer'
import twilio from 'twilio'
import { config } from '../../config'
import { generateQuotePdf } from './pdf.service'

function fmt(n: number | null | undefined) {
  return `R${Number(n ?? 0).toFixed(2)}`
}

// ── EMAIL ──────────────────────────────────────────────────────────────────

function getTransporter() {
  if (!config.email.host || !config.email.user) {
    throw new Error('Email is not configured. Set SMTP_HOST, SMTP_USER, SMTP_PASS in environment variables.')
  }
  return nodemailer.createTransport({
    host:   config.email.host,
    port:   config.email.port,
    secure: config.email.secure,
    auth:   { user: config.email.user, pass: config.email.pass },
  })
}

export async function sendQuoteEmail(quote: any, to: string): Promise<void> {
  const transporter = getTransporter()
  const pdfBuffer = await generateQuotePdf(quote)

  const custName  = `${quote.customer?.firstName || ''} ${quote.customer?.lastName || ''}`.trim()
  const quoteNum  = quote.number || `#${quote.id.slice(-8).toUpperCase()}`
  const validStr  = quote.validUntil ? new Date(quote.validUntil).toLocaleDateString('en-ZA') : 'On request'

  const itemRows = (quote.items || []).map((i: any) => {
    const name = (i.variant?.product?.name || 'Item') + (i.variant?.name ? ` — ${i.variant.name}` : '')
    const up   = Number(i.unitPrice || 0)
    return `
      <tr>
        <td style="padding:8px 12px;border-bottom:1px solid #f3f4f6">${name}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #f3f4f6;text-align:center">${i.quantity}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #f3f4f6;text-align:right">${fmt(up)}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #f3f4f6;text-align:right;font-weight:bold">${fmt(up * i.quantity)}</td>
      </tr>`
  }).join('')

  const discountRow = Number(quote.discountAmount) > 0
    ? `<tr><td colspan="3" style="padding:6px 12px;text-align:right;color:#6b7280">Discount</td><td style="padding:6px 12px;text-align:right;color:#ef4444">−${fmt(quote.discountAmount)}</td></tr>`
    : ''

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f9fafb;font-family:Arial,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0">
    <tr><td align="center" style="padding:40px 20px">
      <table width="600" cellpadding="0" cellspacing="0" style="background:white;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08)">
        <!-- Header -->
        <tr><td style="background:#8B3A3A;padding:28px 32px">
          <table width="100%"><tr>
            <td><span style="color:white;font-size:22px;font-weight:bold">Tlaka Treats</span></td>
            <td align="right"><span style="color:rgba(255,255,255,0.7);font-size:12px">QUOTE</span><br><span style="color:white;font-size:20px;font-weight:bold">${quoteNum}</span></td>
          </tr></table>
        </td></tr>
        <!-- Greeting -->
        <tr><td style="padding:28px 32px 16px">
          <p style="margin:0 0 8px;color:#111827;font-size:16px">Hi ${custName || 'there'},</p>
          <p style="margin:0;color:#6b7280;font-size:14px;line-height:1.6">
            Please find your quote from Tlaka Treats attached as a PDF. A summary is below.
          </p>
        </td></tr>
        <!-- Meta -->
        <tr><td style="padding:0 32px 16px">
          <table width="100%" style="background:#f9fafb;border-radius:8px">
            <tr>
              <td style="padding:12px 16px"><span style="font-size:11px;color:#6b7280;text-transform:uppercase">Date</span><br><strong style="color:#111827">${new Date(quote.createdAt).toLocaleDateString('en-ZA')}</strong></td>
              <td style="padding:12px 16px"><span style="font-size:11px;color:#6b7280;text-transform:uppercase">Valid Until</span><br><strong style="color:#111827">${validStr}</strong></td>
              ${quote.ambassador ? `<td style="padding:12px 16px"><span style="font-size:11px;color:#6b7280;text-transform:uppercase">Ambassador Code</span><br><strong style="color:#8B3A3A">${quote.ambassador.code}</strong></td>` : ''}
            </tr>
          </table>
        </td></tr>
        <!-- Items table -->
        <tr><td style="padding:0 32px 16px">
          <table width="100%" style="border:1px solid #f3f4f6;border-radius:8px;border-collapse:collapse;overflow:hidden">
            <thead><tr style="background:#f9fafb">
              <th style="padding:10px 12px;text-align:left;font-size:11px;color:#6b7280;text-transform:uppercase">Description</th>
              <th style="padding:10px 12px;text-align:center;font-size:11px;color:#6b7280;text-transform:uppercase">Qty</th>
              <th style="padding:10px 12px;text-align:right;font-size:11px;color:#6b7280;text-transform:uppercase">Unit</th>
              <th style="padding:10px 12px;text-align:right;font-size:11px;color:#6b7280;text-transform:uppercase">Total</th>
            </tr></thead>
            <tbody>${itemRows}</tbody>
            <tfoot>
              <tr><td colspan="3" style="padding:8px 12px;text-align:right;color:#6b7280;font-size:13px">Subtotal</td><td style="padding:8px 12px;text-align:right;font-size:13px">${fmt(quote.subtotal)}</td></tr>
              <tr><td colspan="3" style="padding:4px 12px;text-align:right;color:#6b7280;font-size:13px">Delivery Fee</td><td style="padding:4px 12px;text-align:right;font-size:13px">${fmt(quote.deliveryFee)}</td></tr>
              ${discountRow}
              <tr style="border-top:2px solid #111827"><td colspan="3" style="padding:10px 12px;text-align:right;font-weight:bold;font-size:14px">TOTAL</td><td style="padding:10px 12px;text-align:right;font-weight:bold;font-size:18px;color:#8B3A3A">${fmt(quote.total)}</td></tr>
            </tfoot>
          </table>
        </td></tr>
        ${quote.notes ? `
        <tr><td style="padding:0 32px 16px">
          <div style="background:#fffbeb;border-radius:8px;padding:12px 16px;border-left:3px solid #f59e0b">
            <p style="margin:0 0 4px;font-size:11px;font-weight:bold;color:#92400e;text-transform:uppercase">Note</p>
            <p style="margin:0;font-size:13px;color:#78350f">${quote.notes}</p>
          </div>
        </td></tr>` : ''}
        <!-- CTA -->
        <tr><td style="padding:8px 32px 28px;text-align:center">
          <p style="margin:0 0 16px;font-size:13px;color:#6b7280">To accept this quote or ask any questions, please reply to this email.</p>
        </td></tr>
        <!-- Footer -->
        <tr><td style="background:#f9fafb;padding:20px 32px;text-align:center">
          <p style="margin:0;font-size:12px;color:#9ca3af">Tlaka Treats · hello@tlakatreats.co.za</p>
          <p style="margin:4px 0 0;font-size:11px;color:#d1d5db">Thank you for your business 🍰</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`

  await transporter.sendMail({
    from:    config.email.from,
    to,
    subject: `Your Quote from Tlaka Treats — ${quoteNum}`,
    html,
    attachments: [{
      filename:    `${quoteNum}.pdf`,
      content:     pdfBuffer,
      contentType: 'application/pdf',
    }],
  })
}

// ── WHATSAPP ───────────────────────────────────────────────────────────────

function buildWhatsAppBody(quote: any): string {
  const quoteNum = quote.number || `#${quote.id.slice(-8).toUpperCase()}`
  const custName = `${quote.customer?.firstName || ''} ${quote.customer?.lastName || ''}`.trim()
  const validStr = quote.validUntil ? new Date(quote.validUntil).toLocaleDateString('en-ZA') : 'On request'

  const lines = (quote.items || []).map((i: any) => {
    const name = (i.variant?.product?.name || 'Item') + (i.variant?.name ? ` — ${i.variant.name}` : '')
    return `  • ${i.quantity}× ${name}  ${fmt(Number(i.unitPrice) * i.quantity)}`
  }).join('\n')

  const discountLine = Number(quote.discountAmount) > 0
    ? `\n  Discount: −${fmt(quote.discountAmount)}`
    : ''

  return `🍰 *Tlaka Treats — Quote ${quoteNum}*

Hi ${custName || 'there'}! Here is your quote summary:

*Items:*
${lines}

━━━━━━━━━━━━━━━━
  Subtotal:     ${fmt(quote.subtotal)}
  Delivery:     ${fmt(quote.deliveryFee)}${discountLine}
  *TOTAL:       ${fmt(quote.total)}*
━━━━━━━━━━━━━━━━

📅 Valid until: ${validStr}
${quote.ambassador ? `🎟️ Ambassador: ${quote.ambassador.code}\n` : ''}
${quote.notes ? `📝 Note: ${quote.notes}\n` : ''}
To accept this quote or ask any questions, please reply to this message.

_Tlaka Treats · hello@tlakatreats.co.za_`
}

// ── ORDER NOTIFICATIONS ────────────────────────────────────────────────────

const ORDER_STATUS_CONFIG: Record<string, { emoji: string; headline: string; body: string; color: string }> = {
  PENDING:   { emoji: '📋', headline: 'We received your order!',          body: 'Thanks for ordering from Tlaka Treats. We\'re reviewing your order and will confirm it shortly.',                                color: '#F59E0B' },
  CONFIRMED: { emoji: '✅', headline: 'Your order is confirmed!',          body: 'Great news — your order has been confirmed and we\'re getting started on your treats.',                                           color: '#3B82F6' },
  BAKING:    { emoji: '🔥', headline: 'We\'re baking your treats!',        body: 'Your order is in the oven! Our team is preparing your treats fresh, with love.',                                                   color: '#8B5CF6' },
  READY:     { emoji: '🎁', headline: 'Your order is ready!',              body: 'Your treats are ready and waiting for you. We\'ll be in touch shortly about delivery or collection.',                             color: '#10B981' },
  DELIVERED: { emoji: '🚀', headline: 'Order delivered — enjoy!',          body: 'Your order has been delivered. We hope you and everyone you share with absolutely loves every bite. Thank you for choosing us!',   color: '#6B7280' },
  CANCELLED: { emoji: '✕',  headline: 'Your order has been cancelled.',    body: 'We\'re sorry — your order has been cancelled. If you have any questions please reply to this email.',                             color: '#EF4444' },
}

export async function sendOrderStatusEmail(order: any, to: string): Promise<void> {
  const transporter = getTransporter()
  const cfg = ORDER_STATUS_CONFIG[order.status]
  if (!cfg) return

  const custName = `${order.customer?.firstName || ''} ${order.customer?.lastName || ''}`.trim() || 'there'
  const orderRef = `#${order.id.slice(-8).toUpperCase()}`

  const itemRows = (order.items || []).map((i: any) => {
    const name = (i.variant?.product?.name || 'Item') + (i.variant?.name ? ` — ${i.variant.name}` : '')
    return `<tr>
      <td style="padding:8px 12px;border-bottom:1px solid #f3f4f6">${name}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #f3f4f6;text-align:center">${i.quantity}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #f3f4f6;text-align:right;font-weight:bold">${fmt(Number(i.unitPrice || 0) * i.quantity)}</td>
    </tr>`
  }).join('')

  const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f9fafb;font-family:Arial,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0">
    <tr><td align="center" style="padding:40px 20px">
      <table width="600" cellpadding="0" cellspacing="0" style="background:white;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08)">
        <tr><td style="background:#8B3A3A;padding:28px 32px">
          <table width="100%"><tr>
            <td><span style="color:white;font-size:22px;font-weight:bold">Tlaka Treats</span></td>
            <td align="right"><span style="color:rgba(255,255,255,0.7);font-size:12px">ORDER</span><br><span style="color:white;font-size:20px;font-weight:bold">${orderRef}</span></td>
          </tr></table>
        </td></tr>
        <tr><td style="padding:8px 32px 0">
          <div style="background:${cfg.color}15;border-left:4px solid ${cfg.color};border-radius:0 8px 8px 0;padding:16px 20px;margin-top:24px">
            <p style="margin:0;font-size:22px">${cfg.emoji} <strong style="color:#111827">${cfg.headline}</strong></p>
          </div>
        </td></tr>
        <tr><td style="padding:20px 32px">
          <p style="margin:0 0 8px;color:#111827;font-size:15px">Hi ${custName},</p>
          <p style="margin:0;color:#6b7280;font-size:14px;line-height:1.6">${cfg.body}</p>
        </td></tr>
        ${itemRows ? `
        <tr><td style="padding:0 32px 16px">
          <table width="100%" style="border:1px solid #f3f4f6;border-radius:8px;border-collapse:collapse">
            <thead><tr style="background:#f9fafb">
              <th style="padding:10px 12px;text-align:left;font-size:11px;color:#6b7280;text-transform:uppercase">Item</th>
              <th style="padding:10px 12px;text-align:center;font-size:11px;color:#6b7280;text-transform:uppercase">Qty</th>
              <th style="padding:10px 12px;text-align:right;font-size:11px;color:#6b7280;text-transform:uppercase">Total</th>
            </tr></thead>
            <tbody>${itemRows}</tbody>
            <tfoot>
              <tr style="border-top:2px solid #111827">
                <td colspan="2" style="padding:10px 12px;text-align:right;font-weight:bold">ORDER TOTAL</td>
                <td style="padding:10px 12px;text-align:right;font-weight:bold;font-size:18px;color:#8B3A3A">${fmt(order.total)}</td>
              </tr>
            </tfoot>
          </table>
        </td></tr>` : ''}
        ${order.notes ? `<tr><td style="padding:0 32px 16px"><div style="background:#fffbeb;border-radius:8px;padding:12px 16px;border-left:3px solid #f59e0b"><p style="margin:0 0 4px;font-size:11px;font-weight:bold;color:#92400e;text-transform:uppercase">Order Note</p><p style="margin:0;font-size:13px;color:#78350f">${order.notes}</p></div></td></tr>` : ''}
        <tr><td style="background:#f9fafb;padding:20px 32px;text-align:center">
          <p style="margin:0;font-size:12px;color:#9ca3af">Tlaka Treats · hello@tlakatreats.co.za</p>
          <p style="margin:4px 0 0;font-size:11px;color:#d1d5db">Thank you for your business 🍰</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`

  await transporter.sendMail({
    from:    config.email.from,
    to,
    subject: `${cfg.emoji} ${cfg.headline} — ${orderRef}`,
    html,
  })
}

export async function sendOrderStatusWhatsApp(order: any, to: string): Promise<void> {
  if (!config.twilio.accountSid || !config.twilio.authToken) {
    throw new Error('WhatsApp is not configured.')
  }

  const cfg = ORDER_STATUS_CONFIG[order.status]
  if (!cfg) return

  const custName = `${order.customer?.firstName || ''} ${order.customer?.lastName || ''}`.trim() || 'there'
  const orderRef = `#${order.id.slice(-8).toUpperCase()}`

  const itemLines = (order.items || []).map((i: any) => {
    const name = (i.variant?.product?.name || 'Item') + (i.variant?.name ? ` — ${i.variant.name}` : '')
    return `  • ${i.quantity}× ${name}  ${fmt(Number(i.unitPrice || 0) * i.quantity)}`
  }).join('\n')

  const body = `🍰 *Tlaka Treats — Order ${orderRef}*

Hi ${custName}!

${cfg.emoji} *${cfg.headline}*

${cfg.body}
${itemLines ? `\n*Your order:*\n${itemLines}\n\n  *TOTAL: ${fmt(order.total)}*` : ''}
${order.notes ? `\n📝 Note: ${order.notes}` : ''}

_Tlaka Treats · hello@tlakatreats.co.za_`

  const client = twilio(config.twilio.accountSid, config.twilio.authToken)
  const normalised = to.startsWith('whatsapp:') ? to : `whatsapp:${to.startsWith('+') ? to : '+' + to}`
  await client.messages.create({ from: config.twilio.whatsappFrom, to: normalised, body })
}

export async function sendLowStockAlertEmail(items: Array<{ name: string; currentStock: number; minStockLevel: number; uom?: string }>, adminEmail: string): Promise<void> {
  const transporter = getTransporter()

  const rows = items.map(i =>
    `<tr>
      <td style="padding:8px 12px;border-bottom:1px solid #f3f4f6">${i.name}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #f3f4f6;text-align:right;color:#ef4444;font-weight:bold">${Number(i.currentStock).toFixed(2)} ${i.uom || ''}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #f3f4f6;text-align:right">${Number(i.minStockLevel).toFixed(2)} ${i.uom || ''}</td>
    </tr>`
  ).join('')

  const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#f9fafb;font-family:Arial,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0">
    <tr><td align="center" style="padding:40px 20px">
      <table width="600" cellpadding="0" cellspacing="0" style="background:white;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08)">
        <tr><td style="background:#8B3A3A;padding:24px 32px"><span style="color:white;font-size:20px;font-weight:bold">Tlaka Treats — Low Stock Alert</span></td></tr>
        <tr><td style="padding:24px 32px">
          <p style="margin:0 0 16px;color:#111827;font-size:15px">⚠️ The following ${items.length} stock item${items.length !== 1 ? 's are' : ' is'} below the minimum stock level:</p>
          <table width="100%" style="border:1px solid #f3f4f6;border-radius:8px;border-collapse:collapse">
            <thead><tr style="background:#f9fafb">
              <th style="padding:10px 12px;text-align:left;font-size:11px;color:#6b7280;text-transform:uppercase">Item</th>
              <th style="padding:10px 12px;text-align:right;font-size:11px;color:#6b7280;text-transform:uppercase">Current</th>
              <th style="padding:10px 12px;text-align:right;font-size:11px;color:#6b7280;text-transform:uppercase">Minimum</th>
            </tr></thead>
            <tbody>${rows}</tbody>
          </table>
          <p style="margin:16px 0 0;color:#6b7280;font-size:13px">Please restock these items or create a purchase order.</p>
        </td></tr>
        <tr><td style="background:#f9fafb;padding:16px 32px;text-align:center"><p style="margin:0;font-size:12px;color:#9ca3af">Tlaka Treats · hello@tlakatreats.co.za</p></td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`

  await transporter.sendMail({
    from:    config.email.from,
    to:      adminEmail,
    subject: `⚠️ Low Stock Alert — ${items.length} item${items.length !== 1 ? 's' : ''} need restocking`,
    html,
  })
}

export async function sendQuoteWhatsApp(quote: any, to: string, pdfUrl?: string): Promise<void> {
  if (!config.twilio.accountSid || !config.twilio.authToken) {
    throw new Error('WhatsApp is not configured. Set TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN in environment variables.')
  }

  const client = twilio(config.twilio.accountSid, config.twilio.authToken)
  const body   = buildWhatsAppBody(quote)

  // Normalise the "to" number to WhatsApp format
  const normalised = to.startsWith('whatsapp:') ? to : `whatsapp:${to.startsWith('+') ? to : '+' + to}`

  const messageParams: any = {
    from: config.twilio.whatsappFrom,
    to:   normalised,
    body,
  }

  // Optionally attach the PDF as media (requires publicly accessible URL)
  if (pdfUrl) {
    messageParams.mediaUrl = [pdfUrl]
  }

  await client.messages.create(messageParams)
}
