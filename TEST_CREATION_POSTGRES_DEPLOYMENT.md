# Shared Supabase Database Integration Instructions

I have successfully re-architected the `test_creation` repository so it can safely share the **exact same Supabase PostgreSQL database** as your NeuroClass project without destroying your existing data.

## What Was Changed in `test_creation`

1. **Database Engine Conversion:**
   The original `test_creation` codebase was hardcoded for MySQL (`mysql2`). I uninstalled the MySQL dependencies, installed PostgreSQL (`postgres`), and updated the Drizzle configuration to output Postgres-compatible SQL.
2. **Safe Schema Namespacing:**
   To ensure the `test_creation` tables (like `users` and `classrooms`) do not collide with NeuroClass's existing `users` and `classrooms` tables, I prefixed all tables in `test_creation` with `tc_` (e.g., `tc_users`, `tc_classrooms`, `tc_tests`). This allows both projects to live in the exact same Supabase database in perfect harmony.
3. **Identity & Authentication:**
   The `test_creation` portal will continue to handle its own OAuth login flow, but it will store its users safely in the `tc_users` table inside your Supabase project.

## Action Required: Deploying the Shared Database

You must now deploy the `test_creation` project and connect it to your Supabase database:

1. **Set Environment Variables in `test_creation`:**
   When you deploy `chinmaystudio/test_creation` to Vercel/Render, add your Supabase connection string as the `DATABASE_URL` environment variable.
   *Example:* `DATABASE_URL=postgres://postgres.[project-ref]:[password]@aws-0-ap-south-1.pooler.supabase.com:6543/postgres`
2. **Run the Database Migration:**
   During the deployment build step, or locally in the `test_creation` repository, run:
   ```bash
   npm run db:push
   ```
   This will safely create all the `tc_` prefixed tables inside your Supabase database.
3. **Update NeuroClass (Already Done):**
   NeuroClass is already configured to redirect to your test portal. Once the portal is deployed, just update `VITE_TEST_PORTAL_URL` in your NeuroClass environment variables to point to the new portal URL!
