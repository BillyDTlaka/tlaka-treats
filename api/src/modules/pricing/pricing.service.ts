import Anthropic from '@anthropic-ai/sdk'
import nodemailer from 'nodemailer'
import { config } from '../../config'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY || '' })
const MODEL = 'claude-sonnet-4-6'
const SERPER_API = 'https://google.serper.dev/search'

const DEFAULT_STORES = [
  { name: 'Makro',       domain: 'makro.co.za',    sortOrder: 0 },
  { name: 'Checkers',    domain: 'checkers.co.za',  sortOrder: 1 },
  { name: 'Pick n Pay',  domain: 'pnp.co.za',       sortOrder: 2 },
  { name: 'Shoprite',    domain: 'shoprite.co.za',  sortOrder: 3 },
  { name: "Baker's Bin", domain: 'bakersbin.co.za', sortOrder: 4 },
]

export async function seedDefaultStores(db: any): Promise<void> {
  const count = await db.pricingStore.count()
  if (count > 0) return
  for (const s of DEFAULT_STORES) {
    await db.pricingStore.create({ data: s })
  }
}

async function serperSearch(query: string): Promise<any[]> {
  const key = process.env.SERPER_API_KEY || process.env.BRAVE_SEARCH_API_KEY || ''
  if (!key) return []
  try {
    const res = await fetch(SERPER_API, {
      method: 'POST',
      headers: { 'X-API-KEY': key, 'Content-Type': 'application/json' },
      body: JSON.stringify({ q: query, gl: 'za', num: 10 }),
    })
    if (!res.ok) return []
    const data: any = await res.json()
    return (data.organic || []).map((r: any) => ({
      title:   r.title,
      snippet: r.snippet || '',
      url:     r.link,
    }))
  } catch {
    return []
  }
}

export async function searchItemPrices(
  db: any,
  searchTerm: string,
  stockItemId: string | null,
  stores: { name: string; domain: string }[]
): Promise<any[]> {
  if (!stores.length) return []

  const siteFilter = stores.map(s => `site:${s.domain}`).join(' OR ')
  const query = `"${searchTerm}" price South Africa (${siteFilter})`

  const results = await serperSearch(query)
  if (!results.length) return []

  const prompt = `Extract retail prices from these South African search results for the product "${searchTerm}".

Known stores to look for: ${stores.map(s => `${s.name} (${s.domain})`).join(', ')}

Search results:
${results.map((r, i) => `${i + 1}. ${r.title}\n${r.snippet}\nURL: ${r.url}`).join('\n\n')}

Return a JSON array. For each price found:
{
  "storeName": "exact store name from the known stores list, or domain if unknown",
  "pricePerUnit": number,
  "packSize": number or null,
  "packPrice": number or null,
  "unitLabel": "kg/L/unit/etc",
  "url": "source URL",
  "rawSnippet": "relevant price text"
}

CRITICAL normalization rules — all prices MUST be comparable:
- "pricePerUnit" MUST always be the price for exactly 1 base unit (1 kg, 1 L, 1 item)
  - NEVER return the pack price as pricePerUnit
  - Example: R149 for 12.5kg flour → pricePerUnit: 11.92, unitLabel: "kg", packSize: 12.5, packPrice: 149
  - Example: R25 for 250g butter → pricePerUnit: 100, unitLabel: "kg", packSize: 0.25, packPrice: 25
  - Example: R15.99 for 1kg sugar → pricePerUnit: 15.99, unitLabel: "kg", packSize: 1, packPrice: 15.99
  - Example: R55 for 5L oil → pricePerUnit: 11, unitLabel: "L", packSize: 5, packPrice: 55
- "unitLabel" must be the BASE unit (kg, L, unit) — NEVER the pack size (e.g. not "12.5kg bag")
- All stores for the same product MUST use the same unitLabel so they are directly comparable
- If the same store appears multiple times, keep the lowest pricePerUnit
- Only include prices you are confident about (actual Rand amounts from the snippets)
- Return [] if no clear prices found
- Return ONLY valid JSON array, no explanation.`

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

  // Delete old market prices for this item if linked to a stockItem
  if (stockItemId) {
    await db.marketPrice.deleteMany({ where: { stockItemId } })
  }

  const saved: any[] = []
  for (const p of prices) {
    if (!p.pricePerUnit || Number(p.pricePerUnit) <= 0) continue
    const mp = await db.marketPrice.create({
      data: {
        stockItemId:  stockItemId || null,
        searchTerm:   stockItemId ? null : searchTerm,
        pricePerUnit: p.pricePerUnit,
        unitLabel:    p.unitLabel  || null,
        source:       p.storeName  || 'Web',
        url:          p.url        || null,
        rawSnippet:   p.rawSnippet || null,
        checkedAt:    new Date(),
      },
    })
    saved.push({ ...mp, storeName: p.storeName, packSize: p.packSize, packPrice: p.packPrice })
  }

  return saved
}

export async function runPriceCheck(
  db: any,
  items: { stockItemId?: string; searchTerm: string }[]
): Promise<{ term: string; found: number }[]> {
  const stores = await db.pricingStore.findMany({ where: { isActive: true }, orderBy: { sortOrder: 'asc' } })
  const results = []
  for (const item of items) {
    const prices = await searchItemPrices(db, item.searchTerm, item.stockItemId || null, stores)
    results.push({ term: item.searchTerm, found: prices.length })
  }
  return results
}

export async function generateShoppingList(
  db: any,
  stockItemIds: string[],
  customTerms: string[]
): Promise<string> {
  // Gather all market prices for the selected items
  const where: any = { OR: [] }
  if (stockItemIds.length) where.OR.push({ stockItemId: { in: stockItemIds } })
  if (customTerms.length)  where.OR.push({ searchTerm:  { in: customTerms }  })
  if (!where.OR.length) return 'No items selected.'

  const prices = await db.marketPrice.findMany({
    where,
    include: { stockItem: { select: { name: true, costPerUnit: true, uom: { select: { abbreviation: true } } } } },
    orderBy: { checkedAt: 'desc' },
  })

  if (!prices.length) return 'No price data found. Run a price check first.'

  const grouped: Record<string, any[]> = {}
  for (const p of prices) {
    const key = p.stockItem?.name || p.searchTerm || 'Unknown'
    if (!grouped[key]) grouped[key] = []
    grouped[key].push(p)
  }

  const itemSummaries = Object.entries(grouped).map(([name, ps]) => ({
    item: name,
    prices: ps.map(p => ({ store: p.source, pricePerUnit: Number(p.pricePerUnit), unit: p.unitLabel || p.stockItem?.uom?.abbreviation || 'unit', url: p.url })),
  }))

  const prompt = `You are Bohlale, AI assistant for Tlaka Treats — a small South African baked goods business that buys ingredients directly from retail stores.

Based on these price comparisons, create an optimised shopping list that tells the owner exactly where to buy each item at the lowest price.

Price data:
${JSON.stringify(itemSummaries, null, 2)}

Output a **Purchase List** formatted as:

## 🛒 Shopping List by Store

For each store that has the best price for at least one item, create a section:

### [Store Name]
| Item | Price | Unit |
|------|-------|------|
| ... | R... | per kg |

**Store Total: R...**  (sum of best prices for items bought here)

At the end:
## 📋 Summary
- Total estimated spend: R...
- Items with no price data: [list]
- Biggest saving vs current cost: [if cost data available]

Rules:
- Use South African Rand (R)
- Pick the single cheapest store per item
- If prices are very close (< 5% difference), note "Similar pricing across stores"
- Keep it practical and clear for a busy business owner`

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
    host:   config.email.host,
    port:   config.email.port,
    secure: config.email.secure,
    auth:   { user: config.email.user, pass: config.email.pass },
  })

  await transport.sendMail({ from: config.email.from, to: supplier.email, subject, text: body })

  return db.supplierQuoteRequest.create({
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
}
