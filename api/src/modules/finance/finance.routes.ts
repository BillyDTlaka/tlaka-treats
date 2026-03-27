import { FastifyInstance } from 'fastify'
import { authenticate, authorize } from '../../shared/middleware/auth'

export default async function financeRoutes(fastify: FastifyInstance) {
  const db = fastify.prisma as any

  const auth = [authenticate, authorize('manage', 'product')]

  // ── DEFAULT CHART OF ACCOUNTS ─────────────────────────────────────────────
  const DEFAULT_ACCOUNTS = [
    // ASSETS
    { code: '1001', name: 'Cash on Hand',        type: 'ASSET',     description: 'Physical cash in the business',           sortOrder: 10 },
    { code: '1010', name: 'Bank Account',         type: 'ASSET',     description: 'Business bank account balance',           sortOrder: 11 },
    { code: '1100', name: 'Accounts Receivable',  type: 'ASSET',     description: 'Money owed to the business by customers', sortOrder: 20 },
    // LIABILITIES
    { code: '2001', name: 'Accounts Payable',     type: 'LIABILITY', description: 'Money owed to suppliers',                 sortOrder: 10 },
    { code: '2100', name: 'VAT Payable',          type: 'LIABILITY', description: 'VAT collected but not yet paid to SARS',  sortOrder: 20 },
    { code: '2200', name: 'Owner Loan',           type: 'LIABILITY', description: 'Funds loaned into the business by owner', sortOrder: 30 },
    // EQUITY
    { code: '3001', name: "Owner's Equity",       type: 'EQUITY',    description: "Owner's investment in the business",      sortOrder: 10 },
    { code: '3100', name: 'Retained Earnings',    type: 'EQUITY',    description: 'Accumulated profits left in the business',sortOrder: 20 },
    // INCOME
    { code: '4001', name: 'Product Sales',        type: 'INCOME',    description: 'Revenue from selling baked goods',        sortOrder: 10 },
    { code: '4002', name: 'Delivery Income',      type: 'INCOME',    description: 'Income earned from delivery fees',        sortOrder: 20 },
    { code: '4099', name: 'Other Income',         type: 'INCOME',    description: 'Any other miscellaneous income',          sortOrder: 99 },
    // EXPENSES
    { code: '5001', name: 'Ingredients',          type: 'EXPENSE',   description: 'Raw ingredients used in production',      sortOrder: 10 },
    { code: '5002', name: 'Packaging',            type: 'EXPENSE',   description: 'Boxes, bags, ribbons, and other packaging',sortOrder: 20 },
    { code: '5003', name: 'Transport & Delivery', type: 'EXPENSE',   description: 'Fuel, courier, and delivery costs',       sortOrder: 30 },
    { code: '5004', name: 'Staff Wages',          type: 'EXPENSE',   description: 'Salaries and wages paid to staff',        sortOrder: 40 },
    { code: '5005', name: 'Rent & Premises',      type: 'EXPENSE',   description: 'Rent, rates, and premises costs',         sortOrder: 50 },
    { code: '5006', name: 'Marketing',            type: 'EXPENSE',   description: 'Advertising, social media, promotions',   sortOrder: 60 },
    { code: '5007', name: 'Utilities',            type: 'EXPENSE',   description: 'Electricity, water, internet, phone',     sortOrder: 70 },
    { code: '5008', name: 'Equipment & Supplies', type: 'EXPENSE',   description: 'Kitchen equipment, tools, small items',   sortOrder: 80 },
    { code: '5009', name: 'Bank Charges',         type: 'EXPENSE',   description: 'Bank fees and transaction charges',       sortOrder: 85 },
    { code: '5099', name: 'Other Expenses',       type: 'EXPENSE',   description: 'Miscellaneous expenses',                  sortOrder: 99 },
  ]

  // ── CHART OF ACCOUNTS ─────────────────────────────────────────────────────

  fastify.get('/accounts', { preHandler: auth }, async () => {
    return db.financeAccount.findMany({
      orderBy: [{ type: 'asc' }, { sortOrder: 'asc' }, { code: 'asc' }],
      include: { _count: { select: { transactions: true } } },
    })
  })

  fastify.post('/accounts', { preHandler: auth }, async (req, reply) => {
    const { code, name, type, description, sortOrder } = req.body as any
    if (!code || !name || !type) return reply.code(400).send({ message: 'code, name, and type are required' })
    const account = await db.financeAccount.create({
      data: { code, name, type, description: description || undefined, sortOrder: sortOrder ?? 0 },
    })
    return reply.code(201).send(account)
  })

  fastify.patch('/accounts/:id', { preHandler: auth }, async (req, reply) => {
    const { id } = req.params as any
    const { code, name, type, description, sortOrder, isActive } = req.body as any
    const data: any = {}
    if (code !== undefined)        data.code = code
    if (name !== undefined)        data.name = name
    if (type !== undefined)        data.type = type
    if (description !== undefined) data.description = description
    if (sortOrder !== undefined)   data.sortOrder = sortOrder
    if (isActive !== undefined)    data.isActive = isActive
    return db.financeAccount.update({ where: { id }, data })
  })

  fastify.delete('/accounts/:id', { preHandler: auth }, async (req, reply) => {
    const { id } = req.params as any
    const account = await db.financeAccount.findUnique({ where: { id }, include: { _count: { select: { transactions: true } } } })
    if (!account) return reply.code(404).send({ message: 'Account not found' })
    if (account.isSystem) return reply.code(400).send({ message: 'System accounts cannot be deleted' })
    if (account._count.transactions > 0) return reply.code(400).send({ message: `Cannot delete — ${account._count.transactions} transaction(s) are linked to this account` })
    await db.financeAccount.delete({ where: { id } })
    return reply.code(204).send()
  })

  // Seed the default Chart of Accounts (skips existing codes)
  fastify.post('/accounts/seed-defaults', { preHandler: auth }, async (req, reply) => {
    let created = 0
    for (const acc of DEFAULT_ACCOUNTS) {
      const exists = await db.financeAccount.findUnique({ where: { code: acc.code } })
      if (!exists) {
        await db.financeAccount.create({ data: { ...acc, isSystem: true } })
        created++
      }
    }
    return { created, message: `${created} default accounts added` }
  })

  // ── DASHBOARD ──────────────────────────────────────────────────────────────

  fastify.get('/dashboard', { preHandler: auth }, async () => {
    const now = new Date()
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const startOfWeek  = new Date(startOfToday); startOfWeek.setDate(startOfToday.getDate() - startOfToday.getDay())
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)

    const [salesToday, salesWeek, salesMonth, expensesMonth, pendingCommissions, bankAccounts] =
      await Promise.all([
        // Sales from orders (total field) — today
        db.order.aggregate({ _sum: { total: true }, where: { createdAt: { gte: startOfToday }, status: { not: 'CANCELLED' } } }),
        // Sales — this week
        db.order.aggregate({ _sum: { total: true }, where: { createdAt: { gte: startOfWeek }, status: { not: 'CANCELLED' } } }),
        // Sales — this month
        db.order.aggregate({ _sum: { total: true }, where: { createdAt: { gte: startOfMonth }, status: { not: 'CANCELLED' } } }),
        // Expenses this month from FinanceTransaction
        db.financeTransaction.aggregate({ _sum: { amount: true }, where: { type: 'EXPENSE', date: { gte: startOfMonth } } }),
        // Pending commissions
        db.commission.aggregate({ _sum: { amount: true }, _count: true, where: { status: 'PENDING' } }),
        // Bank accounts
        db.bankAccount.findMany({ where: { isActive: true }, select: { id: true, name: true, balance: true, bankName: true } }),
      ])

    const totalSalesMonth  = Number(salesMonth._sum.total  || 0)
    const totalExpensesMonth = Number(expensesMonth._sum.amount || 0)

    return {
      totalSalesToday:      Number(salesToday._sum.total  || 0),
      totalSalesWeek:       Number(salesWeek._sum.total   || 0),
      totalSalesMonth,
      totalExpensesMonth,
      netProfit:            totalSalesMonth - totalExpensesMonth,
      pendingCommissionsAmount: Number(pendingCommissions._sum.amount || 0),
      pendingCommissionsCount:  pendingCommissions._count,
      bankAccounts,
    }
  })

  // ── TRANSACTIONS ───────────────────────────────────────────────────────────

  fastify.get('/transactions', { preHandler: auth }, async (req) => {
    const { type, category, from, to, search } = req.query as any
    const where: any = {}
    if (type)     where.type = type
    if (category) where.category = category
    if (from || to) where.date = { ...(from ? { gte: new Date(from) } : {}), ...(to ? { lte: new Date(to) } : {}) }
    if (search)   where.OR = [{ description: { contains: search, mode: 'insensitive' } }, { reference: { contains: search, mode: 'insensitive' } }]

    return db.financeTransaction.findMany({
      where,
      orderBy: { date: 'desc' },
      include: { account: { select: { id: true, code: true, name: true, type: true } }, order: { select: { id: true, total: true } }, bankTxn: { select: { id: true, description: true } } },
    })
  })

  fastify.post('/transactions', { preHandler: auth }, async (req, reply) => {
    const { date, amount, type, category, accountId, description, reference, attachmentUrl, orderId } = req.body as any
    if (!amount || !type || !description) return reply.code(400).send({ message: 'amount, type, description required' })

    // Auto-fill category from account name if accountId provided
    let resolvedCategory = category
    if (accountId && !category) {
      const acct = await db.financeAccount.findUnique({ where: { id: accountId } })
      resolvedCategory = acct?.name || 'Uncategorised'
    }
    if (!resolvedCategory) return reply.code(400).send({ message: 'category or accountId required' })

    const txn = await db.financeTransaction.create({
      data: {
        date: date ? new Date(date) : new Date(),
        amount: Number(amount),
        type,
        category: resolvedCategory,
        accountId: accountId || undefined,
        description,
        reference: reference || undefined,
        attachmentUrl: attachmentUrl || undefined,
        orderId: orderId || undefined,
      },
      include: { account: { select: { id: true, code: true, name: true, type: true } } },
    })
    return reply.code(201).send(txn)
  })

  fastify.patch('/transactions/:id', { preHandler: auth }, async (req, reply) => {
    const { id } = req.params as any
    const { date, amount, type, category, accountId, description, reference, attachmentUrl } = req.body as any
    const data: any = {}
    if (date !== undefined)          data.date = new Date(date)
    if (amount !== undefined)        data.amount = Number(amount)
    if (type !== undefined)          data.type = type
    if (category !== undefined)      data.category = category
    if (accountId !== undefined)     data.accountId = accountId || null
    if (description !== undefined)   data.description = description
    if (reference !== undefined)     data.reference = reference
    if (attachmentUrl !== undefined) data.attachmentUrl = attachmentUrl
    // Re-sync category from account if accountId changed
    if (accountId) {
      const acct = await db.financeAccount.findUnique({ where: { id: accountId } })
      if (acct) data.category = acct.name
    }
    const txn = await db.financeTransaction.update({ where: { id }, data, include: { account: { select: { id: true, code: true, name: true, type: true } } } })
    return txn
  })

  fastify.delete('/transactions/:id', { preHandler: auth }, async (req, reply) => {
    const { id } = req.params as any
    await db.financeTransaction.delete({ where: { id } })
    return reply.code(204).send()
  })

  // ── BANK ACCOUNTS ──────────────────────────────────────────────────────────

  fastify.get('/bank-accounts', { preHandler: auth }, async () => {
    return db.bankAccount.findMany({
      orderBy: { createdAt: 'desc' },
      include: { _count: { select: { transactions: true } } },
    })
  })

  fastify.post('/bank-accounts', { preHandler: auth }, async (req, reply) => {
    const { name, bankName, accountNumber, balance, currency } = req.body as any
    if (!name) return reply.code(400).send({ message: 'name is required' })
    const account = await db.bankAccount.create({
      data: { name, bankName: bankName || undefined, accountNumber: accountNumber || undefined, balance: Number(balance || 0), currency: currency || 'ZAR' },
    })
    return reply.code(201).send(account)
  })

  fastify.patch('/bank-accounts/:id', { preHandler: auth }, async (req, reply) => {
    const { id } = req.params as any
    const { name, bankName, accountNumber, balance, isActive } = req.body as any
    const data: any = {}
    if (name !== undefined)          data.name = name
    if (bankName !== undefined)      data.bankName = bankName
    if (accountNumber !== undefined) data.accountNumber = accountNumber
    if (balance !== undefined)       data.balance = Number(balance)
    if (isActive !== undefined)      data.isActive = isActive
    return db.bankAccount.update({ where: { id }, data })
  })

  // CSV import — parses uploaded CSV text and inserts bank transactions
  fastify.post('/bank-accounts/:id/import-csv', { preHandler: auth }, async (req, reply) => {
    const { id } = req.params as any
    const { csv, dateFormat } = req.body as any   // csv: string (raw CSV text)

    const account = await db.bankAccount.findUnique({ where: { id } })
    if (!account) return reply.code(404).send({ message: 'Bank account not found' })

    const allLines = (csv as string).trim().split('\n').filter(Boolean)
    if (allLines.length < 2) return reply.code(400).send({ message: 'CSV must have a header and at least one row' })

    // Skip leading metadata rows (e.g. "Balance brought forward:,3926.58") — find the first
    // line that contains recognisable column names so the actual header row is always used.
    const KNOWN_COLS = ['date', 'description', 'amount', 'debit', 'credit', 'balance', 'reference', 'narrative']
    const headerLineIdx = allLines.findIndex(line =>
      KNOWN_COLS.some(col => line.toLowerCase().includes(col))
    )
    if (headerLineIdx < 0) return reply.code(400).send({ message: 'Could not find a header row. Ensure CSV has "Date" and "Description" columns.' })

    const lines = allLines.slice(headerLineIdx)

    // Auto-detect header columns (case-insensitive)
    const header = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/"/g, ''))

    const colIdx = (names: string[]) => { for (const n of names) { const i = header.indexOf(n); if (i >= 0) return i } return -1 }

    const dateCol   = colIdx(['date', 'transaction date', 'txn date', 'value date'])
    const descCol   = colIdx(['description', 'narrative', 'details', 'detail', 'particulars'])
    const amtCol    = colIdx(['amount', 'txn amount', 'transaction amount'])
    const feesCol   = colIdx(['fees', 'fee', 'charges', 'bank charges', 'service fee'])
    const debitCol  = colIdx(['debit', 'debit amount', 'withdrawals'])
    const creditCol = colIdx(['credit', 'credit amount', 'deposits'])
    const balCol    = colIdx(['balance', 'closing balance', 'running balance'])
    const refCol    = colIdx(['reference', 'ref', 'cheque no', 'cheque number'])

    if (dateCol < 0 || descCol < 0) return reply.code(400).send({ message: 'Could not detect date/description columns. Ensure CSV has "Date" and "Description" headers.' })

    const parseAmt = (s: string) => {
      if (!s) return 0
      return parseFloat(s.replace(/"/g, '').replace(/,/g, '').replace(/\s/g, '').replace(/[R$€£]/g, '')) || 0
    }

    const parseDate = (s: string) => {
      const clean = s.replace(/"/g, '').trim()
      // Try ISO first, then DD/MM/YYYY, then MM/DD/YYYY
      const iso = new Date(clean)
      if (!isNaN(iso.getTime())) return iso
      const parts = clean.split(/[\/\-\.]/)
      if (parts.length === 3) {
        const [a, b, c] = parts.map(Number)
        // If year is 4 digits in last position: DD/MM/YYYY or MM/DD/YYYY
        if (c > 1000) {
          if (dateFormat === 'MM/DD/YYYY') return new Date(c, a - 1, b)
          return new Date(c, b - 1, a) // default DD/MM/YYYY for ZA
        }
        // Year first: YYYY/MM/DD
        if (a > 1000) return new Date(a, b - 1, c)
      }
      return new Date(clean)
    }

    const rows = lines.slice(1)
    const created: any[] = []
    const skipped: number[] = []
    const errors: string[] = []

    for (let i = 0; i < rows.length; i++) {
      try {
        // Simple CSV split (handles quoted fields with commas)
        const cols = rows[i].match(/(?:"([^"]*)")|([^,]+)|(?=,)|(?<=,)/g)?.map(c => c?.replace(/^"|"$/g, '').trim() ?? '') || rows[i].split(',')

        const rawDate = cols[dateCol] || ''
        const desc    = cols[descCol] || ''
        // Skip rows with no date (e.g. "Total:" summary rows)
        if (!rawDate || !desc) continue

        let amount: number
        if (amtCol >= 0) {
          amount = parseAmt(cols[amtCol])
          // Add fees (e.g. bank service fees in a separate column) to the base amount
          if (feesCol >= 0) amount += parseAmt(cols[feesCol])
        } else if (debitCol >= 0 && creditCol >= 0) {
          const debit  = parseAmt(cols[debitCol])
          const credit = parseAmt(cols[creditCol])
          amount = credit - debit // positive = credit, negative = debit
        } else {
          continue
        }

        const balance = balCol >= 0 ? parseAmt(cols[balCol]) : null
        const ref     = refCol >= 0 ? cols[refCol] : null

        // Duplicate guard — skip if an identical transaction already exists for this account
        const date = parseDate(rawDate)
        const existing = await db.bankTransaction.findFirst({
          where: { bankAccountId: id, date, amount, description: desc },
        })
        if (existing) { skipped.push(i + 2); continue }

        created.push(await db.bankTransaction.create({
          data: {
            bankAccountId: id,
            date,
            description: desc,
            amount,
            balance: balance !== null ? balance : undefined,
            reference: ref || undefined,
            status: 'UNMATCHED',
          },
        }))
      } catch (e: any) {
        errors.push(`Row ${i + 2}: ${e.message}`)
      }
    }

    return { imported: created.length, skipped: skipped.length, errors }
  })

  // ── BANK TRANSACTIONS ──────────────────────────────────────────────────────

  fastify.get('/bank-transactions', { preHandler: auth }, async (req) => {
    const { bankAccountId, status } = req.query as any
    const where: any = {}
    if (bankAccountId) where.bankAccountId = bankAccountId
    if (status)        where.status = status
    return db.bankTransaction.findMany({
      where,
      orderBy: { date: 'desc' },
      include: {
        bankAccount: { select: { id: true, name: true } },
        transaction: { select: { id: true, category: true, description: true, type: true } },
      },
    })
  })

  // Match a bank transaction to a finance transaction
  fastify.patch('/bank-transactions/:id/match', { preHandler: auth }, async (req, reply) => {
    const { id } = req.params as any
    const { financeTransactionId } = req.body as any
    if (!financeTransactionId) return reply.code(400).send({ message: 'financeTransactionId required' })

    // Link financeTransaction.bankTxnId → id, and set status MATCHED
    await db.financeTransaction.update({ where: { id: financeTransactionId }, data: { bankTxnId: id } })
    const updated = await db.bankTransaction.update({ where: { id }, data: { status: 'MATCHED' } })
    return updated
  })

  fastify.patch('/bank-transactions/:id/unmatch', { preHandler: auth }, async (req, reply) => {
    const { id } = req.params as any
    // Remove link on the finance transaction
    const txn = await db.financeTransaction.findFirst({ where: { bankTxnId: id } })
    if (txn) await db.financeTransaction.update({ where: { id: txn.id }, data: { bankTxnId: null } })
    const updated = await db.bankTransaction.update({ where: { id }, data: { status: 'UNMATCHED' } })
    return updated
  })

  fastify.patch('/bank-transactions/:id/ignore', { preHandler: auth }, async (req, reply) => {
    const { id } = req.params as any
    return db.bankTransaction.update({ where: { id }, data: { status: 'IGNORED' } })
  })

  // ── COMMISSIONS (finance view) ─────────────────────────────────────────────

  fastify.get('/commissions', { preHandler: auth }, async (req) => {
    const { status, ambassadorId } = req.query as any
    const where: any = {}
    if (status)      where.status = status
    if (ambassadorId) where.ambassadorId = ambassadorId

    const [commissions, summary] = await Promise.all([
      db.commission.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        include: {
          ambassador: { include: { user: { select: { firstName: true, lastName: true, email: true } } } },
          order: { select: { id: true, total: true, createdAt: true } },
          payout: { select: { id: true, createdAt: true, reference: true } },
        },
      }),
      db.commission.groupBy({
        by: ['status'],
        _sum: { amount: true },
        _count: true,
      }),
    ])

    return { commissions, summary }
  })

  fastify.post('/payouts', { preHandler: auth }, async (req, reply) => {
    const { ambassadorId, commissionIds, method, reference, notes } = req.body as any
    if (!ambassadorId || !commissionIds?.length) return reply.code(400).send({ message: 'ambassadorId and commissionIds required' })

    // Sum total
    const commissions = await db.commission.findMany({ where: { id: { in: commissionIds }, ambassadorId, status: { not: 'PAID' } } })
    if (!commissions.length) return reply.code(400).send({ message: 'No eligible commissions found' })

    const total = commissions.reduce((s: number, c: any) => s + Number(c.amount), 0)

    const payout = await db.payout.create({
      data: {
        ambassadorId,
        amount: total,
        method: method || 'bank_transfer',
        reference: reference || undefined,
        notes: notes || undefined,
        status: 'COMPLETED',
        commissions: { connect: commissionIds.map((id: string) => ({ id })) },
      },
    })

    // Mark commissions as PAID
    await db.commission.updateMany({ where: { id: { in: commissionIds } }, data: { status: 'PAID', payoutId: payout.id } })

    return reply.code(201).send(payout)
  })

  fastify.get('/payouts', { preHandler: auth }, async () => {
    return db.payout.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        ambassador: { include: { user: { select: { firstName: true, lastName: true, email: true } } } },
        commissions: { select: { id: true, amount: true, orderId: true } },
      },
    })
  })

  // ── REPORTS ────────────────────────────────────────────────────────────────

  // Profit & Loss: sales vs expenses over a date range
  fastify.get('/reports/pnl', { preHandler: auth }, async (req) => {
    const { from, to } = req.query as any
    const dateFilter: any = {}
    if (from) dateFilter.gte = new Date(from)
    if (to)   dateFilter.lte = new Date(to)

    const [sales, expenses] = await Promise.all([
      db.order.aggregate({
        _sum: { total: true },
        where: { status: { not: 'CANCELLED' }, ...(Object.keys(dateFilter).length ? { createdAt: dateFilter } : {}) },
      }),
      db.financeTransaction.findMany({
        where: { type: 'EXPENSE', ...(Object.keys(dateFilter).length ? { date: dateFilter } : {}) },
        select: { category: true, amount: true, date: true, description: true },
      }),
    ])

    const totalSales    = Number(sales._sum.total || 0)
    const totalExpenses = expenses.reduce((s: number, e: any) => s + Number(e.amount), 0)

    // Group expenses by category
    const byCategory: Record<string, number> = {}
    for (const e of expenses) {
      byCategory[e.category] = (byCategory[e.category] || 0) + Number(e.amount)
    }

    return {
      totalSales,
      totalExpenses,
      grossProfit: totalSales - totalExpenses,
      expensesByCategory: Object.entries(byCategory).map(([category, amount]) => ({ category, amount })).sort((a, b) => (b.amount as number) - (a.amount as number)),
    }
  })

  // Monthly cashflow — last 12 months
  fastify.get('/reports/cashflow', { preHandler: auth }, async (req) => {
    const { months: monthCount } = req.query as any
    const count = Math.min(parseInt(monthCount || '12', 10), 24)
    const months: Array<{ label: string; income: number; expenses: number; net: number }> = []

    for (let m = count - 1; m >= 0; m--) {
      const now = new Date()
      const start = new Date(now.getFullYear(), now.getMonth() - m, 1)
      const end   = new Date(now.getFullYear(), now.getMonth() - m + 1, 0, 23, 59, 59)
      const label = start.toLocaleString('default', { month: 'short', year: '2-digit' })

      const [sales, expenses] = await Promise.all([
        db.order.aggregate({ _sum: { total: true }, where: { createdAt: { gte: start, lte: end }, status: { not: 'CANCELLED' } } }),
        db.financeTransaction.aggregate({ _sum: { amount: true }, where: { type: 'EXPENSE', date: { gte: start, lte: end } } }),
      ])

      const income   = Number(sales._sum.total    || 0)
      const expAmt   = Number(expenses._sum.amount || 0)
      months.push({ label, income, expenses: expAmt, net: income - expAmt })
    }

    return months
  })

  // Expense breakdown by category
  fastify.get('/reports/expenses', { preHandler: auth }, async (req) => {
    const { from, to } = req.query as any
    const dateFilter: any = {}
    if (from) dateFilter.gte = new Date(from)
    if (to)   dateFilter.lte = new Date(to)

    const expenses = await db.financeTransaction.findMany({
      where: { type: 'EXPENSE', ...(Object.keys(dateFilter).length ? { date: dateFilter } : {}) },
      select: { category: true, amount: true, date: true, description: true, reference: true },
      orderBy: { date: 'desc' },
    })

    const byCategory: Record<string, number> = {}
    for (const e of expenses) byCategory[e.category] = (byCategory[e.category] || 0) + Number(e.amount)

    return {
      items: expenses,
      summary: Object.entries(byCategory).map(([category, amount]) => ({ category, amount })).sort((a, b) => (b.amount as number) - (a.amount as number)),
      total: expenses.reduce((s: number, e: any) => s + Number(e.amount), 0),
    }
  })

  // Ambassador commission report
  fastify.get('/reports/commissions', { preHandler: auth }, async () => {
    const ambassadors = await db.ambassador.findMany({
      include: {
        user: { select: { firstName: true, lastName: true, email: true } },
        commissions: { select: { amount: true, status: true } },
        payouts: { select: { amount: true, status: true, createdAt: true } },
      },
    })

    return ambassadors.map((a: any) => ({
      id: a.id,
      code: a.code,
      name: `${a.user.firstName} ${a.user.lastName}`,
      email: a.user.email,
      totalEarned: a.commissions.reduce((s: number, c: any) => s + Number(c.amount), 0),
      totalPaid:   a.commissions.filter((c: any) => c.status === 'PAID').reduce((s: number, c: any) => s + Number(c.amount), 0),
      totalPending: a.commissions.filter((c: any) => c.status === 'PENDING').reduce((s: number, c: any) => s + Number(c.amount), 0),
      payoutsCount: a.payouts.length,
    }))
  })

  // Sales report — revenue breakdown by product variant and ambassador
  fastify.get('/reports/sales', { preHandler: auth }, async (req) => {
    const { from, to } = req.query as any
    const dateFilter: any = {}
    if (from) dateFilter.gte = new Date(from)
    if (to)   dateFilter.lte = new Date(to)
    const orderWhere: any = { status: { not: 'CANCELLED' } }
    if (Object.keys(dateFilter).length) orderWhere.createdAt = dateFilter

    const [orders, orderItems] = await Promise.all([
      db.order.findMany({
        where: orderWhere,
        select: {
          id: true, total: true, subtotal: true, deliveryFee: true, createdAt: true,
          status: true, ambassadorId: true,
          ambassador: { select: { code: true, user: { select: { firstName: true, lastName: true } } } },
          items: { select: { quantity: true, unitPrice: true, subtotal: true, variant: { select: { name: true, product: { select: { name: true } } } } } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      db.orderItem.groupBy({
        by: ['variantId'],
        _sum: { quantity: true, subtotal: true },
        _count: true,
        where: { order: orderWhere },
      }),
    ])

    // Enrich variant groups with product names
    const variantIds = orderItems.map((i: any) => i.variantId)
    const variants = variantIds.length ? await db.productVariant.findMany({
      where: { id: { in: variantIds } },
      select: { id: true, name: true, product: { select: { name: true } } },
    }) : []
    const variantMap: Record<string, any> = {}
    variants.forEach((v: any) => { variantMap[v.id] = v })

    // Daily sales totals
    const dailyMap: Record<string, number> = {}
    orders.forEach((o: any) => {
      const day = new Date(o.createdAt).toISOString().slice(0, 10)
      dailyMap[day] = (dailyMap[day] || 0) + Number(o.total)
    })

    return {
      totalRevenue:   orders.reduce((s: number, o: any) => s + Number(o.total), 0),
      totalOrders:    orders.length,
      avgOrderValue:  orders.length ? orders.reduce((s: number, o: any) => s + Number(o.total), 0) / orders.length : 0,
      topProducts: orderItems
        .map((i: any) => ({
          variantId:   i.variantId,
          productName: variantMap[i.variantId]?.product?.name || 'Unknown',
          variantName: variantMap[i.variantId]?.name || '',
          totalQty:    Number(i._sum.quantity || 0),
          totalRevenue:Number(i._sum.subtotal || 0),
          orderCount:  i._count,
        }))
        .sort((a: any, b: any) => b.totalRevenue - a.totalRevenue),
      dailySales: Object.entries(dailyMap)
        .map(([date, amount]) => ({ date, amount }))
        .sort((a, b) => a.date.localeCompare(b.date)),
      orders,
    }
  })

  // Account statement — all transactions for a specific account or all accounts
  fastify.get('/reports/account-statement', { preHandler: auth }, async (req) => {
    const { accountId, from, to } = req.query as any
    const where: any = {}
    if (accountId) where.accountId = accountId
    if (from || to) where.date = { ...(from ? { gte: new Date(from) } : {}), ...(to ? { lte: new Date(to) } : {}) }

    const transactions = await db.financeTransaction.findMany({
      where,
      orderBy: { date: 'asc' },
      include: {
        account: { select: { id: true, code: true, name: true, type: true } },
        order:   { select: { id: true, total: true } },
      },
    })

    // Compute running balance per account
    let runningBalance = 0
    const rows = transactions.map((t: any) => {
      const signed = t.type === 'INCOME' ? Number(t.amount) : -Number(t.amount)
      runningBalance += signed
      return { ...t, amount: Number(t.amount), signedAmount: signed, runningBalance }
    })

    const totalIncome  = transactions.filter((t: any) => t.type === 'INCOME').reduce((s: number, t: any) => s + Number(t.amount), 0)
    const totalExpense = transactions.filter((t: any) => t.type === 'EXPENSE').reduce((s: number, t: any) => s + Number(t.amount), 0)

    return { rows, totalIncome, totalExpense, netBalance: totalIncome - totalExpense }
  })
}
