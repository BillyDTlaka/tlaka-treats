import { PrismaClient } from '@prisma/client'
import { config } from '../../config'

let cachedUid: number | null = null
let cachedCompanyId: number | null = null

async function odooRpc<T>(service: string, method: string, args: unknown[]): Promise<T> {
  const res = await fetch(`${config.odoo.url}/jsonrpc`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', method: 'call', params: { service, method, args }, id: Date.now() }),
  })
  const json = await res.json() as any
  if (json.error) {
    throw new Error(json.error.data?.message || json.error.message || 'Odoo RPC error')
  }
  return json.result as T
}

async function getUid(): Promise<number> {
  if (cachedUid) return cachedUid
  const uid = await odooRpc<number | false>('common', 'login', [config.odoo.db, config.odoo.username, config.odoo.apiKey])
  if (!uid) throw new Error('Odoo authentication failed — check ODOO_DB, ODOO_USERNAME, ODOO_API_KEY')
  cachedUid = uid
  return uid
}

async function getCompanyId(uid: number): Promise<number> {
  if (cachedCompanyId) return cachedCompanyId
  const companies = await odooRpc<Array<{ id: number }>>('object', 'execute_kw', [
    config.odoo.db,
    uid,
    config.odoo.apiKey,
    'res.company',
    'search_read',
    [[['name', '=', config.odoo.companyName]]],
    { fields: ['id'], limit: 1 },
  ])
  if (!companies.length) throw new Error(`Odoo company "${config.odoo.companyName}" not found — check ODOO_COMPANY_NAME`)
  cachedCompanyId = companies[0].id
  return cachedCompanyId
}

async function createOdooContact(input: { name: string; email?: string | null; phone?: string | null }): Promise<number> {
  const uid = await getUid()
  const companyId = await getCompanyId(uid)
  return odooRpc<number>('object', 'execute_kw', [
    config.odoo.db,
    uid,
    config.odoo.apiKey,
    'res.partner',
    'create',
    [{
      name: input.name,
      email: input.email || false,
      phone: input.phone || false,
      customer_rank: 1,
      company_id: companyId,
    }],
  ])
}

// Skips creation if odooPartnerId is already set, so retried calls don't create duplicate contacts.
export async function syncCustomerToOdoo(
  prisma: PrismaClient,
  user: { id: string; email: string; firstName: string; lastName: string; phone?: string | null; odooPartnerId?: string | null },
): Promise<void> {
  if (user.odooPartnerId) return
  if (!config.odoo.url || !config.odoo.db || !config.odoo.username || !config.odoo.apiKey || !config.odoo.companyName) {
    throw new Error('Odoo is not configured. Set ODOO_URL, ODOO_DB, ODOO_USERNAME, ODOO_API_KEY, ODOO_COMPANY_NAME in environment variables.')
  }

  const partnerId = await createOdooContact({
    name: `${user.firstName} ${user.lastName}`.trim(),
    email: user.email,
    phone: user.phone,
  })

  await (prisma as any).user.update({
    where: { id: user.id },
    data: { odooPartnerId: String(partnerId) },
  })
}
