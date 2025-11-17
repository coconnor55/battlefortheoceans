# Supabase Function Updates

This directory contains SQL updates for Supabase database functions.

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

