# Payment Platform Analysis — Pay What You Want

Emdy is a free Markdown reader app with a pay-what-you-want model. Users are nudged (usage-based) to support the project by paying whatever they choose. This analysis evaluates platforms for handling that payment.

## What we need

- Buyer sets their own price (true PWYW, not just preset tiers)
- Embeddable on our marketing site (not just a link to an external page)
- Minimal setup — no backend if possible
- Tax/VAT handling preferred (Merchant of Record)
- Reasonable fees for small transactions (many payments will be $3–10)

## Platform Comparison

### Gumroad

| | |
|---|---|
| **Fees** | 10% flat, no monthly fee |
| **PWYW** | Native. Set minimum at $0+, buyer enters any amount above that |
| **Embed** | Widget overlay and inline embed on any site |
| **Tax handling** | Merchant of Record — handles global VAT/GST collection and remittance |
| **Payouts** | Weekly to bank (US), PayPal, or Payoneer. 7-day hold on new accounts |
| **Complexity** | Very low. Create product, set $0+ price, embed widget. No backend |
| **Fit** | Excellent. The canonical platform for indie software and digital products |

The 10% fee is the highest of the serious options, but you get MoR tax handling and a large existing audience of people comfortable paying for indie work.

### Lemon Squeezy

| | |
|---|---|
| **Fees** | 5% + $0.50 per transaction |
| **PWYW** | Native. $0+ minimum, buyer enters custom amount |
| **Embed** | JavaScript overlay widget, similar to Gumroad |
| **Tax handling** | Merchant of Record — full global tax handling |
| **Payouts** | Monthly, net-15. PayPal or bank transfer. Slow payout cycles have been a common complaint |
| **Complexity** | Low. Similar to Gumroad |
| **Fit** | Good. Targets indie developers and digital product sellers. Growing adoption |

Lower percentage fee than Gumroad, but the $0.50 fixed fee hurts on small transactions ($3 payment = ~22% effective fee). Monthly payouts with a 15-day hold are slower than Gumroad.

### Polar.sh

| | |
|---|---|
| **Fees** | 5% + Stripe processing (~2.9% + $0.30) |
| **PWYW** | Native. $0+ minimum, custom amount |
| **Embed** | JS SDK and hosted pages. Newer, less mature embed experience |
| **Tax handling** | Merchant of Record — handles VAT |
| **Payouts** | Via Stripe Connect to your bank on Stripe's standard 2-day rolling schedule |
| **Complexity** | Low-medium. Developer-friendly with good API and GitHub integration |
| **Fit** | Excellent. Built specifically for open-source maintainers and indie developers |

Strong developer-community alignment. GitHub integration is a plus if Emdy's repo is public. Newer platform (launched 2023–2024), so smaller user base and less battle-tested embed experience.

### Stripe (Direct)

| | |
|---|---|
| **Fees** | 2.9% + $0.30 per transaction |
| **PWYW** | Full control — you build the price input UI and pass any amount to Stripe |
| **Embed** | Stripe Elements (full design control), Checkout (hosted), or Payment Links (no-code) |
| **Tax handling** | Stripe Tax add-on (+0.5% per transaction) calculates and collects. Remittance is still on you — Stripe is not a Merchant of Record |
| **Payouts** | 2-day rolling to bank account. Daily automatic transfers |
| **Complexity** | Medium-high. Requires code for checkout flow (serverless function or small backend). Payment Links can reduce this but less flexible |
| **Fit** | Neutral. Invisible to the buyer — just a card form. Maximum control, no discovery |

Lowest fees, most flexibility, most work. You handle tax remittance yourself (or pay for Stripe Tax and still file). Best if you want a fully branded experience and are willing to build it.

### Ko-fi

| | |
|---|---|
| **Fees** | 0% platform fee on free plan. Only Stripe/PayPal processing (~2.9% + $0.30). Ko-fi Gold ($6/month) adds shop features |
| **PWYW** | Coffee-multiple model — buyer picks how many "coffees" at a price you set (default $3). Not freeform dollar input on free plan |
| **Embed** | Button and floating widget. Opens Ko-fi overlay or redirects to Ko-fi page |
| **Tax handling** | None. You handle all tax obligations |
| **Payouts** | Instant to PayPal. Standard Stripe schedule if using Stripe |
| **Complexity** | Very low |
| **Fit** | Good as a supplementary channel. The "coffee" framing is more tipping than product support |

Cheapest option by far. The trade-off is no tax handling and the UX is "tip a creator" rather than "support a product." Works well as a low-friction secondary option.

### Buy Me a Coffee

| | |
|---|---|
| **Fees** | 5% platform fee + payment processing (~2.9% + $0.30). ~8% effective |
| **PWYW** | Multiplier-based ($5, $10, $15, $25, custom). Not true freeform PWYW |
| **Embed** | Button and widget. Hosted page |
| **Tax handling** | None |
| **Payouts** | Instant to bank (via Stripe Connect) or PayPal. $5 minimum |
| **Complexity** | Very low |
| **Fit** | Fair. Primarily for content creators (YouTubers, bloggers). Less common for software |

Similar to Ko-fi but with higher fees, no free tier advantage, and a more creator-economy than developer-tools audience. Hard to justify over Ko-fi.

### Paddle

| | |
|---|---|
| **Fees** | 5% + $0.50 per transaction |
| **PWYW** | Not a standard feature. Designed for fixed-price SaaS/software. Custom-amount charges possible via API but not natural |
| **Embed** | Checkout overlay (Paddle.js). Professional |
| **Tax handling** | Full Merchant of Record |
| **Payouts** | Monthly, net-15. Wire or PayPal. $100 minimum threshold |
| **Complexity** | Medium. Approval process. Designed for ongoing software businesses |
| **Fit** | Fair. Good pedigree for software, but the model assumes recurring revenue or fixed pricing. Overkill for PWYW |

### GitHub Sponsors

| | |
|---|---|
| **Fees** | 0% platform fee. Only Stripe/PayPal processing |
| **PWYW** | Preset tiers + custom one-time amount. Oriented toward recurring monthly support |
| **Embed** | Sponsor button on GitHub only. No embeddable widget for external sites |
| **Tax handling** | None. You handle everything. GitHub issues 1099s for US sponsors over $600 |
| **Payouts** | Monthly to bank (Stripe) or PayPal |
| **Complexity** | Low. Requires GitHub enrollment and approval |
| **Fit** | Good as a supplementary channel for people who find the project on GitHub |

### Open Collective

| | |
|---|---|
| **Fees** | ~13% total with Open Source Collective fiscal host (10% host fee + processing) |
| **PWYW** | Freeform amounts, one-time or recurring |
| **Embed** | Contribute button linking to opencollective.com. No inline checkout |
| **Tax handling** | Fiscal host handles tax filing |
| **Payouts** | Submit expenses to withdraw. Approved by fiscal host. PayPal, bank, or virtual card |
| **Complexity** | Medium. Expense-approval model adds friction. Designed for multi-contributor projects |
| **Fit** | Fair. Feels heavy for a solo indie app |

## Fee Comparison on Small Transactions

Since most PWYW payments will be small, here's what the effective fee looks like on a $5 payment:

| Platform | Fee on $5 | Effective % |
|---|---|---|
| Ko-fi (free plan) | $0.45 | 9% |
| GitHub Sponsors | $0.45 | 9% |
| Stripe (direct) | $0.45 | 9% |
| Gumroad | $0.50 | 10% |
| Polar.sh | $0.55 | 11% |
| Lemon Squeezy | $0.75 | 15% |
| Buy Me a Coffee | $0.70 | 14% |
| Paddle | $0.75 | 15% |
| Open Collective | $0.65 | 13% |

On a $5 transaction, the fixed-fee platforms (Lemon Squeezy, Paddle) lose their percentage advantage. Gumroad's flat 10% is actually competitive at this price point.

## Recommendation

**Primary: Gumroad.** Native PWYW, dead-simple setup, embeddable widget, Merchant of Record tax handling, and the audience most aligned with indie software. The 10% fee is the cost of not dealing with taxes or building checkout infrastructure. For small PWYW amounts, it's competitive with the alternatives anyway.

**Secondary: GitHub Sponsors.** Zero platform fee, good for developers who discover the project on GitHub. Different audience than the marketing site — worth having both channels.

**Alternative to consider: Polar.sh.** If Emdy's repo is public and the developer-community angle is important, Polar offers similar MoR benefits to Gumroad with better GitHub integration and slightly lower fees. The trade-off is a newer, less proven platform.

**Skip: Shopify** (overkill, no PWYW), **Paddle** (not built for PWYW), **Open Collective** (too heavy), **Buy Me a Coffee** (Ko-fi does the same thing cheaper).
