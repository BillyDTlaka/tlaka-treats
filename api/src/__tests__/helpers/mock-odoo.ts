/**
 * A tiny in-memory fake of the Odoo JSON-RPC API, installed as global.fetch.
 * Covers exactly the calls odoo-client/odoo-product/odoo-invoice services make,
 * so tests exercise the real client code instead of mocking each service function.
 */
export function installMockOdoo() {
  const state = {
    companyId: 500,
    nextInvoiceId: 900,
    nextProductId: 200,
    invoicesById: new Map<number, any>(),
    productsByCode: new Map<string, any>(),
    searchInvoiceResults: [] as any[],
  }

  ;(global as any).fetch = jest.fn(async (_url: string, opts: any) => {
    const body = JSON.parse(opts.body)
    const { service, method, args } = body.params
    let result: any = null

    if (service === 'common' && method === 'login') {
      result = 1
    } else if (service === 'object' && method === 'execute_kw') {
      const [, , , model, modelMethod, methodArgs] = args

      if (model === 'res.company' && modelMethod === 'search_read') {
        result = [{ id: state.companyId }]
      } else if (model === 'res.partner.category') {
        result = modelMethod === 'search_read' ? [{ id: 77 }] : 77
      } else if (model === 'res.partner' && modelMethod === 'create') {
        result = 555
      } else if (model === 'product.product') {
        if (modelMethod === 'search_read') {
          const code = methodArgs[0][0][2]
          const found = state.productsByCode.get(code)
          result = found ? [found] : []
        } else if (modelMethod === 'create') {
          const vals = methodArgs[0]
          const id = state.nextProductId++
          const rec = { id, name: vals.name, default_code: vals.default_code }
          state.productsByCode.set(vals.default_code, rec)
          result = id
        }
      } else if (model === 'account.move') {
        if (modelMethod === 'search_read') {
          result = state.searchInvoiceResults
        } else if (modelMethod === 'create') {
          const vals = methodArgs[0]
          const id = state.nextInvoiceId++
          const amountTotal = (vals.invoice_line_ids || []).reduce((s: number, l: any) => s + l[2].quantity * l[2].price_unit, 0)
          const rec = {
            id, name: '/', state: 'draft', payment_state: 'not_paid',
            amount_untaxed: amountTotal, amount_tax: 0, amount_total: amountTotal,
            partner_id: [vals.partner_id, ''], invoice_origin: vals.invoice_origin, ref: vals.ref,
            invoice_date: vals.invoice_date,
          }
          state.invoicesById.set(id, rec)
          result = id
        } else if (modelMethod === 'read') {
          const [ids] = methodArgs
          result = ids.map((id: number) => state.invoicesById.get(id)).filter(Boolean)
        } else if (modelMethod === 'write') {
          const [ids, vals] = methodArgs
          const rec = state.invoicesById.get(ids[0])
          if (rec && vals.invoice_line_ids) {
            const addedLines = vals.invoice_line_ids.filter((l: any) => l[0] === 0)
            const amountTotal = addedLines.reduce((s: number, l: any) => s + l[2].quantity * l[2].price_unit, 0)
            rec.amount_total = amountTotal
            rec.amount_untaxed = amountTotal
          }
          result = true
        }
      }
    }

    return { json: async () => ({ jsonrpc: '2.0', id: body.id, result }) }
  })

  return state
}
