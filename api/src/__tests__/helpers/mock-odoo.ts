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
    nextTemplateId: 300,
    nextAttributeId: 10,
    nextAttributeValueId: 1000,
    nextAttributeLineId: 2000,
    invoicesById: new Map<number, any>(),
    productsByCode: new Map<string, any>(),
    productsById: new Map<number, any>(),
    accountsByCode: new Map<string, any>(),
    attributesByName: new Map<string, number>(),
    attributeValuesByKey: new Map<string, number>(),
    templatesById: new Map<number, any>(),
    attributeLinesById: new Map<number, any>(),
    nextTemplateAttrValueId: 3000,
    templateAttributeValuesById: new Map<number, any>(),
    searchInvoiceResults: [] as any[],
    bankJournalId: 700,
    nextPaymentWizardId: 4000,
    paymentWizardsById: new Map<number, any>(),
  }

  // Simulates Odoo auto-generating a product.product, and its product.template.attribute.value
  // junction record (where price_extra lives), for every value on an attribute line.
  function generateVariantsForLine(line: any) {
    for (const valueId of line.value_ids) {
      const exists = [...state.productsById.values()].some(p => p._templateId === line.product_tmpl_id && p._valueId === valueId)
      if (!exists) {
        const id = state.nextProductId++
        state.productsById.set(id, { id, _templateId: line.product_tmpl_id, _valueId: valueId, default_code: false })
      }
      const tavExists = [...state.templateAttributeValuesById.values()].some(
        (v: any) => v.product_tmpl_id === line.product_tmpl_id && v.product_attribute_value_id === valueId,
      )
      if (!tavExists) {
        const id = state.nextTemplateAttrValueId++
        state.templateAttributeValuesById.set(id, { id, product_tmpl_id: line.product_tmpl_id, product_attribute_value_id: valueId, price_extra: 0 })
      }
    }
  }

  function applyAttributeLineCommands(templateId: number, attributeLineIds: any[]) {
    for (const cmd of attributeLineIds) {
      if (cmd[0] !== 0) continue
      const lineId = state.nextAttributeLineId++
      const valueIds = cmd[2].value_ids[0][2] // [[6, 0, [ids]]]
      const line = { id: lineId, product_tmpl_id: templateId, attribute_id: cmd[2].attribute_id, value_ids: [...valueIds] }
      state.attributeLinesById.set(lineId, line)
      generateVariantsForLine(line)
    }
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
      } else if (model === 'account.account' && modelMethod === 'search_read') {
        const code = methodArgs[0][0][2]
        const found = state.accountsByCode.get(code)
        result = found ? [found] : []
      } else if (model === 'product.attribute') {
        if (modelMethod === 'search_read') {
          const name = methodArgs[0][0][2]
          const id = state.attributesByName.get(name)
          result = id ? [{ id }] : []
        } else if (modelMethod === 'create') {
          const id = state.nextAttributeId++
          state.attributesByName.set(methodArgs[0].name, id)
          result = id
        }
      } else if (model === 'product.attribute.value') {
        if (modelMethod === 'search_read') {
          const domain = methodArgs[0]
          const key = `${domain[0][2]}:${domain[1][2]}`
          const id = state.attributeValuesByKey.get(key)
          result = id ? [{ id }] : []
        } else if (modelMethod === 'create') {
          const vals = methodArgs[0]
          const id = state.nextAttributeValueId++
          state.attributeValuesByKey.set(`${vals.attribute_id}:${vals.name}`, id)
          result = id
        }
      } else if (model === 'product.template.attribute.line') {
        if (modelMethod === 'search_read') {
          const domain = methodArgs[0]
          const templateId = domain[0][2]
          const attributeId = domain[1][2]
          const lines = [...state.attributeLinesById.values()].filter(l => l.product_tmpl_id === templateId && l.attribute_id === attributeId)
          result = lines.map(l => ({ id: l.id, value_ids: l.value_ids }))
        } else if (modelMethod === 'write') {
          const [ids, vals] = methodArgs
          const line = state.attributeLinesById.get(ids[0])
          if (line && vals.value_ids) {
            for (const cmd of vals.value_ids) {
              if (cmd[0] === 4 && !line.value_ids.includes(cmd[1])) line.value_ids.push(cmd[1])
            }
            generateVariantsForLine(line)
          }
          result = true
        }
      } else if (model === 'product.template.attribute.value') {
        if (modelMethod === 'search_read') {
          const domain = methodArgs[0]
          const templateId = domain[0][2]
          const valueId = domain[1][2]
          const found = [...state.templateAttributeValuesById.values()].find(
            (v: any) => v.product_tmpl_id === templateId && v.product_attribute_value_id === valueId,
          )
          result = found ? [{ id: found.id }] : []
        } else if (modelMethod === 'write') {
          const [ids, vals] = methodArgs
          const rec = state.templateAttributeValuesById.get(ids[0])
          if (rec && vals.price_extra !== undefined) rec.price_extra = vals.price_extra
          result = true
        }
      } else if (model === 'product.template') {
        if (modelMethod === 'create') {
          const vals = methodArgs[0]
          const id = state.nextTemplateId++
          state.templatesById.set(id, { id, name: vals.name })
          applyAttributeLineCommands(id, vals.attribute_line_ids || [])
          result = id
        } else if (modelMethod === 'write') {
          const [ids, vals] = methodArgs
          if (vals.attribute_line_ids) applyAttributeLineCommands(ids[0], vals.attribute_line_ids)
          result = true
        }
      } else if (model === 'product.product') {
        if (modelMethod === 'search_read') {
          const domain = methodArgs[0]
          const isTemplateVariantLookup = domain.some((c: any) => c[0] === 'product_tmpl_id')
          if (isTemplateVariantLookup) {
            const templateId = domain.find((c: any) => c[0] === 'product_tmpl_id')[2]
            const valueId = domain.find((c: any) => String(c[0]).startsWith('product_template_attribute_value_ids'))[2]
            const found = [...state.productsById.values()].find(p => p._templateId === templateId && p._valueId === valueId)
            result = found ? [{ id: found.id }] : []
          } else {
            const code = domain[0][2]
            const found = state.productsByCode.get(code)
            result = found ? [found] : []
          }
        } else if (modelMethod === 'create') {
          const vals = methodArgs[0]
          const id = state.nextProductId++
          const rec = { id, name: vals.name, default_code: vals.default_code }
          state.productsByCode.set(vals.default_code, rec)
          state.productsById.set(id, rec)
          result = id
        } else if (modelMethod === 'write') {
          const [ids, vals] = methodArgs
          const rec = state.productsById.get(ids[0])
          if (rec && vals.default_code !== undefined) {
            rec.default_code = vals.default_code
            state.productsByCode.set(vals.default_code, rec)
          }
          result = true
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
        } else if (modelMethod === 'button_cancel') {
          const [ids] = methodArgs
          const rec = state.invoicesById.get(ids[0])
          if (rec) rec.state = 'cancel'
          result = true
        }
      } else if (model === 'account.journal' && modelMethod === 'search_read') {
        result = state.bankJournalId ? [{ id: state.bankJournalId }] : []
      } else if (model === 'account.payment.register') {
        if (modelMethod === 'create') {
          const kwargs = args[6] || {}
          const invoiceId = kwargs.context?.active_ids?.[0]
          const id = state.nextPaymentWizardId++
          state.paymentWizardsById.set(id, { id, invoiceId, ...methodArgs[0] })
          result = id
        } else if (modelMethod === 'action_create_payments') {
          const [ids] = methodArgs
          const wizard = state.paymentWizardsById.get(ids[0])
          if (wizard) {
            const rec = state.invoicesById.get(wizard.invoiceId)
            if (rec) rec.payment_state = 'paid'
          }
          result = true
        }
      }
    }

    return { json: async () => ({ jsonrpc: '2.0', id: body.id, result }) }
  })

  return state
}
