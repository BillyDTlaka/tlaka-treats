/**
 * E2E tests for all Tlaka Treats admin dashboard modules.
 * All API calls to https://tlaka-treats-production.up.railway.app are mocked
 * via page.route() so tests run entirely offline.
 *
 * Modules tested: Dashboard, Sales (Orders/Customers/Ambassadors),
 * Catalogue (Products/Recipes), Operations (Production/Inventory/Suppliers),
 * Finance, Reports, People, Settings, Users
 */
import { test, expect, Page } from '@playwright/test'

const API = 'https://tlaka-treats-production.up.railway.app'
const ADMIN_USER = { id: 'u1', roles: ['ADMIN'], email: 'admin@test.com', firstName: 'Admin', lastName: 'User' }

// ── Shared fixtures ────────────────────────────────────────────────────────────

const makeOrder = (id = 'o1', status = 'PENDING') => ({
  id, status, total: '150.00', createdAt: new Date().toISOString(),
  customer: { id: 'c1', firstName: 'Nomsa', lastName: 'D', email: 'n@test.com', phone: '082' },
  ambassador: null, items: [],
})

const makeProduct = (id = 'p1') => ({
  id, name: `Choc Chip Cookies`, isActive: true,
  category: { id: 'cat1', name: 'Cookies' },
  variants: [{ id: 'v1', name: '12 Pack', isActive: true, prices: [{ tier: 'RETAIL', price: '85.00' }] }],
  images: [], description: 'Delicious', sku: null, brand: null, supplier: null,
  updatedAt: new Date().toISOString(),
})

const makeAmbassador = (id = 'a1') => ({
  id, code: 'TT-TEST0001', status: 'ACTIVE', fullName: 'Zanele Mokoena',
  email: 'zanele@test.com', phone: '082', commissionRate: 0.1,
  kycStatus: 'NOT_SUBMITTED', totalCommission: 0, orders: [],
  createdAt: new Date().toISOString(),
})

const makeCustomer = (id = 'c1') => ({
  id, firstName: 'Nomsa', lastName: 'Dlamini', email: 'nomsa@test.com',
  phone: '082', status: 'ACTIVE', roles: ['CUSTOMER'],
  createdAt: new Date().toISOString(), orders: [],
})

const makeQuote = (id = 'q1') => ({
  id, status: 'DRAFT', total: '200.00',
  customer: { firstName: 'Test', lastName: 'User' },
  items: [], createdAt: new Date().toISOString(),
})

const makeRecipe = (id = 'r1') => ({
  id, name: 'Choc Chip Cookie Recipe', isActive: true,
  yieldQty: 24, yieldUom: { abbreviation: 'pcs' },
  ingredients: [], instructions: '', notes: '',
})

const makeStockItem = (id = 's1') => ({
  id, name: 'Flour', currentStock: 5, minLevel: 2,
  unitCost: '25.00', uom: { abbreviation: 'kg' },
  isActive: true, updatedAt: new Date().toISOString(),
})

const makeProductionRun = (id = 'pr1') => ({
  id, status: 'PLANNED', batches: 2,
  plannedDate: new Date().toISOString(),
  recipe: { id: 'r1', name: 'Choc Chip Recipe', yieldQty: 24, yieldUom: { abbreviation: 'pcs' } },
  ingredients: [],
})

const makeSupplier = (id = 'sup1') => ({
  id, name: 'ABC Supplies', contactName: 'John', phone: '011', email: 'abc@test.com',
  city: 'Johannesburg', status: 'ACTIVE', notes: '', purchaseOrders: [],
})

const FINANCE_DASHBOARD = {
  salesToday: 1500, salesWeek: 8500, salesMonth: 32000,
  expensesMonth: 12000, profitMonth: 20000,
  pendingCommissions: 1200, commissionsToApprove: 3,
}

// ── Setup helpers ─────────────────────────────────────────────────────────────

async function setupAdmin(page: Page, extraRoutes?: (page: Page) => Promise<void>) {
  // Catch-all first (LIFO — specific routes registered after take precedence)
  await page.route(`${API}/**`, (r) =>
    r.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
  )

  // Core admin data endpoints
  await page.route(`${API}/orders`, (r) =>
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([makeOrder()]) })
  )
  await page.route(`${API}/ambassadors`, (r) =>
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([makeAmbassador()]) })
  )
  await page.route(`${API}/products/admin`, (r) =>
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([makeProduct()]) })
  )
  await page.route(`${API}/customers`, (r) =>
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([makeCustomer()]) })
  )
  await page.route(`${API}/quotes`, (r) =>
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([makeQuote()]) })
  )
  await page.route(`${API}/recipes`, (r) =>
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([makeRecipe()]) })
  )
  await page.route(`${API}/inventory`, (r) =>
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([makeStockItem()]) })
  )
  await page.route(`${API}/suppliers`, (r) =>
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([makeSupplier()]) })
  )
  await page.route(`${API}/production`, (r) =>
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([makeProductionRun()]) })
  )
  await page.route(`${API}/finance/dashboard`, (r) =>
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(FINANCE_DASHBOARD) })
  )
  await page.route(`${API}/users`, (r) =>
    r.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
  )
  await page.route(`${API}/users/roles`, (r) =>
    r.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
  )

  if (extraRoutes) await extraRoutes(page)

  // Pre-set admin session
  await page.addInitScript((user) => {
    localStorage.setItem('tt_token', 'test-jwt')
    localStorage.setItem('tt_user', JSON.stringify(user))
  }, ADMIN_USER)

  await page.goto('/')
  await page.waitForSelector('text=Admin Console', { timeout: 8000 })
}

async function clickModule(page: Page, label: string) {
  await page.getByRole('button', { name: label }).click()
}

// ── DASHBOARD ─────────────────────────────────────────────────────────────────

test.describe('Admin — Dashboard module', () => {
  test('DASH-01 — shows Total Revenue KPI', async ({ page }) => {
    await setupAdmin(page)
    await expect(page.getByText('Total Revenue')).toBeVisible({ timeout: 5000 })
  })

  test('DASH-02 — shows Total Orders KPI', async ({ page }) => {
    await setupAdmin(page)
    await expect(page.getByText('Total Orders')).toBeVisible()
  })

  test('DASH-03 — shows Pending Orders KPI', async ({ page }) => {
    await setupAdmin(page)
    await expect(page.getByText('Pending Orders')).toBeVisible()
  })

  test('DASH-04 — shows Active Ambassadors KPI', async ({ page }) => {
    await setupAdmin(page)
    await expect(page.getByText('Active Ambassadors')).toBeVisible()
  })

  test('DASH-05 — shows date filter presets', async ({ page }) => {
    await setupAdmin(page)
    await expect(page.getByText('All Time')).toBeVisible()
    await expect(page.getByText('Today')).toBeVisible()
    await expect(page.getByText('7 Days')).toBeVisible()
    await expect(page.getByText('30 Days')).toBeVisible()
  })

  test('DASH-06 — shows Recent Orders section', async ({ page }) => {
    await setupAdmin(page)
    await expect(page.getByText('Recent Orders')).toBeVisible({ timeout: 5000 })
  })
})

// ── SALES ─────────────────────────────────────────────────────────────────────

test.describe('Admin — Sales module', () => {
  test.beforeEach(async ({ page }) => {
    await setupAdmin(page)
    await clickModule(page, 'Sales')
    await page.waitForTimeout(300)
  })

  test('SALES-01 — shows Sales module with Orders/Customers/Ambassadors tabs', async ({ page }) => {
    await expect(page.getByRole('tab', { name: /Orders/i }).or(page.getByText(/🛒 Orders/))).toBeVisible({ timeout: 5000 })
  })

  test('SALES-02 — Orders tab shows status filter chips', async ({ page }) => {
    await expect(page.getByText('PENDING').first()).toBeVisible({ timeout: 5000 })
    await expect(page.getByText('CONFIRMED')).toBeVisible()
    await expect(page.getByText('DELIVERED')).toBeVisible()
    await expect(page.getByText('CANCELLED')).toBeVisible()
  })

  test('SALES-03 — Orders tab shows Place Order button', async ({ page }) => {
    await expect(page.getByText('+ Place Order').or(page.getByText('Place Order'))).toBeVisible({ timeout: 5000 })
  })

  test('SALES-04 — Orders tab shows order search box', async ({ page }) => {
    await expect(page.getByPlaceholder(/search.*customer.*name/i)).toBeVisible({ timeout: 5000 })
  })

  test('SALES-05 — Customers tab shows customer list', async ({ page }) => {
    await page.getByText(/👤 Customers|Customers/).click()
    await expect(page.getByText('Total Customers')).toBeVisible({ timeout: 5000 })
    await expect(page.getByPlaceholder(/search by name/i)).toBeVisible()
  })

  test('SALES-06 — Ambassadors tab shows ambassador list with registration link', async ({ page }) => {
    await page.getByText(/⭐ Ambassadors|Ambassadors/).click()
    await expect(page.getByText('Ambassador Registration Link')).toBeVisible({ timeout: 5000 })
  })

  test('SALES-07 — Ambassadors tab shows KPI summary chips', async ({ page }) => {
    await page.getByText(/⭐ Ambassadors|Ambassadors/).click()
    await expect(page.getByText('Pending Approval')).toBeVisible({ timeout: 5000 })
  })
})

// ── CATALOGUE ─────────────────────────────────────────────────────────────────

test.describe('Admin — Catalogue module', () => {
  test.beforeEach(async ({ page }) => {
    await setupAdmin(page)
    await clickModule(page, 'Catalogue')
    await page.waitForTimeout(300)
  })

  test('CAT-01 — shows Products tab with search box', async ({ page }) => {
    await expect(page.getByPlaceholder('Search by name…').or(page.getByPlaceholder('Search by name'))).toBeVisible({ timeout: 5000 })
  })

  test('CAT-02 — Products tab shows status filter', async ({ page }) => {
    await expect(page.getByRole('combobox').first()).toBeVisible({ timeout: 5000 })
  })

  test('CAT-03 — Products tab renders loaded product', async ({ page }) => {
    await expect(page.getByText('Choc Chip Cookies')).toBeVisible({ timeout: 5000 })
  })

  test('CAT-04 — Products tab shows Active badge', async ({ page }) => {
    await expect(page.locator('span.rounded-full', { hasText: /^Active$/ }).first()).toBeVisible({ timeout: 5000 })
  })

  test('CAT-05 — Recipes tab shows recipe summary chips', async ({ page }) => {
    await page.getByText(/📋 Recipes|Recipes/).click()
    await expect(page.getByText('Total Recipes')).toBeVisible({ timeout: 5000 })
    await expect(page.getByText('+ New Recipe')).toBeVisible()
  })

  test('CAT-06 — Recipes tab renders loaded recipe', async ({ page }) => {
    await page.getByText(/📋 Recipes|Recipes/).click()
    await expect(page.getByText('Choc Chip Cookie Recipe')).toBeVisible({ timeout: 5000 })
  })
})

// ── OPERATIONS ────────────────────────────────────────────────────────────────

test.describe('Admin — Operations module', () => {
  test.beforeEach(async ({ page }) => {
    await setupAdmin(page)
    await clickModule(page, 'Operations')
    await page.waitForTimeout(300)
  })

  test('OPS-01 — Production tab shows KPI summary chips', async ({ page }) => {
    await expect(page.getByText('Total Runs')).toBeVisible({ timeout: 5000 })
    await expect(page.getByText('+ New Production Run')).toBeVisible()
  })

  test('OPS-02 — Production tab renders loaded run', async ({ page }) => {
    await expect(page.getByText('Choc Chip Recipe')).toBeVisible({ timeout: 5000 })
  })

  test('OPS-03 — Inventory tab shows KPI chips and sub-tabs', async ({ page }) => {
    await page.getByText(/🏪 Inventory|Inventory/).click()
    await expect(page.getByText('Total Items')).toBeVisible({ timeout: 5000 })
    await expect(page.getByText('Low Stock')).toBeVisible()
    await expect(page.getByText('Out of Stock')).toBeVisible()
  })

  test('OPS-04 — Inventory tab renders stock item', async ({ page }) => {
    await page.getByText(/🏪 Inventory|Inventory/).click()
    await expect(page.getByText('Flour')).toBeVisible({ timeout: 5000 })
  })

  test('OPS-05 — Inventory tab shows sub-tabs', async ({ page }) => {
    await page.getByText(/🏪 Inventory|Inventory/).click()
    await expect(page.getByText('📦 Stock Items')).toBeVisible({ timeout: 5000 })
    await expect(page.getByText('📋 Movements')).toBeVisible()
    await expect(page.getByText('🔢 Stock Take')).toBeVisible()
  })

  test('OPS-06 — Suppliers tab shows KPI chips', async ({ page }) => {
    await page.getByText(/🚚 Suppliers|Suppliers/).click()
    await expect(page.getByText('Total Suppliers')).toBeVisible({ timeout: 5000 })
    await expect(page.getByText('Total POs')).toBeVisible()
  })

  test('OPS-07 — Suppliers tab renders loaded supplier', async ({ page }) => {
    await page.getByText(/🚚 Suppliers|Suppliers/).click()
    await expect(page.getByText('ABC Supplies')).toBeVisible({ timeout: 5000 })
  })

  test('OPS-08 — Suppliers tab shows Purchase Orders sub-tab', async ({ page }) => {
    await page.getByText(/🚚 Suppliers|Suppliers/).click()
    await expect(page.getByText('📋 Purchase Orders')).toBeVisible({ timeout: 5000 })
  })
})

// ── FINANCE ───────────────────────────────────────────────────────────────────

test.describe('Admin — Finance module', () => {
  test.beforeEach(async ({ page }) => {
    await setupAdmin(page, async (p) => {
      await p.route(`${API}/finance/accounts`, (r) =>
        r.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
      )
      await p.route(`${API}/finance/bank-accounts`, (r) =>
        r.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
      )
      await p.route(`${API}/finance/transactions`, (r) =>
        r.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
      )
      await p.route(`${API}/finance/commissions`, (r) =>
        r.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
      )
    })
    await clickModule(page, 'Finance')
    await page.waitForTimeout(500)
  })

  test('FIN-01 — shows Finance tab bar', async ({ page }) => {
    await expect(page.getByRole('button', { name: '📊 Dashboard' })).toBeVisible({ timeout: 5000 })
  })

  test('FIN-02 — Finance Dashboard shows Sales Today KPI', async ({ page }) => {
    await expect(page.getByText('Sales Today')).toBeVisible({ timeout: 5000 })
  })

  test('FIN-03 — Finance Dashboard shows Sales This Week KPI', async ({ page }) => {
    await expect(page.getByText('Sales This Week')).toBeVisible({ timeout: 5000 })
  })

  test('FIN-04 — Finance Dashboard shows Net Profit KPI', async ({ page }) => {
    await expect(page.getByText('Net Profit (Month)').or(page.getByText('Net Profit'))).toBeVisible({ timeout: 5000 })
  })

  test('FIN-05 — Transactions tab is accessible', async ({ page }) => {
    await page.getByText('💳 Transactions').click()
    await expect(page.getByText(/Transactions|Date|Amount/i).first()).toBeVisible({ timeout: 5000 })
  })

  test('FIN-06 — Commissions tab is accessible', async ({ page }) => {
    await page.getByText('🤝 Commissions').click()
    await expect(page.getByText(/Commission|Ambassador|Payout/i).first()).toBeVisible({ timeout: 5000 })
  })
})

// ── REPORTS ───────────────────────────────────────────────────────────────────

test.describe('Admin — Reports module', () => {
  test.beforeEach(async ({ page }) => {
    await setupAdmin(page)
    await clickModule(page, 'Reports')
    await page.waitForTimeout(300)
  })

  test('REP-01 — shows Sales, Finance, Inventory, Production tabs', async ({ page }) => {
    await expect(page.getByText('Sales').first()).toBeVisible({ timeout: 5000 })
    await expect(page.getByText('Finance').first()).toBeVisible()
    await expect(page.getByText('Inventory').first()).toBeVisible()
    await expect(page.getByText('Production').first()).toBeVisible()
  })

  test('REP-02 — Sales tab shows Total Revenue KPI', async ({ page }) => {
    await expect(page.getByText('Total Revenue')).toBeVisible({ timeout: 5000 })
  })

  test('REP-03 — Sales tab shows Delivered Orders KPI', async ({ page }) => {
    await expect(page.getByText('Delivered Orders')).toBeVisible({ timeout: 5000 })
  })

  test('REP-04 — Sales tab shows Monthly Revenue chart label', async ({ page }) => {
    await expect(page.getByText(/Monthly Revenue/i)).toBeVisible({ timeout: 5000 })
  })

  test('REP-05 — Sales tab shows Orders by Status section', async ({ page }) => {
    await expect(page.getByText('Orders by Status')).toBeVisible({ timeout: 5000 })
  })

  test('REP-06 — Sales tab shows Top Products section', async ({ page }) => {
    await expect(page.getByText('Top Products by Revenue')).toBeVisible({ timeout: 5000 })
  })
})

// ── PEOPLE ────────────────────────────────────────────────────────────────────

test.describe('Admin — People module', () => {
  test.beforeEach(async ({ page }) => {
    await setupAdmin(page, async (p) => {
      await p.route(`${API}/company`, (r) =>
        r.fulfill({
          status: 200, contentType: 'application/json',
          body: JSON.stringify({ name: 'Tlaka Treats', tradingName: '', registrationNo: '', vatNo: '', phone: '', email: '', website: '', address: '' }),
        })
      )
      await p.route(`${API}/employees`, (r) =>
        r.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
      )
      await p.route(`${API}/departments`, (r) =>
        r.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
      )
      await p.route(`${API}/tasks`, (r) =>
        r.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
      )
      await p.route(`${API}/tasks/counts`, (r) =>
        r.fulfill({ status: 200, contentType: 'application/json', body: '{}' })
      )
    })
    await clickModule(page, 'People')
    await page.waitForTimeout(500)
  })

  test('PPL-01 — shows People sidebar with section links', async ({ page }) => {
    await expect(page.getByRole('button', { name: 'Company' })).toBeVisible({ timeout: 5000 })
    await expect(page.getByRole('button', { name: 'Staff' })).toBeVisible()
  })

  test('PPL-02 — Company section shows Company Profile form', async ({ page }) => {
    await page.getByRole('button', { name: 'Company' }).click()
    await expect(page.getByText('🏢 Company Profile')).toBeVisible({ timeout: 5000 })
    await expect(page.getByText('Company Name')).toBeVisible()
  })

  test('PPL-03 — Company section shows Edit button', async ({ page }) => {
    await page.getByRole('button', { name: 'Company' }).click()
    await expect(page.getByRole('button', { name: '✏️ Edit' })).toBeVisible({ timeout: 5000 })
  })

  test('PPL-04 — Staff section loads and shows table headers', async ({ page }) => {
    await page.getByText('👥 Staff').click()
    await expect(page.getByText(/Status|No employees found|Employee/i).first()).toBeVisible({ timeout: 5000 })
  })

  test('PPL-05 — Leave section is accessible', async ({ page }) => {
    await page.getByRole('button', { name: 'Leave' }).click()
    await expect(page.getByText(/Leave|Pending|Approved|Rejected/i).first()).toBeVisible({ timeout: 5000 })
  })
})

// ── SETTINGS ──────────────────────────────────────────────────────────────────

test.describe('Admin — Settings module', () => {
  test.beforeEach(async ({ page }) => {
    await setupAdmin(page)
    await clickModule(page, 'Settings')
    await page.waitForTimeout(300)
  })

  test('SET-01 — shows Store Information section', async ({ page }) => {
    await expect(page.getByText('Store Information')).toBeVisible({ timeout: 5000 })
    await expect(page.getByText('Business Name')).toBeVisible()
  })

  test('SET-02 — shows Save Store Info button', async ({ page }) => {
    await expect(page.getByText('Save Store Info')).toBeVisible({ timeout: 5000 })
  })

  test('SET-03 — shows Ambassador Programme section', async ({ page }) => {
    await expect(page.getByText('Ambassador Programme')).toBeVisible({ timeout: 5000 })
    await expect(page.getByText(/Default Commission %/i)).toBeVisible()
  })

  test('SET-04 — shows Order Status Workflow section', async ({ page }) => {
    await expect(page.getByText('Order Status Workflow')).toBeVisible({ timeout: 5000 })
    await expect(page.getByText('PENDING').first()).toBeVisible()
    await expect(page.getByText('BAKING')).toBeVisible()
    await expect(page.getByText('DELIVERED', { exact: true })).toBeVisible()
  })

  test('SET-05 — shows Notifications section with toggles', async ({ page }) => {
    await expect(page.getByText('Notifications')).toBeVisible({ timeout: 5000 })
    await expect(page.getByText('New Order', { exact: true })).toBeVisible()
    await expect(page.getByText('Low Stock Warning')).toBeVisible()
    await expect(page.getByText('Save Notification Settings')).toBeVisible()
  })

  test('SET-06 — shows Discount Rules section', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Discount Rules' })).toBeVisible({ timeout: 5000 })
  })
})

// ── USERS ─────────────────────────────────────────────────────────────────────

test.describe('Admin — Users module', () => {
  test.beforeEach(async ({ page }) => {
    await setupAdmin(page, async (p) => {
      await p.route(`${API}/users`, (r) =>
        r.fulfill({
          status: 200, contentType: 'application/json',
          body: JSON.stringify([{
            id: 'u1', firstName: 'Admin', lastName: 'User', email: 'admin@test.com',
            status: 'ACTIVE', roles: [{ name: 'ADMIN' }], createdAt: new Date().toISOString(),
          }]),
        })
      )
      await p.route(`${API}/users/roles`, (r) =>
        r.fulfill({
          status: 200, contentType: 'application/json',
          body: JSON.stringify([
            { id: 'r1', name: 'ADMIN', description: 'Full access' },
            { id: 'r2', name: 'AMBASSADOR', description: 'Ambassador access' },
            { id: 'r3', name: 'CUSTOMER', description: 'Customer access' },
          ]),
        })
      )
    })
    await clickModule(page, 'Users')
    await page.waitForTimeout(500)
  })

  test('USR-01 — shows Users section with search box', async ({ page }) => {
    await expect(page.getByPlaceholder(/search by name or email/i)).toBeVisible({ timeout: 5000 })
  })

  test('USR-02 — shows Invite User button', async ({ page }) => {
    await expect(page.getByText('+ Invite User')).toBeVisible({ timeout: 5000 })
  })

  test('USR-03 — shows table headers', async ({ page }) => {
    await expect(page.getByRole('columnheader', { name: 'User' })).toBeVisible({ timeout: 5000 })
    await expect(page.getByRole('columnheader', { name: 'Roles' })).toBeVisible()
    await expect(page.getByRole('columnheader', { name: 'Status' })).toBeVisible()
    await expect(page.getByRole('columnheader', { name: 'Joined' })).toBeVisible()
  })

  test('USR-04 — shows loaded admin user in the list', async ({ page }) => {
    await expect(page.getByText('Admin User').or(page.getByText('admin@test.com'))).toBeVisible({ timeout: 5000 })
  })

  test('USR-05 — shows Roles & Permissions sidebar link', async ({ page }) => {
    await expect(page.getByRole('button', { name: '🛡 Roles & Permissions' })).toBeVisible({ timeout: 5000 })
  })

  test('USR-06 — Roles section shows role list', async ({ page }) => {
    await page.getByRole('button', { name: '🛡 Roles & Permissions' }).click()
    await expect(page.getByText('ADMIN').first()).toBeVisible({ timeout: 5000 })
  })

  test('USR-07 — clicking Invite User opens modal with form fields', async ({ page }) => {
    await page.getByText('+ Invite User').click()
    await expect(page.getByPlaceholder('First name').or(page.getByPlaceholder('First Name'))).toBeVisible({ timeout: 3000 })
    await expect(page.getByPlaceholder('Last name').or(page.getByPlaceholder('Last Name'))).toBeVisible()
    await expect(page.getByPlaceholder(/email address/i)).toBeVisible()
  })
})
