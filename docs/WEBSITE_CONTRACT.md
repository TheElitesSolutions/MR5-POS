# MR5 Website Contract

The contract between **MR5-POS** (desktop POS) and **mr5-Menu** (public Vite/React site on Vercel) for the Website Manager feature.

## Source of truth

| Concern                          | Owner                                  |
| -------------------------------- | -------------------------------------- |
| Menu items, categories, add-ons  | MR5-POS local SQLite → synced to Supabase |
| Item visibility (`isVisibleOnWebsite`) | **Supabase only** — written by POS Website Manager (iter 2 race fix) |
| Category visibility (`is_visible`) | Supabase only                        |
| Website ordering (`display_order`) | Supabase only                        |
| Featured flag (`is_featured`)    | Supabase only                          |
| Item images (`image_url`, `image_lqip`) | Supabase only + `menu-images` bucket |
| Item description (`description`) | Supabase only (separate from POS internal) |
| Restaurant info (`website_settings`) | Supabase only                       |
| Audit log (`website_audit`)      | Supabase only                          |

> **Iteration 2 update**: `isVisibleOnWebsite` was previously pushed by the sync layer on every cycle, which silently undid Website Manager edits and would have defeated the Reset feature. It's now fully Supabase-authoritative — see `supabaseSync.ts` header policy comment.

The local POS SQLite schema is **frozen** for these features. Nothing is mirrored locally.

## Live Supabase tables

```
category(id, uuid, name, deleted_at, display_order, is_visible, image_url, updated_at)
item(id, uuid, name, price, is_special, category_id, "isVisibleOnWebsite", deleted_at,
     display_order, is_featured, image_url, image_lqip, description, updated_at)
add_on(id, addon_uuid, category_id, description, price, deleted_at)
website_settings(id=1 singleton: phone, address, google_maps_url, hero_tagline,
                 header_subtitle, hours JSONB, social JSONB, updated_at)
website_audit(occurred_at, actor, table_name, row_id, action, diff JSONB)
```

The migration that creates everything: [`scripts/website-manager-migration.sql`](../scripts/website-manager-migration.sql).

## RLS posture

- `item`: anon can SELECT only `deleted_at IS NULL AND "isVisibleOnWebsite" = true`.
- `category`: anon can SELECT only `deleted_at IS NULL AND is_visible = true`.
- `add_on`: anon can SELECT only `deleted_at IS NULL`.
- `website_settings`: anon can SELECT all (single row).
- `website_audit`: anon has no policy → cannot read.
- `service_role` bypasses RLS automatically (POS uses this).

## Naming policy

- **POS TypeScript** uses camelCase (`displayOrder`, `imageUrl`).
- **Supabase columns** are snake_case (`display_order`, `image_url`).
- Legacy `"isVisibleOnWebsite"` (mixed-case, double-quoted) stays as-is for back-compat.
- Mapping happens **only** at the boundary in `main/services/supabaseSync.ts`. New website fields are not part of the sync mapper at all — they bypass SQLite entirely.

## Order flow (Website Manager → live site)

```
POS UI (renderer/components/website/*)
   ↓ window.electronAPI.website.* (preload)
Main: WebsiteController (controllers/websiteController.ts)
   ↓
Main: WebsiteManagerService (services/websiteManagerService.ts)
   ↓ HTTPS PATCH/POST/PUT with service_role key
Supabase (item / category / website_settings / website_audit / Storage)
   ↑ HTTPS GET with anon key (RLS-gated)
mr5-Menu (Vite SPA on Vercel)
```

The Menu polls every 60 s and refetches on window focus. No realtime subscription in v1.

## Reorder semantics

- Reordering happens per-category.
- POS sends the **full ordered UUID list** to RPC `reorder_items(p_category UUID, p_ids UUID[])`.
- The RPC updates `display_order = array_position(p_ids, uuid)` in a single transaction.
- Optimistic UI in POS rolls back on failure.
- Last-writer-wins; concurrency conflicts surface via `expected_updated_at` mismatch returning `STALE_WRITE`.

## Image pipeline

1. POS renderer reads `File`, sends `ArrayBuffer` over IPC.
2. Main process accepts up to 5 MB; rejects non-JPEG/PNG/WebP/HEIC.
3. `sharp` resizes to ≤ 1600 px, encodes WebP @ 82, strips EXIF, generates a 32 px LQIP base64.
4. Main process uploads to `menu-images/items/{uuid}.webp` with `Cache-Control: 31536000`.
5. Public URL gets cache-busted with `?v={now}` and stored in `item.image_url`; LQIP stored in `item.image_lqip`.
6. Menu renders `<img loading="lazy">` over a CSS background-image fallback set from the LQIP.

## Verification checklist

| # | Scenario | Expected |
|---|---|---|
| 1 | Drag-reorder 3 items in a category | Menu reflects new order within 60 s focus refetch |
| 2 | Toggle featured on 2 items | Featured strip appears with those 2 |
| 3 | Edit phone in Restaurant Info | Menu footer reflects within 60 s |
| 4 | Upload 12 MB iPhone HEIC | Stored as < 300 KB WebP with LQIP blur-up |
| 5 | Bulk-hide 5 items (confirmation prompt) | All disappear from Menu |
| 6 | Restart POS | All changes persist (read from Supabase) |
| 7 | Force network failure mid-reorder | Optimistic order reverts; toast shows error |
| 8 | Hostile script with anon key tries `UPDATE item …` | Blocked by RLS |
| 9 | Hostile script reads soft-deleted row | Blocked by RLS |
| 10 | Two POS tabs reorder same category simultaneously | Second save returns `STALE_WRITE` toast |

## Files of record

- Migration: [`scripts/website-manager-migration.sql`](../scripts/website-manager-migration.sql)
- Service:   [`main/services/websiteManagerService.ts`](../main/services/websiteManagerService.ts)
- Controller: [`main/controllers/websiteController.ts`](../main/controllers/websiteController.ts)
- IPC channels: [`shared/ipc-channels.ts`](../shared/ipc-channels.ts) (`WEBSITE_CHANNELS`)
- Preload: [`main/preload.ts`](../main/preload.ts) (`websiteAPI`)
- Routes: `renderer/app/(auth)/website/{items,restaurant-info,branding}`
- Components: `renderer/components/website/*`
- Menu app: `mr5-Menu/src/{lib/supabase.ts,hooks/useMenuData.ts,hooks/useWebsiteSettings.ts,components/MenuItem.tsx,components/MenuErrorBoundary.tsx,pages/Index.tsx}`

## Env vars (mr5-Menu on Vercel)

```
VITE_SUPABASE_URL=https://buivobulqaryifxesvqo.supabase.co
VITE_SUPABASE_ANON_KEY=<anon key>
```

If absent, `src/lib/supabase.ts` falls back to the previously hardcoded values.

## Reset Website (iteration 2)

A "Reset Website" Danger Zone button under POS → Website → Items lets an admin wipe all website-display state in one click. **Destructive**: hides every item + category, AND nulls out `description`, `image_url`, `image_lqip`, `is_featured`, `display_order`. POS-side data (item names, prices, category assignments) is untouched.

Implemented as a Supabase RPC `reset_website_state()` (security-definer, granted to `service_role` only). Single composite audit row with `action='reset_website'` and a diff containing `items_reset` and `categories_reset` counts.

UX: typed-`CLEAR` confirmation dialog, admin-gated via `useUserPermissions().isAdmin`, disabled when offline.

Migration file: [`scripts/website-manager-iter2.sql`](../scripts/website-manager-iter2.sql).

## What the Menu now reads dynamically (iter 2)

- `Header.tsx` — `header_subtitle` (brand text), `hero_tagline` (tagline)
- `Index.tsx` footer — `phone` (WhatsApp link), `address`, `google_maps_url`, `hours` (per-day open/close), `social.instagram` / `social.facebook` / `social.tiktok` (icon links)
- `useCategories` filters `is_visible=true` so hidden categories disappear from BurgerMenu

What the Menu still hardcodes (intentional, low-value-to-make-dynamic):
- BurgerMenu copy ("MENU CATEGORIES", "Tap any category…")
- "ADD-ONS & EXTRAS" section heading
- "★ Featured" / "★ SPECIAL" badges
- "$" currency symbol
- Loading + error UI strings
- Hero background image (`/images/Menu.png` — deferred to a later iteration)
- "Powered by The Elites Solutions" attribution (intentional white-label)

## Delete semantics (v3.0.3+)

POS-side deletes propagate as **hard deletes** in Supabase. When an item, category, or add-on is removed from POS — whether by per-action sync or by the bulk reconciliation finding a Supabase row that no longer has a local counterpart — the row is physically `DELETE`d, not soft-marked via `deleted_at`. The Website tab and the public Menu site both stop seeing it on their next read.

The `deleted_at` column on `item` and `category` is retained for backward compatibility with anything still reading it, but new code does not populate it. The bulk reconciliation also passes through any pre-existing soft-deleted rows on the next run, so v3.0.3+ self-cleans previously-orphaned soft-deletes from earlier versions.

This was a deliberate trade-off in favour of "what the POS shows is what Supabase has". Audit history is captured by the existing `website_audit` log for Website Manager edits; per-action POS deletes don't currently write an audit row.

## Known limitations (v3.0.1+)

### Single-client deployment assumed

`formatHexAsUuid()` in `main/services/supabaseSync.ts` deterministically derives a Supabase UUID from each row's local SQLite Cuid. Because every machine has different Cuids, every machine produces different UUIDs for "the same" logical row.

The sync layer compensates with a **name-adoption** fallback: when a name+category match exists in Supabase under a different uuid, the local sync **PATCHes** that Supabase row to take on the local-derived uuid (see `syncCategories`, `syncMenuItems`, `syncAddOns`, and the singular `syncCategory` / `syncMenuItem` paths). After adoption, both sides match by uuid and steady-state is uuid-based.

This works cleanly for **one** active POS install per Supabase project. With two or more concurrent installs, the same row's uuid will ping-pong between machines on each sync cycle (functionally correct — names/prices propagate — but `updated_at` thrashes and eventual consistency is noisier than necessary).

If a second client deployment is ever needed, the proper fix is to add a `supabaseUuid` column to local SQLite, populate it on first adoption, and use it as the sync identity instead of re-deriving from a per-machine Cuid every cycle. Tracked as deferred work; out of scope for v3.0.1.
