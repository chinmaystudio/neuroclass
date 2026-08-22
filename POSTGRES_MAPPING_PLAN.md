# Test Creation Postgres Mapping Plan

To deploy `test_creation` independently but connect it to the same Supabase Postgres database as NeuroClass, we need to convert its Drizzle schema from MySQL to PostgreSQL.

## Changes Required in `test_creation`

1. **Dependencies:**
   - Uninstall `mysql2`.
   - Install `postgres` or `@supabase/supabase-js` (or just use `postgres` for Drizzle).

2. **Drizzle Config (`drizzle.config.ts`):**
   - Change `dialect: "mysql"` to `dialect: "postgresql"`.

3. **Schema (`drizzle/schema.ts`):**
   - Change imports from `drizzle-orm/mysql-core` to `drizzle-orm/pg-core`.
   - Replace `mysqlTable` with `pgTable`.
   - Replace `mysqlEnum` with `pgEnum`.
   - Replace `longtext` with `text`.
   - Replace `double` with `doublePrecision`.
   - Replace `int` with `integer`.
   - Since NeuroClass uses UUIDs for `users.id` (auth.users), we must change `id: int("id").autoincrement().primaryKey()` to `id: uuid("id").primaryKey().defaultRandom()` for any user references. 
   - *Wait, NeuroClass already has a `classrooms` and `students` table.* If `test_creation` tries to create its own `classrooms` and `users` table, it will clash with NeuroClass!

## Database Clash Resolution

NeuroClass already has:
- `classrooms` (id UUID, name, user_id UUID)
- `students` (id UUID, user_id UUID, classroom_id UUID)
- `tests` (id UUID, classroom_id UUID, title, test_data JSONB)

`test_creation` expects:
- `users` (id INT, openId, role)
- `classrooms` (id VARCHAR, name, description, ownerId)
- `tests` (id VARCHAR, title, description, classroomId, creatorId)

**This is a massive schema conflict.** 
If we simply change `test_creation` to Postgres and run `drizzle-kit push`, it will either fail or overwrite NeuroClass's tables!

## Recommended Integration Strategy

Since the user asked to "integrate it into my web do required changes into database also as well as do changes by taking in account that i have to deploy test_creation repo as another project", the safest way to use the *same* Supabase project without destroying NeuroClass is:

1. **Namespace the `test_creation` tables:**
   Prefix all `test_creation` tables with `tc_` (e.g., `tc_users`, `tc_classrooms`, `tc_tests`). This completely avoids clashing with NeuroClass's existing tables.
   
2. **PostgreSQL Conversion:**
   Convert the namespaced schema to PostgreSQL in the `test_creation` repo.

3. **Auth/Identity Sync (Optional but ideal):**
   When a user logs into `test_creation` via OAuth (which it uses), it will create a `tc_users` record. The `tc_classrooms` will be separate from NeuroClass `classrooms`. 
   If the user expects them to share the *exact same* classrooms, we would have to completely rewrite the `test_creation` backend to use Supabase Auth and the NeuroClass schema. But the user said "taking that repo as refrance... deploy test_creation repo as another project". A full rewrite of the reference repo's backend violates "minimal integration".

Let's implement the namespacing and Postgres conversion in `test_creation`.
