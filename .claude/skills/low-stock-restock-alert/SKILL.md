---
name: low-stock-restock-alert
description: Check FARA STORE's Salla inventory for products at or below 5 units and flag them for reorder, following the sales/workflows/low-stock-restock-alert.md workflow. Use when a sales staff member asks for the weekly restock check, low-stock products, or what needs reordering.
---

# Restock Alerts

Follow `sales/workflows/low-stock-restock-alert.md` in this repo exactly.

## How this actually runs

`salla.analytics.lowStockProducts` is **not a tool you can call directly here**. It's only registered inside the FARA API's own agent loop (`apps/api/src/agent/toolRegistry.ts`), and there's no MCP bridge exposing it to Claude Code. Don't claim to call it directly, and don't invent stock numbers.

The real bridge is the FARA REST API (`apps/api` must actually be running, default `:8787`):

1. Create or reuse a conversation: `POST /api/conversations` with header `X-FARA-Staff-Key: <staff key>`.
2. Ask the real FARA agent for the low-stock list — it's the one that actually holds `salla.analytics.lowStockProducts`:
   ```bash
   curl -sS -X POST "http://localhost:8787/api/conversations/$CONVERSATION_ID/chat" \
     -H "X-FARA-Staff-Key: $FARA_STAFF_KEY" \
     -H "Content-Type: application/json" \
     -d '{"text": "show me products at 5 units or fewer"}'
   ```
3. Read the `reply` field — that's the real, live list from Salla, sorted lowest first. Don't reorder or filter it from memory.
4. Every product in that list needs to go on the reorder list. **Where that list actually lives isn't wired up yet** — ask the user where they keep it (a spreadsheet, a note, Salla itself) rather than assuming a tool or file. Once that's answered, this skill and the workflow doc's "Access needed" section should be updated with the real one.
5. This skill only flags — it never changes stock quantities or reorders from a supplier itself. If asked to do either, say that's out of scope and point to the product-update workflow instead.
6. If `apps/api` isn't reachable or Salla isn't configured, say so plainly instead of guessing which products are low.

## Access needed
- FARA agent running (`npm run dev:api`) with a valid `X-FARA-Staff-Key` — the only real bridge to live Salla data from here.
- Salla Admin API v2 configured in `apps/api/.env`.
- The actual reorder list location — not yet named; ask before assuming one.

## When to use this
- Weekly restock check, or "what's low on stock" / "what needs reordering."
- Not for updating inventory numbers or placing a supplier order — that's a different workflow.
