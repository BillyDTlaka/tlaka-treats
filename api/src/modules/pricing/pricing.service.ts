import Anthropic from '@anthropic-ai/sdk'
import nodemailer from 'nodemailer'
import { config } from '../../config'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY || '' })
const MODEL = 'claude-sonnet-4-6'
const SERPER_API = 'https://google.serper.dev/search'

async function webSearch(query: string): Promise<any[]> {
  const key = config.braveSearchApiKey  // reusing same config key — set BRAVE_SEARCH_API_KEY to your Serper key
  if (!key) return []
  try {
    const res = await fetch(SERPER_API, {
      method: 'POST',
      headers: { 'X-API-KEY': key, 'Content-Type': 'application/json' },
      body: JSON.stringify({ q: query, gl: 'za', num: 5 }),
    })
    if (!res.ok) return []
    const data: any = await res.json()
    return (data.organic || []).map((r: any) => ({
      title:       r.title,
      description: r.snippet,
      url:         r.link,
    }))
  } catch {
    return []
  }
}

export async function searchIngredientPrices(db: any, stockItemId: string): Promise<any> {
  const stockItem = await db.stockItem.findUnique({
    where: { id: stockItemId },
    include: { uom: true, product: true },
  })
  if (!stockItem) throw new Error('Stock item not found')

  const unitLabel = stockItem.uom?.abbreviation || stockItem.unit || 'unit'
  const name = stockItem.name
  const query = `"${name}" price South Africa per ${unitLabel} Makro OR Checkers OR "Pick n Pay" OR Woolworths`

  const results = await webSearch(query)
  if (!results.length) return { stockItem, prices: [] }

  const prompt = `Extract retail prices from these South African search results for the ingredient "${name}" (measuring unit: ${unitLabel}).

Search results:
${results.map((r: any, i: number) => `${i + 1}. ${r.title}\n${r.description || ''}\nURL: ${r.url}`).join('\n\n')}

Return a JSON array of found prices. Each item must have:
- "source": store name (e.g. "Makro", "Checkers", "Pick n Pay", "Woolworths", or domain name)
- "pricePerUnit": number — price per single ${unitLabel} (calculate from pack price if needed)
- "packSize": number or null — pack size in ${unitLabel} (e.g. 5 for a 5kg bag)
- "packPrice": number or null — total pack price in Rand
- "unitLabel": "${unitLabel}"
- "url": the URL
- "rawSnippet": the relevant snippet text

Rules:
- Only include prices you are confident about
- Convert pack prices to per-unit prices (e.g. R149 for 12.5kg = R11.92/kg)
- Ignore prices in currencies other than Rand
- If no clear prices found, return []

Return ONLY valid JSON array, no explanation.`

  const msg = await client.messages.create({
    model: MODEL,
    max_tokens: 800,
    messages: [{ role: 'user', content: prompt }],
  })

  const text = ((msg.content[0] as any).text || '').trim()
  let prices: any[] = []
  try {
    const match = text.match(/\[[\s\S]*\]/)
    if (match) prices = JSON.parse(match[0])
  } catch {}

  // Delete old market prices for this ingredient first
  await db.marketPrice.deleteMany({ where: { stockItemId } })

  const saved = []
  for (const p of prices) {
    if (!p.pricePerUnit || Number(p.pricePerUnit) <= 0) continue
    const mp = await db.marketPrice.create({
      data: {
        stockItemId,
        pricePerUnit: p.pricePerUnit,
        unitLabel: p.unitLabel || unitLabel,
        source: p.source || 'Web',
        url: p.url || null,
        rawSnippet: p.rawSnippet || null,
        checkedAt: new Date(),
      },
    })
    saved.push(mp)
  }

  return { stockItem, prices: saved }
}

export async function runPriceCheckAll(db: any): Promise<any[]> {
  const stockItems = await db.stockItem.findMany({
    where: { product: { classification: { in: ['INGREDIENT', 'PACKAGING'] } }, isActive: true },
    select: { id: true, name: true },
  })

  const results = []
  for (const si of stockItems) {
    try {
      const r = await searchIngredientPrices(db, si.id)
      results.push({ id: si.id, name: si.name, found: r.prices?.length || 0 })
    } catch (e: any) {
      results.push({ id: si.id, name: si.name, found: 0, error: e.message })
    }
  }
  return results
}

export async function generatePricingInsights(db: any): Promise<string> {
  const stockItems = await db.stockItem.findMany({
    where: { product: { classification: { in: ['INGREDIENT', 'PACKAGING'] } } },
    include: {
      uom: true,
      product: { select: { name: true, classification: true } },
      marketPrices: { orderBy: { checkedAt: 'desc' }, take: 5 },
      supplierQuotes: {
        orderBy: { createdAt: 'desc' },
        take: 5,
        include: { supplier: { select: { name: true } } },
      },
      purchaseOrderItems: {
        orderBy: { purchaseOrder: { orderDate: 'desc' } },
        take: 3,
        include: { purchaseOrder: { include: { supplier: { select: { name: true } } } } },
      },
    },
  })

  if (!stockItems.length) return 'No ingredient data available yet. Add stock items first.'

  const data = stockItems.map((si: any) => ({
    name: si.name,
    unit: si.uom?.abbreviation || si.unit || 'unit',
    currentCostPerUnit: Number(si.costPerUnit),
    recentPurchases: si.purchaseOrderItems.map((poi: any) => ({
      supplier: poi.purchaseOrder.supplier.name,
      unitCost: Number(poi.unitCost),
      date: poi.purchaseOrder.orderDate,
    })),
    marketPrices: si.marketPrices.map((mp: any) => ({
      source: mp.source,
      pricePerUnit: Number(mp.pricePerUnit),
      checkedAt: mp.checkedAt,
    })),
    supplierQuotes: si.supplierQuotes.map((sq: any) => ({
      supplier: sq.supplier.name,
      pricePerUnit: Number(sq.pricePerUnit),
      date: sq.createdAt,
    })),
  }))

  const prompt = `You are Bohlale, AI business assistant for Tlaka Treats (small South African food business).

Analyse these ingredient and packaging costs compared to market prices and supplier quotes.

Data:
${JSON.stringify(data, null, 2)}

Provide a concise pricing intelligence report with:

## 🔴 Overpaying (biggest savings first)
List items where we pay more than market/quote prices. Show: current cost vs best available price, % difference, estimated monthly saving (assume reasonable purchase volume).

## 🟡 Review These
Items with limited market data or minor discrepancies worth monitoring.

## 🟢 Competitive Pricing
Items where our costs are at or below market prices.

## 📋 Recommended Actions
3-5 specific actions to take this month (e.g. "Request updated quote from Supplier X for flour", "Buy sugar from Makro at R11.92/kg instead of R18/kg").

Use South African Rand (R). Be specific with numbers. If market price data is missing for some items, note that a price check should be run.`

  const msg = await client.messages.create({
    model: MODEL,
    max_tokens: 1500,
    messages: [{ role: 'user', content: prompt }],
  })

  return (msg.content[0] as any).text
}

export async function sendQuoteRequestEmail(
  db: any,
  supplierId: string,
  stockItemIds: string[],
  notes?: string
): Promise<any> {
  const supplier = await db.supplier.findUnique({ where: { id: supplierId } })
  if (!supplier) throw new Error('Supplier not found')
  if (!supplier.email) throw new Error('Supplier has no email address on file')
  if (!config.email.user) throw new Error('SMTP not configured — set SMTP_USER and SMTP_PASS env vars')

  const stockItems = await db.stockItem.findMany({
    where: { id: { in: stockItemIds } },
    include: { uom: true },
  })

  const itemList = stockItems
    .map((si: any) => `  • ${si.name} (price per ${si.uom?.abbreviation || si.unit || 'unit'})`)
    .join('\n')

  const subject = `Price Quote Request — Tlaka Treats`
  const body = `Dear ${supplier.contactName || supplier.name},

We would like to request your current pricing for the following items:

${itemList}

Please provide for each item:
  - Price per unit (with pack size, e.g. R45 per 1kg bag)
  - Minimum order quantity (if applicable)
  - Price validity period${notes ? `\n\nAdditional notes: ${notes}` : ''}

Please reply to this email with your quote at your earliest convenience.

Kind regards,
Tlaka Treats Procurement Team`

  const transport = nodemailer.createTransport({
    host: config.email.host,
    port: config.email.port,
    secure: config.email.secure,
    auth: { user: config.email.user, pass: config.email.pass },
  })

  await transport.sendMail({ from: config.email.from, to: supplier.email, subject, text: body })

  const request = await db.supplierQuoteRequest.create({
    data: {
      supplierId,
      subject,
      body,
      status: 'SENT',
      items: { create: stockItemIds.map((id: string) => ({ stockItemId: id })) },
    },
    include: {
      supplier: true,
      items: { include: { stockItem: true } },
    },
  })

  return request
}
