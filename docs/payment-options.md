# Payment Integration Options

## Option A — CSV Import (Current)
Already built. Export statement from Capitec Business internet banking → Finance → Bank Accounts → Import CSV.
Good for low volume, free, works now.

---

## Option B — Stitch Money
Single platform covering both bank sync and customer payments.

**Products:**
- **LinkAPI** — reads Capitec Business account automatically via webhooks, no CSV exports needed
- **PaymentsAPI** — instant EFT / Pay by Bank for customer order payments

**How customer payments work:**
1. Customer clicks Pay Now at checkout
2. Redirected to Stitch-hosted page, selects bank, authenticates in banking app
3. Money moves instantly
4. Stitch webhook → API marks order PAID → finance transaction auto-created

**Fees:** ~1–2% per transaction, no monthly fee for low volume

---

## Option C — PayFast
Most widely used SA payment gateway. Recommended for broadest customer reach.

**Payment methods supported:** Credit/debit cards, Instant EFT, Capitec Pay, SnapScan, Zapper, Mobicred

**How it works:**
1. Customer clicks Pay Now → redirected to PayFast hosted checkout
2. Pays via preferred method (card, EFT, etc.)
3. PayFast sends ITN webhook → API marks order PAID → finance transaction auto-created

**Fees:** R25/month + ~2.9% per card transaction, lower for EFT

---

## Recommendation
| Goal | Use |
|------|-----|
| One platform for bank sync + payments | Stitch |
| Broadest payment methods (cards, EFT, wallets) | PayFast for payments + CSV import for bank sync |
| Automated bank sync only | Stitch LinkAPI only |

For a growing bakery, **PayFast** is recommended for customer payments — lower friction (card + Capitec Pay without bank login), familiar to SA customers. Keep CSV import for Capitec reconciliation until volume justifies Stitch LinkAPI.

---

## What needs to be built (PayFast)
- `POST /orders/:id/pay` — creates PayFast payment, returns redirect URL
- `POST /orders/payment/notify` — ITN webhook endpoint, marks order PAID
- New `PAID` status or `paidAt` field on Order model
- Storefront: "Confirm Order" → "Pay Now" redirects to PayFast
- PayFast account + sandbox credentials required

## What needs to be built (Stitch LinkAPI)
- OAuth flow to connect Capitec Business account once
- Webhook endpoint to receive incoming transactions → auto-import to Finance
- Stitch account + API keys required
