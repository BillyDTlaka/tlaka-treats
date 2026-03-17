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

// ─── Board Meeting PDF ─────────────────────────────────────────────────────────
export async function generateBoardPdf(meeting: any): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    const doc = new PDFDocument({ size: 'A4', margin: 50, autoFirstPage: true })

    doc.on('data', (c: Buffer) => chunks.push(c))
    doc.on('end', () => resolve(Buffer.concat(chunks)))
    doc.on('error', reject)

    const pageW = doc.page.width - 100

    const report  = meeting.reportJson  || {}
    const verdict = report.verdict      || {}
    const meta    = report.meta         || {}

    const HEALTH_COLOR: Record<string, string> = {
      STRONG: '#059669', STABLE: '#2563EB', AT_RISK: '#D97706', CRITICAL: '#DC2626',
    }
    const PRIORITY_COLOR: Record<string, string> = { HIGH: '#DC2626', MEDIUM: '#D97706', LOW: '#059669' }
    const SEV_COLOR: Record<string, string> = { CRITICAL: '#DC2626', HIGH: '#EA580C', MEDIUM: '#D97706', LOW: '#6B7280' }
    const hColor = HEALTH_COLOR[verdict.overallHealth] || '#2563EB'

    // ─── HEADER ────────────────────────────────────────────────────────────────
    doc.rect(0, 0, doc.page.width, 110).fill(BRAND)
    doc.fillColor('white').font('Helvetica-Bold').fontSize(24).text('Tlaka Treats', 50, 28)
    doc.font('Helvetica').fontSize(11).fillColor('rgba(255,255,255,0.75)').text('AI Advisory Board Meeting', 50, 58)
    doc.font('Helvetica').fontSize(10).fillColor('rgba(255,255,255,0.65)').text(
      `Generated ${new Date(meta.generatedAt || meeting.createdAt).toLocaleString('en-ZA')}   ·   ${meta.periodDays || 30}-day window   ·   ${meta.totalAgentCalls || 7} AI calls`,
      50, 78
    )

    // Health badge top-right
    doc.fillColor('white').font('Helvetica-Bold').fontSize(11)
      .text('BOARD REPORT', doc.page.width - 160, 30, { width: 110, align: 'right' })
    doc.font('Helvetica-Bold').fontSize(18).fillColor('white')
      .text(verdict.overallHealth || 'STABLE', doc.page.width - 160, 50, { width: 110, align: 'right' })

    doc.y = 130

    // ─── VERDICT ───────────────────────────────────────────────────────────────
    doc.roundedRect(50, doc.y, pageW, 52, 6).fill(hColor + '15')
    doc.fillColor(hColor).font('Helvetica-Bold').fontSize(13)
      .text(verdict.overallHealth || '', 62, doc.y + 10)
    doc.fillColor(DARK).font('Helvetica').fontSize(10)
      .text(verdict.headline || '', 62, doc.y + 28, { width: pageW - 24 })
    doc.y += 62

    // Board sentiment row
    const sentRow = Object.entries(verdict.boardSentiment || {})
    if (sentRow.length) {
      doc.fillColor(MUTED).font('Helvetica').fontSize(9)
      sentRow.forEach(([key, val], i) => {
        doc.text(`${val} ${key}`, 50 + i * 80, doc.y, { width: 78, align: 'center' })
      })
      doc.y += 18
    }

    doc.moveDown(0.5)
    doc.moveTo(50, doc.y).lineTo(50 + pageW, doc.y).strokeColor(BORDER).lineWidth(0.8).stroke()
    doc.moveDown(0.8)

    // ── Helper: section heading ─────────────────────────────────────────────
    function sectionHead(title: string) {
      if (doc.y > doc.page.height - 120) doc.addPage()
      doc.fillColor(DARK).font('Helvetica-Bold').fontSize(12).text(title, 50, doc.y)
      doc.moveDown(0.35)
      doc.moveTo(50, doc.y).lineTo(50 + pageW, doc.y).strokeColor(BORDER).lineWidth(0.5).stroke()
      doc.moveDown(0.4)
    }

    function pill(text: string, color: string, x: number, y: number, w = 70) {
      doc.roundedRect(x, y, w, 14, 4).fill(color + '25')
      doc.fillColor(color).font('Helvetica-Bold').fontSize(7.5).text(text, x + 4, y + 3, { width: w - 8 })
    }

    // ─── KEY INSIGHTS ──────────────────────────────────────────────────────────
    if ((report.keyInsights || []).length) {
      sectionHead('KEY INSIGHTS')
      ;(report.keyInsights as any[]).forEach((ins, i) => {
        if (doc.y > doc.page.height - 80) doc.addPage()
        const rowY = doc.y
        doc.roundedRect(50, rowY, 22, 22, 4).fill(BRAND + '20')
        doc.fillColor(BRAND).font('Helvetica-Bold').fontSize(10).text(String(i + 1), 50, rowY + 6, { width: 22, align: 'center' })
        doc.fillColor(DARK).font('Helvetica').fontSize(9.5)
          .text(ins.insight, 80, rowY + 2, { width: pageW - 36 })
        if (ins.dataRef) {
          doc.fillColor(MUTED).font('Helvetica').fontSize(8).text(`[${ins.dataRef}]`, 80, doc.y)
        }
        doc.y = Math.max(doc.y, rowY + 26)
        doc.moveDown(0.2)
      })
      doc.moveDown(0.5)
    }

    // ─── RECOMMENDED ACTIONS ───────────────────────────────────────────────────
    if ((report.recommendedActions || []).length) {
      sectionHead('RECOMMENDED ACTIONS')
      ;(report.recommendedActions as any[]).forEach((act, i) => {
        if (doc.y > doc.page.height - 90) doc.addPage()
        const rowY = doc.y
        const pc = PRIORITY_COLOR[act.priority] || MUTED
        doc.roundedRect(50, rowY, pageW, 1).fill(i % 2 === 0 ? LIGHT : 'white')
        doc.fillColor(DARK).font('Helvetica-Bold').fontSize(10)
          .text(`${i + 1}. ${act.action}`, 50, rowY, { width: pageW - 100 })
        pill(act.priority, pc, 50 + pageW - 92, rowY, 56)
        doc.fillColor(MUTED).font('Helvetica').fontSize(8.5)
          .text(act.expectedImpact || '', 50, doc.y, { width: pageW - 110 })
        const metaY = doc.y
        const tf = (act.timeframe || '').replace(/_/g, ' ')
        doc.fillColor('#6366F1').font('Helvetica').fontSize(8).text(tf, 50, metaY)
        if (act.owner) doc.fillColor(MUTED).font('Helvetica').fontSize(8).text(`Owner: ${act.owner}`, 160, metaY)
        const cons = act.advisorConsensus === 'agreed' ? '✓ Board agreed' : '~ Mixed'
        doc.fillColor(act.advisorConsensus === 'agreed' ? '#059669' : '#D97706').font('Helvetica-Bold').fontSize(8).text(cons, 280, metaY)
        doc.y = Math.max(doc.y, rowY + 42)
        doc.moveDown(0.3)
      })
      doc.moveDown(0.5)
    }

    // ─── RISK WARNINGS ─────────────────────────────────────────────────────────
    if ((report.riskWarnings || []).length) {
      sectionHead('RISK WARNINGS')
      ;(report.riskWarnings as any[]).forEach(r => {
        if (doc.y > doc.page.height - 80) doc.addPage()
        const rowY = doc.y
        const sc = SEV_COLOR[r.severity] || MUTED
        pill(r.severity, sc, 50, rowY, 58)
        doc.fillColor(DARK).font('Helvetica-Bold').fontSize(9.5)
          .text(r.risk, 116, rowY, { width: pageW - 68 })
        doc.fillColor(MUTED).font('Helvetica').fontSize(8.5)
          .text('→ ' + (r.mitigation || ''), 116, doc.y, { width: pageW - 68 })
        doc.y = Math.max(doc.y, rowY + 30)
        doc.moveDown(0.3)
      })
      doc.moveDown(0.5)
    }

    // ─── GROWTH OPPORTUNITIES ──────────────────────────────────────────────────
    if ((report.growthOpportunities || []).length) {
      sectionHead('GROWTH OPPORTUNITIES')
      ;(report.growthOpportunities as any[]).forEach(o => {
        if (doc.y > doc.page.height - 80) doc.addPage()
        const rowY = doc.y
        doc.fillColor(DARK).font('Helvetica-Bold').fontSize(9.5)
          .text(o.opportunity, 50, rowY, { width: pageW - 120 })
        doc.fillColor('#059669').font('Helvetica-Bold').fontSize(8.5)
          .text(o.potentialValue || '', 50, doc.y, { width: pageW - 120 })
        pill((o.effort || '') + ' EFFORT', '#6366F1', 50 + pageW - 100, rowY, 90)
        doc.y = Math.max(doc.y, rowY + 28)
        doc.moveDown(0.3)
      })
      doc.moveDown(0.5)
    }

    // ─── ADVISOR HIGHLIGHTS ────────────────────────────────────────────────────
    if ((report.advisorHighlights || []).length) {
      sectionHead('ADVISOR HIGHLIGHTS')
      const cols = 2
      const colW = (pageW - 10) / cols
      let colIdx = 0
      let rowStartY = doc.y
      ;(report.advisorHighlights as any[]).forEach(adv => {
        if (colIdx === 0 && doc.y > doc.page.height - 90) { doc.addPage(); rowStartY = doc.y }
        const x = 50 + colIdx * (colW + 10)
        doc.roundedRect(x, rowStartY, colW, 46, 5).fill(LIGHT)
        doc.fillColor(BRAND).font('Helvetica-Bold').fontSize(8.5)
          .text((adv.role || '').replace(/_/g, ' '), x + 8, rowStartY + 6, { width: colW - 16 })
        doc.fillColor(DARK).font('Helvetica').fontSize(8.5)
          .text(adv.headline || '', x + 8, rowStartY + 20, { width: colW - 16, height: 22, ellipsis: true })
        colIdx++
        if (colIdx >= cols) {
          colIdx = 0
          rowStartY += 54
          doc.y = rowStartY
        }
      })
      if (colIdx > 0) doc.y = rowStartY + 54
      doc.moveDown(0.5)
    }

    // ─── NEXT MEETING FOCUS ────────────────────────────────────────────────────
    if ((report.nextMeetingFocus || []).length) {
      if (doc.y > doc.page.height - 100) doc.addPage()
      sectionHead('NEXT MEETING FOCUS')
      ;(report.nextMeetingFocus as string[]).forEach(item => {
        doc.fillColor(DARK).font('Helvetica').fontSize(9.5)
          .text('→  ' + item, 56, doc.y, { width: pageW - 10 })
        doc.moveDown(0.4)
      })
    }

    // ─── FOOTER ────────────────────────────────────────────────────────────────
    const footerY = doc.page.height - 60
    doc.moveTo(50, footerY).lineTo(50 + pageW, footerY).strokeColor(BORDER).lineWidth(0.8).stroke()
    doc.fillColor(MUTED).font('Helvetica').fontSize(8)
      .text('Confidential · Tlaka Treats AI Advisory Board Report · hello@tlakatreats.co.za', 50, footerY + 10, { width: pageW, align: 'center' })
    doc.text(`Powered by Claude AI (${meta.agentModel || ''} + ${meta.synthModel || ''})`, 50, footerY + 22, { width: pageW, align: 'center' })

    doc.end()
  })
}

// ─── Strategy PDF ──────────────────────────────────────────────────────────────
export async function generateStrategyPdf(strategy: any): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    const doc = new PDFDocument({ size: 'A4', margin: 50, autoFirstPage: true })
    doc.on('data', (c: Buffer) => chunks.push(c))
    doc.on('end',  () => resolve(Buffer.concat(chunks)))
    doc.on('error', reject)

    const pageW = doc.page.width - 100
    const content = (strategy.contentJson || {}) as any

    const IMPACT_COLOR: Record<string, string> = { HIGH: '#DC2626', MEDIUM: '#D97706', LOW: '#059669' }

    // ─── HEADER ──────────────────────────────────────────────────────────────
    doc.rect(0, 0, doc.page.width, 120).fill(BRAND)
    doc.fillColor('white').font('Helvetica-Bold').fontSize(22).text('Tlaka Treats', 50, 26)
    doc.font('Helvetica').fontSize(11).fillColor('rgba(255,255,255,0.75)').text('Business Strategy Document', 50, 54)
    doc.font('Helvetica-Bold').fontSize(13).fillColor('white').text(strategy.title || 'Strategy', 50, 74)
    doc.roundedRect(doc.page.width - 140, 28, 90, 22, 5).fill('rgba(255,255,255,0.2)')
    doc.fillColor('white').font('Helvetica-Bold').fontSize(9)
      .text(strategy.status || '', doc.page.width - 136, 35, { width: 82, align: 'center' })
    doc.fillColor('rgba(255,255,255,0.65)').font('Helvetica').fontSize(9)
      .text(`v${strategy.currentVersion || 1}  ·  ${new Date(strategy.createdAt).toLocaleDateString('en-ZA')}`, 50, 99)
    doc.y = 140

    function sectionHead(title: string) {
      if (doc.y > doc.page.height - 130) doc.addPage()
      doc.moveDown(0.3)
      doc.rect(50, doc.y, pageW, 24).fill(BRAND + '12')
      doc.fillColor(BRAND).font('Helvetica-Bold').fontSize(11).text(title, 58, doc.y + 7)
      doc.y += 30
    }

    function bodyText(text: string) {
      if (doc.y > doc.page.height - 60) doc.addPage()
      doc.fillColor(DARK).font('Helvetica').fontSize(10).text(text, 50, doc.y, { width: pageW })
      doc.moveDown(0.4)
    }

    function bullet(text: string) {
      if (doc.y > doc.page.height - 50) doc.addPage()
      const y = doc.y
      doc.circle(62, y + 5, 3).fill(BRAND)
      doc.fillColor(DARK).font('Helvetica').fontSize(10).text(text, 72, y, { width: pageW - 24 })
      doc.moveDown(0.2)
    }

    function lbl(text: string) {
      doc.fillColor(MUTED).font('Helvetica-Bold').fontSize(8).text(text.toUpperCase(), 50, doc.y)
      doc.moveDown(0.2)
    }

    if (content.executiveSummary) { sectionHead('Executive Summary'); bodyText(content.executiveSummary) }

    if (content.vision || content.mission) {
      sectionHead('Vision & Mission')
      if (content.vision)  { lbl('Vision');  bodyText(content.vision);  doc.moveDown(0.2) }
      if (content.mission) { lbl('Mission'); bodyText(content.mission) }
    }

    if ((content.coreValues || []).length) {
      sectionHead('Core Values')
      const cols = 2; const colW2 = (pageW - 10) / cols
      let ci = 0; let rowY = doc.y
      ;(content.coreValues as any[]).forEach(cv => {
        if (ci === 0 && doc.y > doc.page.height - 70) { doc.addPage(); rowY = doc.y }
        const x = 50 + ci * (colW2 + 10)
        doc.roundedRect(x, rowY, colW2, 50, 5).fill(LIGHT)
        doc.fillColor(BRAND).font('Helvetica-Bold').fontSize(10).text(cv.value || '', x + 8, rowY + 8, { width: colW2 - 16 })
        doc.fillColor(MUTED).font('Helvetica').fontSize(8.5).text(cv.description || '', x + 8, rowY + 24, { width: colW2 - 16, height: 20, ellipsis: true })
        ci++
        if (ci >= cols) { ci = 0; rowY += 58; doc.y = rowY }
      })
      if (ci > 0) doc.y = rowY + 58
    }

    if (content.swot) {
      sectionHead('SWOT Analysis')
      const sw = content.swot
      const qW = (pageW - 6) / 2; const qH = 90
      if (doc.y + qH * 2 + 20 > doc.page.height - 60) doc.addPage()
      const baseY = doc.y
      const quads = [
        { label: 'Strengths',     items: sw.strengths     || [], color: '#059669', x: 50,          y: baseY },
        { label: 'Weaknesses',    items: sw.weaknesses    || [], color: '#DC2626', x: 50 + qW + 6, y: baseY },
        { label: 'Opportunities', items: sw.opportunities || [], color: '#2563EB', x: 50,          y: baseY + qH + 6 },
        { label: 'Threats',       items: sw.threats       || [], color: '#D97706', x: 50 + qW + 6, y: baseY + qH + 6 },
      ]
      quads.forEach(q => {
        doc.roundedRect(q.x, q.y, qW, qH, 5).fill(q.color + '10')
        doc.rect(q.x, q.y, qW, 18).fill(q.color + '30')
        doc.fillColor(q.color).font('Helvetica-Bold').fontSize(9).text(q.label.toUpperCase(), q.x + 8, q.y + 5, { width: qW - 16 })
        let iy = q.y + 22
        ;(q.items as string[]).slice(0, 4).forEach(item => {
          doc.fillColor(DARK).font('Helvetica').fontSize(8.5).text('• ' + item, q.x + 8, iy, { width: qW - 16, height: 14, ellipsis: true })
          iy += 14
        })
      })
      doc.y = baseY + qH * 2 + 16
    }

    if ((content.strategicGoals || []).length) {
      sectionHead('Strategic Goals')
      ;(content.strategicGoals as any[]).forEach((goal, i) => {
        if (doc.y > doc.page.height - 100) doc.addPage()
        const pc = IMPACT_COLOR[goal.priority] || MUTED
        const gy = doc.y
        doc.roundedRect(50, gy, pageW, 14).fill(pc + '20')
        doc.fillColor(pc).font('Helvetica-Bold').fontSize(10).text(`${i + 1}. ${goal.goal}`, 58, gy + 3, { width: pageW - 100 })
        doc.y = gy + 22
        doc.fillColor(MUTED).font('Helvetica').fontSize(8.5).text(`${goal.timeframe || ''}  ·  Owner: ${goal.owner || '—'}`, 58, doc.y)
        doc.moveDown(0.4)
        ;(goal.kpis || []).forEach((kpi: any) => {
          doc.fillColor(DARK).font('Helvetica').fontSize(9)
            .text(`📊 ${kpi.metric}: ${kpi.current} → ${kpi.target}`, 66, doc.y, { width: pageW - 20 })
          doc.moveDown(0.2)
        })
        ;(goal.initiatives || []).forEach((ini: string) => bullet(ini))
        doc.moveDown(0.3)
      })
    }

    if ((content.actionPlan90Days || []).length) {
      sectionHead('90-Day Action Plan')
      ;(content.actionPlan90Days as any[]).forEach(week => {
        if (doc.y > doc.page.height - 70) doc.addPage()
        doc.fillColor(BRAND).font('Helvetica-Bold').fontSize(10).text(week.week || '', 50, doc.y)
        doc.fillColor(MUTED).font('Helvetica').fontSize(8.5).text(`Owner: ${week.owner || '—'}`, 200, doc.y - 12)
        doc.moveDown(0.2)
        ;(week.actions as string[] || []).forEach(a => bullet(a))
        doc.moveDown(0.3)
      })
    }

    if ((content.financialTargets || []).length) {
      sectionHead('Financial Targets')
      if (doc.y > doc.page.height - 100) doc.addPage()
      const tblY = doc.y
      doc.rect(50, tblY, pageW, 18).fill(LIGHT)
      doc.fillColor(MUTED).font('Helvetica-Bold').fontSize(8.5)
      doc.text('METRIC', 58, tblY + 5, { width: 140 })
      doc.text('CURRENT', 202, tblY + 5, { width: 90 })
      doc.text('TARGET', 297, tblY + 5, { width: 90 })
      doc.text('BY', 392, tblY + 5, { width: 108 })
      doc.y = tblY + 18
      ;(content.financialTargets as any[]).forEach((ft, i) => {
        if (doc.y > doc.page.height - 50) doc.addPage()
        const ry = doc.y
        doc.rect(50, ry, pageW, 20).fill(i % 2 === 0 ? 'white' : LIGHT)
        doc.fillColor(DARK).font('Helvetica').fontSize(9).text(ft.metric || '', 58, ry + 5, { width: 140 })
        doc.text(ft.current || '', 202, ry + 5, { width: 90 })
        doc.fillColor('#059669').font('Helvetica-Bold').text(ft.target || '', 297, ry + 5, { width: 90 })
        doc.fillColor(MUTED).font('Helvetica').text(ft.by || '', 392, ry + 5, { width: 108 })
        doc.y = ry + 20
      })
      doc.moveDown(0.5)
    }

    if ((content.riskRegister || []).length) {
      sectionHead('Risk Register')
      ;(content.riskRegister as any[]).forEach(r => {
        if (doc.y > doc.page.height - 70) doc.addPage()
        const lc = IMPACT_COLOR[r.likelihood] || MUTED
        const ic = IMPACT_COLOR[r.impact]     || MUTED
        const ry = doc.y
        doc.roundedRect(50, ry, pageW, 14).fill(lc + '15')
        doc.fillColor(DARK).font('Helvetica-Bold').fontSize(9.5).text(r.risk || '', 58, ry + 3, { width: pageW - 100 })
        doc.y = ry + 18
        doc.fillColor(lc).font('Helvetica-Bold').fontSize(8).text(`Likelihood: ${r.likelihood}`, 58, doc.y)
        doc.fillColor(ic).text(`  Impact: ${r.impact}`, 158, doc.y)
        doc.fillColor(MUTED).font('Helvetica').text(`  Owner: ${r.owner || '—'}`, 248, doc.y)
        doc.moveDown(0.35)
        doc.fillColor(DARK).font('Helvetica').fontSize(9).text('→ ' + (r.mitigation || ''), 58, doc.y, { width: pageW - 20 })
        doc.moveDown(0.5)
      })
    }

    const footerY = doc.page.height - 60
    doc.moveTo(50, footerY).lineTo(50 + pageW, footerY).strokeColor(BORDER).lineWidth(0.8).stroke()
    doc.fillColor(MUTED).font('Helvetica').fontSize(8)
      .text('Confidential · Tlaka Treats Strategy Document · hello@tlakatreats.co.za', 50, footerY + 10, { width: pageW, align: 'center' })
    doc.text(`Version ${strategy.currentVersion || 1}  ·  Status: ${strategy.status}  ·  Generated by Claude AI`, 50, footerY + 22, { width: pageW, align: 'center' })

    doc.end()
  })
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
