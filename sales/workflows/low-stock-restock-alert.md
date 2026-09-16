# Workflow: Restock Alerts

**Responsibilities** — This workflow owns catching products before they sell out, so restocking can happen in time. It doesn't own updating stock quantities or prices itself — just spotting the problem and putting it on a list.

**What starts it** — Manual. Checked once a week, not on a schedule the system runs and not triggered by anything showing up — someone has to sit down and check.

**How it runs**
1. Ask FARA — don't go into Salla's own dashboard directly. Say something like "show me low-stock products."
2. FARA pulls the inventory list from Salla and sorts it by quantity ascending (lowest first) — that's `salla.analytics.lowStockProducts`, which reads live numbers from Salla, never a cached list.
3. Anything at **5 units or fewer** counts as low.
4. Every product that comes back under that line gets written down on the reorder list, so it doesn't get lost by the end of the week.
5. That's it — this workflow doesn't touch stock numbers or reorder from the supplier itself. It just makes sure nothing slips through unnoticed.

**What success looks like**
- The standard: nothing crosses from "low" to "zero" without already being on the reorder list.
- Good: catching a dress at 5 units left, with enough time to reorder before it actually runs out.
- Bad: a dress sells out completely before it ever got reordered — meaning either the weekly check got skipped, or it wasn't flagged when it should have been.

**Access needed**
- FARA agent (not Salla's dashboard directly) — running `apps/api` with a valid staff key, to ask for the low-stock list.
- Salla Admin API v2 configured in `apps/api/.env` — this is what FARA reads the live inventory numbers from.
- Wherever the reorder list actually lives (a notebook, a spreadsheet, a Salla note) — not specified yet; whoever runs this workflow should name the real one here instead of leaving it as "a list."
