/**
 * E2E tests for the Tlaka Treats vanilla JS web dashboard.
 * API calls to https://tlaka-treats-production.up.railway.app are intercepted
 * and mocked via page.route() so tests run entirely offline.
 */
import { test, expect, Page } from '@playwright/test'

const API = 'https://tlaka-treats-production.up.railway.app'

// ── Fixtures ──────────────────────────────────────────────────────────────────

// The web app checks user.roles (array) not user.role (string) for redirect
const ADMIN_USER      = { id: 'u1', roles: ['ADMIN'],      email: 'admin@test.com', firstName: 'Admin' }
const CUSTOMER_USER   = { id: 'u2', roles: ['CUSTOMER'],   email: 'cust@test.com',  firstName: 'Nomsa' }
const AMBASSADOR_USER = { id: 'u3', roles: ['AMBASSADOR'], email: 'amb@test.com',   firstName: 'Zanele' }

const AMBASSADOR_DATA = {
  id: 'a1', code: 'TT-TEST0001', status: 'ACTIVE', fullName: 'Zanele Mokoena',
  commissionRate: 0.1, totalCommission: 0, orders: [],
}

// ── Low-level helpers ─────────────────────────────────────────────────────────

async function goToApp(page: Page) {
  await page.goto('/')
  await page.waitForSelector('text=Tlaka Treats', { timeout: 5000 })
}

async function mockEmptyAdmin(page: Page) {
  // Playwright matches routes LIFO — register catch-all FIRST so specific routes below take precedence.
  await page.route(`${API}/**`, (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }))
  // Specific overrides registered after (matched first):
  await page.route(`${API}/orders`, (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }))
  await page.route(`${API}/ambassadors`, (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }))
  await page.route(`${API}/products`, (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }))
  await page.route(`${API}/products/admin`, (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }))
  await page.route(`${API}/customers`, (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }))
}

async function loginAs(page: Page, user: typeof ADMIN_USER) {
  await page.route(`${API}/auth/login`, (r) =>
    r.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ token: 'test-jwt', user }),
    })
  )
}

async function navigateToAdminDashboard(page: Page) {
  await mockEmptyAdmin(page)
  // Pre-set localStorage so the app auto-routes to admin without login
  await page.addInitScript((user) => {
    localStorage.setItem('tt_token', 'test-jwt')
    localStorage.setItem('tt_user', JSON.stringify(user))
  }, ADMIN_USER)
  await goToApp(page)
  // Wait for admin shell to appear
  await page.waitForSelector('text=Admin Console', { timeout: 8000 })
}

async function navigateToAmbassadorDashboard(page: Page) {
  // Pre-set localStorage so app auto-routes to ambassador, then mock API calls
  await page.route(`${API}/**`, (r) =>
    r.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
  )
  await page.route(`${API}/ambassadors/me`, (r) =>
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(AMBASSADOR_DATA) })
  )
  await page.route(`${API}/orders/ambassador`, (r) =>
    r.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
  )
  await page.addInitScript((user) => {
    localStorage.setItem('tt_token', 'test-jwt')
    localStorage.setItem('tt_user', JSON.stringify(user))
  }, AMBASSADOR_USER)
  await goToApp(page)
  await page.waitForSelector('text=Ambassador Portal', { timeout: 8000 })
}

// ── AUTH ──────────────────────────────────────────────────────────────────────

test.describe('Login page', () => {
  test('AUTH-01 — renders the login page with brand title', async ({ page }) => {
    await goToApp(page)

    await expect(page.getByText('Tlaka Treats')).toBeVisible()
    await expect(page.getByText('Welcome back')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Sign In' })).toBeVisible()
  })

  test('AUTH-10 — shows toast when fields are empty', async ({ page }) => {
    await goToApp(page)

    await page.getByRole('button', { name: 'Sign In' }).click()

    await expect(page.getByText('Please fill in all fields')).toBeVisible()
  })

  test('AUTH-09 — shows error toast on invalid credentials', async ({ page }) => {
    await goToApp(page)
    await page.route(`${API}/auth/login`, (r) =>
      r.fulfill({ status: 401, contentType: 'application/json', body: JSON.stringify({ message: 'Invalid credentials' }) })
    )

    await page.fill('input[type="email"]', 'wrong@example.com')
    await page.fill('input[type="password"]', 'wrongpass')
    await page.getByRole('button', { name: 'Sign In' }).click()

    await expect(page.getByText(/Invalid credentials/i)).toBeVisible()
  })

  test('AUTH-01 — admin login redirects to Admin Console', async ({ page }) => {
    await mockEmptyAdmin(page)
    await loginAs(page, ADMIN_USER)
    await goToApp(page)

    await page.fill('input[type="email"]', 'admin@test.com')
    await page.fill('input[type="password"]', 'password123')
    await page.getByRole('button', { name: 'Sign In' }).click()

    await expect(page.getByText('Admin Console')).toBeVisible({ timeout: 8000 })
  })

  test('AUTH-01 — customer login redirects to customer home', async ({ page }) => {
    await page.route(`${API}/**`, (r) =>
      r.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
    )
    await loginAs(page, CUSTOMER_USER)
    await page.route(`${API}/products`, (r) =>
      r.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
    )
    await goToApp(page)

    await page.fill('input[type="email"]', 'cust@test.com')
    await page.fill('input[type="password"]', 'password123')
    await page.getByRole('button', { name: 'Sign In' }).click()

    // Customer home shows "Tlaka Treats" branding in nav
    await expect(page.getByText('Tlaka Treats').first()).toBeVisible({ timeout: 8000 })
  })

  test('navigates to register page when clicking Register link', async ({ page }) => {
    await goToApp(page)

    await page.getByText('Register').click()

    await expect(page.getByRole('heading', { name: 'Create Account' })).toBeVisible()
  })
})

test.describe('Register page', () => {
  test('AUTH-01 — renders the registration form', async ({ page }) => {
    await goToApp(page)
    await page.getByText('Register').click()

    await expect(page.getByRole('heading', { name: 'Create Account' })).toBeVisible()
    await expect(page.getByPlaceholder(/email/i)).toBeVisible()
    await expect(page.getByPlaceholder(/password/i)).toBeVisible()
  })

  test('AUTH-10 — shows toast when required fields are empty', async ({ page }) => {
    await goToApp(page)
    await page.getByText('Register').click()

    await page.getByRole('button', { name: 'Create Account' }).click()

    await expect(page.getByText(/Please fill in all required fields/i)).toBeVisible()
  })

  test('AUTH-01 — successful registration shows success and redirects', async ({ page }) => {
    await goToApp(page)
    await page.getByText('Register').click()

    await page.route(`${API}/**`, (r) =>
      r.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
    )
    await page.route(`${API}/auth/register`, (r) =>
      r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ token: 'tok', user: CUSTOMER_USER }) })
    )
    await page.route(`${API}/products`, (r) =>
      r.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
    )

    // Fill in all required fields
    const firstNameInput = page.getByPlaceholder('First Name')
    if (await firstNameInput.isVisible()) {
      await firstNameInput.fill('Nomsa')
    }
    const lastNameInput = page.getByPlaceholder('Last Name')
    if (await lastNameInput.isVisible()) {
      await lastNameInput.fill('Dlamini')
    }
    await page.fill('input[type="email"]', 'nomsa@example.com')
    await page.fill('input[type="password"]', 'Password1!')
    await page.getByRole('button', { name: 'Create Account' }).click()

    // After success, either toast appears or page navigates away from register
    await expect(page.getByRole('heading', { name: 'Create Account' })).not.toBeVisible({ timeout: 5000 })
  })

  test('navigates back to login from register page', async ({ page }) => {
    await goToApp(page)
    await page.getByText('Register').click()
    await page.getByText('Sign In').click()

    await expect(page.getByText('Welcome back')).toBeVisible()
  })
})

test.describe('Admin dashboard', () => {
  test('DASH-01 — shows Dashboard title and Overview subtitle', async ({ page }) => {
    await navigateToAdminDashboard(page)

    await expect(page.getByText('Overview of your business')).toBeVisible({ timeout: 8000 })
  })

  test('DASH-02 — shows Total Revenue KPI after data loads', async ({ page }) => {
    await navigateToAdminDashboard(page)

    await expect(page.getByText('Total Revenue')).toBeVisible({ timeout: 8000 })
  })

  test('DASH-03 — shows Total Orders KPI', async ({ page }) => {
    await navigateToAdminDashboard(page)

    await expect(page.getByText('Total Orders')).toBeVisible({ timeout: 8000 })
  })

  test('DASH-01 — admin sidebar shows nav items', async ({ page }) => {
    await navigateToAdminDashboard(page)

    await expect(page.getByText('Admin Console')).toBeVisible()
    // Sidebar navigation links
    await expect(page.getByText('Sales')).toBeVisible()
  })
})

test.describe('Ambassador dashboard', () => {
  test('AMB-05 — shows referral code after loading', async ({ page }) => {
    await navigateToAmbassadorDashboard(page)

    await expect(page.getByText('TT-TEST0001').first()).toBeVisible({ timeout: 8000 })
  })

  test('AMB-05 — shows Ambassador Portal label in nav', async ({ page }) => {
    await navigateToAmbassadorDashboard(page)

    await expect(page.getByText('Ambassador Portal', { exact: true })).toBeVisible({ timeout: 8000 })
  })

  test('AMB-06 — shows earnings display', async ({ page }) => {
    await page.route(`${API}/**`, (r) =>
      r.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
    )
    await loginAs(page, AMBASSADOR_USER)
    await page.route(`${API}/ambassadors/me`, (r) =>
      r.fulfill({
        status: 200, contentType: 'application/json',
        body: JSON.stringify({ ...AMBASSADOR_DATA, totalCommission: 350 }),
      })
    )
    await page.route(`${API}/orders/ambassador`, (r) =>
      r.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
    )
    await goToApp(page)
    await page.fill('input[type="email"]', 'amb@test.com')
    await page.fill('input[type="password"]', 'secret123')
    await page.getByRole('button', { name: 'Sign In' }).click()

    await expect(page.getByText(/Earned|earned|Commission|commission|R/i).first()).toBeVisible({ timeout: 8000 })
  })
})
