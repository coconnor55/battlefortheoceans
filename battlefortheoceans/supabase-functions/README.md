# Supabase Function Updates

This directory contains SQL updates for Supabase database functions and RLS (Row Level Security).

## RLS policies

### rls_policies.sql

**Apply RLS and policies** for all app tables. Safe to re-run (uses `DROP POLICY IF EXISTS` before each `CREATE POLICY`).

| Table | Policies |
|-------|----------|
| **game_results** | INSERT/SELECT/UPDATE/DELETE own rows; plus SELECT all (for leaderboard/recent champions). |
| **user_rights** | SELECT, INSERT, DELETE own rows. No client UPDATE — use `consume_rights()` RPC. |
| **user_profiles** | SELECT all (leaderboard), INSERT/UPDATE own row only. |
| **user_achievements** | SELECT, INSERT, UPDATE, DELETE own rows (`player_id = auth.uid()`). |
| **vouchers** | SELECT where created_by/redeemed_by = you or email_sent_to = JWT email; UPDATE unredeemed to set redeemed_by = you. Creation via `generate_voucher` RPC. |
| **achievements** | SELECT only (reference table). |
| **error_logs** | INSERT (with optional player_id); SELECT own rows only. |

**Caveats:** Vouchers “sent to me” SELECT requires `email` in the JWT (Supabase Auth includes it by default). Game_results allows authenticated users to read all rows for leaderboard/recent champions.

**How to apply:** Supabase Dashboard → SQL Editor → paste and run `rls_policies.sql`.

### check_rls.sql

**Verify RLS** without changing data. Shows RLS enabled per table, all policies, auth context, and policy counts for: `game_results`, `user_rights`, `user_profiles`, `user_achievements`, `vouchers`, `achievements`, `error_logs`. Optional commented blocks for testing INSERT/SELECT.

**How to use:** Run in SQL Editor. Replace placeholder UUIDs in the optional test blocks if needed.

**Expected policy counts** (after cleanup): game_results 5, user_rights 3, user_profiles 3, user_achievements 4, vouchers 2, achievements 1, error_logs 2. If you see higher counts, you have legacy/duplicate policies.

### rls_cleanup_legacy.sql

**Remove legacy/duplicate policies** so only the canonical set from `rls_policies.sql` remains. Run in SQL Editor; it drops any policy on those seven tables whose name is not in the canonical list. Then re-run `rls_policies.sql` so the intended policies exist. Use this if section 6 of `check_rls.sql` shows more than the expected counts above.

### consume_rights.sql

RPC that consumes uses from a `user_rights` row. Runs with `SECURITY DEFINER` so it bypasses RLS; it validates that the authenticated user owns the row before updating. Used for voucher and pass consumption after a game.

---

## redeem_voucher_v2_update.sql

### Security Enhancement

Adds a check to prevent voucher creators from redeeming their own vouchers.

**Change:** After checking if the voucher exists, add a check to ensure `created_by` is NOT equal to `p_user_id`.

**Why:** Prevents users from creating vouchers for friends and then redeeming them themselves (e.g., when they receive a CC copy of the invite email).

### How to Apply

1. Go to Supabase Dashboard → SQL Editor
2. Copy the updated function from `redeem_voucher_v2_update.sql`
3. Execute the SQL to update the function

### Relationship to Client-Side Validation

The client-side validation in `VoucherService.js` checks:
- **Email validation**: If `email_sent_to` is set, it must match the redeeming user's email

The server-side validation in `redeem_voucher_v2` checks:
- **Creator validation**: The redeeming user must NOT be the creator (`created_by`)

These are **complementary** checks:
- Client-side provides immediate feedback and prevents unnecessary server calls
- Server-side provides authoritative security (cannot be bypassed)

Both checks work together to prevent voucher theft:
1. You can't redeem a voucher sent to a different email (client + server email check)
2. You can't redeem a voucher you created yourself (server-side creator check)

### Edge Cases

- **General vouchers** (`email_sent_to` is null, `created_by` is null): Can be redeemed by anyone
- **Auto-redeemed reward vouchers**: Have `email_sent_to` as null, so email check is skipped, but creator check still applies
- **System-generated vouchers**: May have `created_by` as null, so creator check is skipped

## delete_user_cascade.sql

Script to delete a user and all related records before deleting from auth.users.

**Usage:**
1. Open Supabase SQL Editor
2. Update the user ID in the script (replace '180e5efa-2c5f-4a19-b969-d67283def379' with your user ID)
3. Run the script to delete related records
4. Then delete the user from Supabase Dashboard → Authentication → Users

**What it deletes:**
- user_achievements
- game_results
- user_rights
- user_profiles
- (Optional) vouchers created by the user

**Note:** The auth.users record must be deleted separately from the Supabase Dashboard or via admin API.

