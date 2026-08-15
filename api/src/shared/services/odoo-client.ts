import { config } from '../../config'

let cachedUid: number | null = null
let cachedCompanyId: number | null = null

export async function odooRpc<T>(service: string, method: string, args: unknown[]): Promise<T> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), config.odoo.timeoutMs)

  let res: Response
  try {
    res = await fetch(`${config.odoo.url}/jsonrpc`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', method: 'call', params: { service, method, args }, id: Date.now() }),
      signal: controller.signal,
    })
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw new Error(`Odoo request timed out after ${config.odoo.timeoutMs}ms (${service}.${method})`)
    }
    throw err
  } finally {
    clearTimeout(timer)
  }

  const json = await res.json() as any
  if (json.error) {
    throw new Error(json.error.data?.message || json.error.message || 'Odoo RPC error')
  }
  return json.result as T
}

export async function getUid(): Promise<number> {
  if (cachedUid) return cachedUid
  const uid = await odooRpc<number | false>('common', 'login', [config.odoo.db, config.odoo.username, config.odoo.apiKey])
  if (!uid) throw new Error('Odoo authentication failed — check ODOO_DB, ODOO_USERNAME, ODOO_API_KEY')
  cachedUid = uid
  return uid
}

export async function getCompanyId(uid: number): Promise<number> {
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

export function assertOdooConfigured() {
  if (!config.odoo.url || !config.odoo.db || !config.odoo.username || !config.odoo.apiKey || !config.odoo.companyName) {
    throw new Error('Odoo is not configured. Set ODOO_URL, ODOO_DB, ODOO_USERNAME, ODOO_API_KEY, ODOO_COMPANY_NAME in environment variables.')
  }
}

// Exposed for tests only, to reset module-level caches between cases.
export function _resetOdooClientCacheForTests() {
  cachedUid = null
  cachedCompanyId = null
}
