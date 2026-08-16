import { buildApp } from './app'
import { config } from './config'
import { reconcileOpenOrderInvoices } from './shared/services/odoo-invoice.service'

// Odoo sync only ever runs when something happens locally (order confirmed/delivered,
// a payment recorded) — nothing otherwise checks Odoo's side, so an invoice posted or
// paid directly in Odoo would sit stale forever. This periodically sweeps orders with a
// linked invoice that isn't already in a final state and re-syncs them. No-op entirely
// when Odoo isn't configured (e.g. local dev), so it never spams "not configured" errors.
const RECONCILE_INTERVAL_MS = 30 * 60 * 1000 // 30 minutes
const RECONCILE_INITIAL_DELAY_MS = 60 * 1000 // let the process finish booting first

function scheduleOdooReconciliation(app: Awaited<ReturnType<typeof buildApp>>) {
  if (!config.odoo.url) return

  const run = async () => {
    try {
      const result = await reconcileOpenOrderInvoices(app.prisma)
      if (result.checked > 0) {
        app.log.info(`[odoo-reconcile] checked ${result.checked} order(s), ${result.succeeded} synced, ${result.failed} failed`)
      }
    } catch (err) {
      app.log.error(err, '[odoo-reconcile] sweep failed')
    }
  }

  setTimeout(() => {
    run()
    setInterval(run, RECONCILE_INTERVAL_MS)
  }, RECONCILE_INITIAL_DELAY_MS)
}

async function start() {
  const app = await buildApp()

  try {
    await app.listen({ port: config.port, host: '0.0.0.0' })
    console.log(`🚀 Tlaka Treats API running on port ${config.port}`)
    scheduleOdooReconciliation(app)
  } catch (err) {
    app.log.error(err)
    process.exit(1)
  }
}

start()
