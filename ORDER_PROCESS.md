# Tlaka Treats — Order Process

## Scenario 1: Customer ordering for themselves (no ambassador)

**Placement** (`POST /orders`)
- Customer submits their cart items. No `ambassadorCode` in the request.
- Each item is priced at the **RETAIL** tier — the standard public price.
- An order is created with `status: PENDING`, `ambassadorId: null`.
- Customer receives an email + WhatsApp confirmation immediately.

**Status lifecycle** (admin drives this in the back-office):

| Status | What happens |
|---|---|
| `PENDING` | Order placed, awaiting admin review |
| `CONFIRMED` | Stock is deducted for all SELLABLE items. A finance income transaction (`INCOME / Product Sales`) is recorded against account `4001`. No commission (no ambassador). Customer notified. |
| `BAKING` | Customer notified — order is being prepared |
| `READY` | Customer notified — ready for collection/delivery |
| `DELIVERED` | Order complete. Customer notified. |

No commission is ever created. The full order total is revenue.

---

## Scenario 2: Customer ordering with an ambassador code

**Placement** (`POST /orders`)
- Customer submits their cart with `ambassadorCode: "TT-JANE1234"`.
- API looks up the ambassador — must exist and be `ACTIVE`, otherwise returns 400.
- Each item is priced at the **AMBASSADOR** tier — typically a discounted price that incentivises using a code.
- Order is created with `ambassadorId` linked to that ambassador.
- Customer receives confirmation notification.

**Status lifecycle:**

| Status | What happens |
|---|---|
| `PENDING` | Order placed |
| `CONFIRMED` | Stock deducted. Finance income recorded. **Commission auto-created**: `amount = order.total × ambassador.commissionRate` (e.g. 10% = R0.10 per rand). Commission status starts as `PENDING`. Customer notified. |
| `BAKING` | Customer notified — order is being prepared |
| `READY` | Customer notified — ready for collection/delivery |
| `DELIVERED` | Order complete. Customer notified. |

The ambassador sees this order appear in their dashboard and the commission in their Earnings screen. The commission only becomes `PAID` once admin processes a payout request.

---

## Scenario 3: Ambassador ordering on behalf of a customer

**Placement** (`POST /orders/admin`) — admin-only endpoint
- Placed by an admin (or ambassador via back-office), providing both a `customerId` and optionally an `ambassadorCode`.
- Same `create()` logic runs underneath — pricing tier is AMBASSADOR if a code is supplied, RETAIL if not.
- The order is attributed to the customer (`customerId`), so it appears in their order history.
- If an `ambassadorCode` is provided, the order is linked to the ambassador and a commission will be created at CONFIRMED.

**Typical use case:** A customer calls/messages an ambassador directly. The ambassador logs the order in the back-office on the customer's behalf, uses their own code, and earns the commission.

**Status lifecycle:** Identical to Scenario 2 if a code is used — commission auto-created at `CONFIRMED`.

---

## Commission Payout Flow (Scenarios 2 & 3)

```
Commissions accumulate as PENDING
       ↓
Ambassador requests payout (POST /ambassadors/me/payout-request)
  — Requires: status ACTIVE, total pending ≥ R50
  — Creates a Payout record (status: PENDING), links all pending commissions to it
       ↓
Admin processes payment externally (bank transfer / cash / mobile money)
  — Admin marks commissions as PAID in the back-office
       ↓
Ambassador sees PAID commissions in Earnings screen
```

---

## Pricing Tiers

| Tier | When applied | Who sets it |
|---|---|---|
| `RETAIL` | No ambassador code used | Admin sets per product variant |
| `AMBASSADOR` | Valid ambassador code provided | Admin sets per product variant |

Both tiers must be configured for each product variant in the back-office. If a variant has no AMBASSADOR price and an ambassador code is used, the order will fail with a 400 error.
