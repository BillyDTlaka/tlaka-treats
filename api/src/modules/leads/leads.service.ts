import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY || '' })
const MODEL = 'claude-sonnet-4-6'
const SERPER_API = 'https://google.serper.dev/search'

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
      snippet: r.snippet,
      url:     r.link,
    }))
  } catch {
    return []
  }
}

function buildQueries(area: string, eventTypes: string[], keywords: string[]): string[] {
  const queries: string[] = []
  const kw = keywords.length ? keywords.join(' OR ') : '"biscuits" OR "scones" OR "baked goods"'

  // Facebook Groups
  queries.push(`site:facebook.com/groups "looking for" (${kw}) ${area}`)
  queries.push(`site:facebook.com/groups "need" (${kw}) ${area} 2026`)

  // Gumtree
  queries.push(`site:gumtree.co.za (${kw}) catering ${area}`)

  // Event-specific
  if (eventTypes.includes('WEDDING') || !eventTypes.length) {
    queries.push(`wedding catering (${kw}) ${area} 2026`)
    queries.push(`site:facebook.com/groups wedding snacks tea (${kw}) ${area}`)
  }
  if (eventTypes.includes('FUNERAL') || !eventTypes.length) {
    queries.push(`funeral catering tea (${kw}) ${area}`)
    queries.push(`"after tears" catering (${kw}) ${area}`)
  }
  if (eventTypes.includes('CORPORATE') || !eventTypes.length) {
    queries.push(`corporate event tea (${kw}) catering ${area}`)
    queries.push(`office meeting snacks (${kw}) ${area} supplier`)
  }
  if (eventTypes.includes('BIRTHDAY') || !eventTypes.length) {
    queries.push(`birthday party catering (${kw}) ${area}`)
  }

  // General bulk buyers
  queries.push(`wholesale (${kw}) supplier ${area}`)
  queries.push(`bulk order (${kw}) ${area}`)

  return queries
}

export async function runLeadSearch(
  db: any,
  area: string,
  eventTypes: string[],
  keywords: string[]
): Promise<{ found: number; saved: number }> {
  const queries = buildQueries(area, eventTypes, keywords)
  const allResults: any[] = []

  for (const q of queries) {
    const results = await serperSearch(q)
    allResults.push(...results.map(r => ({ ...r, query: q })))
  }

  if (!allResults.length) return { found: 0, saved: 0 }

  // Deduplicate by URL
  const seen = new Set<string>()
  const unique = allResults.filter(r => {
    if (seen.has(r.url)) return false
    seen.add(r.url)
    return true
  })

  // Use Claude to extract lead info from results
  const prompt = `You are a lead extraction assistant for Tlaka Treats — a South African baked goods business (biscuits, scones, cakes) based in ${area}.

Analyse these search results and extract potential leads — people or organisations that might need baked goods.

Search results:
${unique.map((r, i) => `${i + 1}. ${r.title}\n${r.snippet || ''}\nURL: ${r.url}\nQuery: ${r.query}`).join('\n\n')}

For each genuine lead (ignore irrelevant results), return a JSON array:
[{
  "name": "person or org name if visible, else null",
  "contact": "phone/email/social handle if visible, else null",
  "sourceName": "Facebook Groups | Gumtree | Web",
  "sourceUrl": "URL",
  "leadType": "EVENT | DIRECT | WHOLESALE | GENERAL",
  "eventType": "WEDDING | FUNERAL | CORPORATE | BIRTHDAY | OTHER | null",
  "eventDate": "YYYY-MM-DD if mentioned, else null",
  "location": "city/suburb if mentioned",
  "description": "1-2 sentence summary of the lead opportunity"
}]

Only include results that represent a genuine buying opportunity. Skip news articles, supplier listings, unrelated content.
Return ONLY valid JSON array, no explanation.`

  const msg = await client.messages.create({
    model: MODEL,
    max_tokens: 2000,
    messages: [{ role: 'user', content: prompt }],
  })

  const text = ((msg.content[0] as any).text || '').trim()
  let leads: any[] = []
  try {
    const match = text.match(/\[[\s\S]*\]/)
    if (match) leads = JSON.parse(match[0])
  } catch {}

  // Get existing source URLs to avoid duplicates
  const existingUrls = new Set(
    (await db.lead.findMany({ select: { sourceUrl: true } }))
      .map((l: any) => l.sourceUrl)
      .filter(Boolean)
  )

  let saved = 0
  for (const lead of leads) {
    if (lead.sourceUrl && existingUrls.has(lead.sourceUrl)) continue
    await db.lead.create({
      data: {
        name:        lead.name        || null,
        contact:     lead.contact     || null,
        sourceName:  lead.sourceName  || null,
        sourceUrl:   lead.sourceUrl   || null,
        leadType:    lead.leadType    || 'GENERAL',
        eventType:   lead.eventType   || null,
        eventDate:   lead.eventDate   ? new Date(lead.eventDate) : null,
        location:    lead.location    || null,
        description: lead.description || null,
        status:      'NEW',
      },
    })
    saved++
  }

  return { found: unique.length, saved }
}

export async function generateOutreach(lead: any): Promise<string> {
  const context = [
    lead.name        ? `Name: ${lead.name}` : null,
    lead.eventType   ? `Event type: ${lead.eventType}` : null,
    lead.eventDate   ? `Event date: ${lead.eventDate}` : null,
    lead.location    ? `Location: ${lead.location}` : null,
    lead.description ? `Context: ${lead.description}` : null,
    lead.sourceName  ? `Found on: ${lead.sourceName}` : null,
  ].filter(Boolean).join('\n')

  const prompt = `Write a short, warm outreach message from Tlaka Treats (a small South African handmade baked goods business — biscuits, scones, cakes) to this potential lead.

Lead details:
${context}

Requirements:
- Friendly and personal, not salesy
- Mention what Tlaka Treats makes (biscuits, scones, baked goods)
- Reference their specific context (event type, need) if available
- Offer to send a quote or sample menu
- Keep it under 100 words
- Suitable for WhatsApp or email
- Use South African tone (warm, direct)
- Do NOT use "Dear Sir/Madam" — use their name if available, otherwise "Hi there"

Write only the message, no subject line, no explanation.`

  const msg = await client.messages.create({
    model: MODEL,
    max_tokens: 300,
    messages: [{ role: 'user', content: prompt }],
  })

  return ((msg.content[0] as any).text || '').trim()
}
