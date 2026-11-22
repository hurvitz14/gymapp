Migrations applied to the Supabase project, in order:

1. `20261122085254_core_schema.sql` — tables, RLS, PR triggers, exercise library
2. `checkins_coach_and_estimates` — roles/coach links, weekly check-ins, replies, private photo bucket, AI-estimate usage cap.
   (Applied via the Supabase MCP; the exact SQL is in `20261122123000_checkins_coach_and_estimates.sql`.)
