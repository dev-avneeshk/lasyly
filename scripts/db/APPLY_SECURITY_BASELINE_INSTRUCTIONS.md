# Apply Security RLS Baseline to Production

## Status: READY TO APPLY

The file `APPLY_SECURITY_BASELINE.sql` in this directory is ready to be executed
against the production Supabase database.

## What It Does

This is the complete `20260522_security_rls_baseline.sql` migration with one
modification: section 6 (room_matches table RLS) is wrapped in a conditional
check because the `room_matches` table does not exist in production.

Changes applied:
1. Creates 4 helper functions (SECURITY DEFINER, search_path='')
2. Establishes RLS policies for 12 tables (idempotent — drops then recreates)
3. Enables RLS on 6 public-read reference tables (with IF EXISTS guards)
4. Revokes column-level privileges on `profiles.wallet_balance`
5. Grants explicit column-level access to safe profile fields
6. Revokes table-level write access on `transactions` and `unlocked_picks`
7. Creates `process_stripe_topup` RPC (service_role only)
8. Creates `purchase_pick` RPC (authenticated + service_role)

## How to Apply

### Option A: Supabase Dashboard (Recommended)

1. Go to https://supabase.com/dashboard/project/fckmgsmyxctwkpdpicrq
2. Navigate to SQL Editor
3. Paste the entire contents of `APPLY_SECURITY_BASELINE.sql`
4. Click "Run"
5. Verify it completes without errors

### Option B: psql (requires DB password)

```bash
psql "postgresql://postgres.fckmgsmyxctwkpdpicrq:[PASSWORD]@aws-0-ap-south-1.pooler.supabase.com:6543/postgres" \
  -f scripts/db/APPLY_SECURITY_BASELINE.sql
```

Get the password from Supabase Dashboard → Settings → Database.

### Option C: Supabase CLI

```bash
supabase db push --linked
```

## Pre-Application Checklist

- [ ] Verify no active users are performing wallet operations (Stripe is not configured, so this is automatically true)
- [ ] Verify `debit_wallet` and `credit_wallet` currently exist (they do — verified)
- [ ] Verify the migration is wrapped in BEGIN/COMMIT (it is — atomic)

## Post-Application Verification

After applying, run these checks:

```sql
-- 1. Verify functions exist
SELECT proname, prosecdef, proconfig
FROM pg_proc
WHERE proname IN ('is_room_member', 'is_room_admin', 'room_is_public',
                  'get_my_wallet_balance', 'process_stripe_topup', 'purchase_pick')
  AND pronamespace = 'public'::regnamespace;

-- 2. Verify wallet_balance is not accessible via anon
-- (Run this as anon role — should return error or omit wallet_balance)
SET ROLE anon;
SELECT wallet_balance FROM public.profiles LIMIT 1;
-- Expected: permission denied for column wallet_balance
RESET ROLE;

-- 3. Verify process_stripe_topup works
SELECT public.process_stripe_topup(
  '00000000-0000-0000-0000-000000000000'::uuid,
  0::numeric,
  'test_verification'
);
-- Expected: 'invalid_amount' (amount <= 0)

-- 4. Verify get_my_wallet_balance works
SELECT public.get_my_wallet_balance();
-- Expected: 0 (no auth.uid() in SQL Editor context)
```

## Safety Properties

- **Atomic**: Wrapped in BEGIN/COMMIT — fails completely or succeeds completely
- **Idempotent for policies**: Uses DROP POLICY IF EXISTS before CREATE
- **Idempotent for functions**: Uses CREATE OR REPLACE
- **Non-destructive**: Does not DELETE data, DROP tables, or ALTER column types
- **Conditional**: Section 6 (room_matches) is skipped if table doesn't exist
- **Existing data preserved**: All wallet balances, transactions, profiles unchanged
