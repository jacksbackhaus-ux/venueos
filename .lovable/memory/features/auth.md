---
name: Auth architecture
description: Multi-tenant auth model using email/password (not magic link), staff codes, RLS helpers, signup/onboarding flow
type: feature
---
## Auth Model
- **Owner/Manager**: Email + password signup via Supabase Auth (`signUp`), login via `signInWithPassword`
- **Staff**: Staff code login per site via `validate_staff_code` RPC (no Supabase auth user)
- Magic link was REMOVED — caused deadlocks in preview environment

## Signup Flow
1. Owner fills signup form (name, email, password, org name, site name)
2. `supabase.auth.signUp()` with `signup_pending: true` in user_metadata
3. Email verification required before first login
4. After verification, user logs in → AuthGuard redirects to `/onboarding`
5. Onboarding page calls `handle_signup` RPC → creates org, site, user, membership, org_users
6. Clears `signup_pending` flag → redirects to dashboard

## Password Security
- Passwords hashed by Supabase (bcrypt) — never stored in plaintext
- HIBP check enabled — rejects known breached passwords
- Min 6 characters enforced client-side

## Key Constraint: Do NOT re-add magic link auth
