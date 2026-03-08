import PDFDocument from 'pdfkit'

// Brand colours
const BRAND   = '#8B3A3A'
const DARK    = '#111827'
const MUTED   = '#6B7280'
const LIGHT   = '#F9FAFB'
const BORDER  = '#E5E7EB'

function fmt(n: number | null | undefined) {
  return `R${Number(n ?? 0).toFixed(2)}`
}

export async function generateQuotePdf(quote: any): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    const doc = new PDFDocument({ size: 'A4', margin: 50 })

    doc.on('data', (c: Buffer) => chunks.push(c))
    doc.on('end', () => resolve(Buffer.concat(chunks)))
    doc.on('error', reject)

    const pageW = doc.page.width - 100 // usable width (margins 50 each side)

    // ─── HEADER ────────────────────────────────────────────────────────
    doc
      .rect(0, 0, doc.page.width, 110)
      .fill(BRAND)

    doc.fillColor('white')
      .font('Helvetica-Bold')
      .fontSize(26)
      .text('Tlaka Treats', 50, 30)

    doc.font('Helvetica')
      .fontSize(11)
      .fillColor('rgba(255,255,255,0.8)')
      .text('hello@tlakatreats.co.za', 50, 62)

    // QUOTE badge top-right
    doc.fillColor('white')
      .font('Helvetica-Bold')
      .fontSize(13)
      .text('QUOTE', doc.page.width - 130, 30, { width: 80, align: 'right' })

    doc.font('Helvetica')
      .fontSize(20)
      .text(quote.number || `#${quote.id.slice(-8).toUpperCase()}`, doc.page.width - 200, 52, { width: 150, align: 'right' })

    doc.moveDown(0)
    doc.y = 130

    // ─── META ROW ──────────────────────────────────────────────────────
    const metaY = doc.y
    const col = pageW / 3

    ;[
      { label: 'Date',        value: new Date(quote.createdAt).toLocaleDateString('en-ZA') },
      { label: 'Valid Until', value: quote.validUntil ? new Date(quote.validUntil).toLocaleDateString('en-ZA') : '—' },
      { label: 'Status',      value: quote.status },
    ].forEach(({ label, value }, i) => {
      doc.fillColor(MUTED).font('Helvetica').fontSize(9).text(label.toUpperCase(), 50 + i * col, metaY)
      doc.fillColor(DARK).font('Helvetica-Bold').fontSize(11).text(value, 50 + i * col, metaY + 14)
    })

    doc.y = metaY + 42
    doc.moveTo(50, doc.y).lineTo(50 + pageW, doc.y).strokeColor(BORDER).lineWidth(1).stroke()
    doc.moveDown(0.8)

    // ─── BILL TO ───────────────────────────────────────────────────────
    const infoY = doc.y
    doc.fillColor(MUTED).font('Helvetica').fontSize(9).text('BILL TO', 50, infoY)
    doc.moveDown(0.3)
    const custName = `${quote.customer?.firstName || ''} ${quote.customer?.lastName || ''}`.trim()
    doc.fillColor(DARK).font('Helvetica-Bold').fontSize(12).text(custName || '—')
    if (quote.customer?.email) doc.font('Helvetica').fontSize(10).fillColor(MUTED).text(quote.customer.email)
    if (quote.customer?.phone) doc.font('Helvetica').fontSize(10).fillColor(MUTED).text(quote.customer.phone)

    // Ambassador pill (top-right of bill-to section)
    if (quote.ambassador) {
      doc.roundedRect(doc.page.width - 190, infoY, 140, 42, 6).fill(LIGHT)
      doc.fillColor(MUTED).font('Helvetica').fontSize(9).text('AMBASSADOR CODE', doc.page.width - 182, infoY + 6)
      doc.fillColor(BRAND).font('Helvetica-Bold').fontSize(14).text(quote.ambassador.code, doc.page.width - 182, infoY + 19)
    }

    doc.y = Math.max(doc.y, infoY + 55)
    doc.moveDown(0.5)
    doc.moveTo(50, doc.y).lineTo(50 + pageW, doc.y).strokeColor(BORDER).lineWidth(1).stroke()
    doc.moveDown(0.8)

    // ─── ITEMS TABLE ───────────────────────────────────────────────────
    const COL = { desc: 50, qty: 320, unit: 390, total: 470 }
    const COL_W = { desc: 260, qty: 60, unit: 70, total: 80 }

    // Header row
    doc.rect(50, doc.y, pageW, 22).fill(LIGHT)
    const hY = doc.y + 6
    doc.fillColor(MUTED).font('Helvetica-Bold').fontSize(9)
    doc.text('DESCRIPTION',  COL.desc,  hY, { width: COL_W.desc })
    doc.text('QTY',          COL.qty,   hY, { width: COL_W.qty,   align: 'center' })
    doc.text('UNIT PRICE',   COL.unit,  hY, { width: COL_W.unit,  align: 'right' })
    doc.text('TOTAL',        COL.total, hY, { width: COL_W.total, align: 'right' })
    doc.y += 22

    // Item rows
    ;(quote.items || []).forEach((item: any, i: number) => {
      const rowY = doc.y
      const bg = i % 2 === 1 ? LIGHT : 'white'
      const productName = item.variant?.product?.name || 'Item'
      const variantName = item.variant?.name || ''
      const fullName = variantName ? `${productName} — ${variantName}` : productName
      const unitPrice = Number(item.unitPrice || 0)
      const qty = item.quantity
      const lineTotal = unitPrice * qty

      doc.rect(50, rowY, pageW, 26).fill(bg)
      const rY = rowY + 7
      doc.fillColor(DARK).font('Helvetica').fontSize(10)
      doc.text(fullName,            COL.desc,  rY, { width: COL_W.desc })
      doc.text(String(qty),         COL.qty,   rY, { width: COL_W.qty,   align: 'center' })
      doc.text(fmt(unitPrice),      COL.unit,  rY, { width: COL_W.unit,  align: 'right' })
      doc.fillColor(DARK).font('Helvetica-Bold')
      doc.text(fmt(lineTotal),      COL.total, rY, { width: COL_W.total, align: 'right' })
      doc.y = rowY + 26
    })

    doc.moveTo(50, doc.y).lineTo(50 + pageW, doc.y).strokeColor(BORDER).lineWidth(0.5).stroke()
    doc.moveDown(0.5)

    // ─── TOTALS ────────────────────────────────────────────────────────
    const totX = COL.unit - 50
    const totW = COL_W.unit + COL_W.total + 50

    function totRow(label: string, value: string, bold = false, color = DARK) {
      const rY = doc.y
      doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(bold ? 12 : 10)
      doc.fillColor(bold ? DARK : MUTED).text(label, totX, rY, { width: totW / 2 })
      doc.fillColor(color).text(value, totX + totW / 2, rY, { width: totW / 2, align: 'right' })
      doc.moveDown(bold ? 0.5 : 0.35)
    }

    totRow('Subtotal',     fmt(quote.subtotal))
    totRow('Delivery Fee', fmt(quote.deliveryFee))

    if (Number(quote.discountAmount) > 0) {
      const dlabel = quote.discountType === 'PERCENTAGE'
        ? `Discount (${quote.discountValue}%)`
        : 'Discount (Flat)'
      totRow(dlabel, `−${fmt(quote.discountAmount)}`, false, '#EF4444')
    }

    doc.moveDown(0.2)
    doc.moveTo(totX, doc.y).lineTo(totX + totW, doc.y).strokeColor(BORDER).lineWidth(0.8).stroke()
    doc.moveDown(0.4)
    totRow('TOTAL',        fmt(quote.total), true)

    // ─── NOTES ─────────────────────────────────────────────────────────
    if (quote.notes) {
      doc.moveDown(1)
      doc.rect(50, doc.y, pageW, 14).fill('#FFFBEB')
      doc.moveDown(0)
      doc.fillColor('#92400E').font('Helvetica-Bold').fontSize(9).text('NOTE', 58, doc.y + 3)
      doc.y += 20
      doc.fillColor(DARK).font('Helvetica').fontSize(10).text(quote.notes, 58, doc.y, { width: pageW - 16 })
      doc.moveDown(0.5)
    }

    // ─── FOOTER ────────────────────────────────────────────────────────
    const footerY = doc.page.height - 70
    doc.moveTo(50, footerY).lineTo(50 + pageW, footerY).strokeColor(BORDER).lineWidth(1).stroke()
    doc.fillColor(MUTED).font('Helvetica').fontSize(9)
      .text('Thank you for your business! 🍰  ·  Tlaka Treats  ·  hello@tlakatreats.co.za', 50, footerY + 10, { width: pageW, align: 'center' })
    doc.text('This quote is valid until the date shown above. Prices are subject to change.', 50, footerY + 24, { width: pageW, align: 'center' })

    doc.end()
  })
}
