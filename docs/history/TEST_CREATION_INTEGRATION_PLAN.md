# Test Creation Integration Plan

The goal is to replace the current `TestDesignerPortal.tsx` in NeuroClass with the `TestWizard.tsx` (or the complete test creation portal) from the `chinmaystudio/test_creation` repository. However, the user explicitly requested:
> "taking that repo as refrance and integrate it into my web do required changes into database also as well as do changes by taking in account that i have to deploy test_creation repo as another project so do changes accordingly"

## Architecture Discovery

1. **Independent Deployment Model (The "Another Project" Requirement):**
   - The `test_creation` repo is a full-stack application (Vite + React frontend, Express/Hono/TRPC backend).
   - NeuroClass will redirect instructors to the deployed `test_creation` portal (e.g., via a "Launch Advanced Test Designer" button).
   
2. **Database Conflict Identified:**
   - `test_creation` uses Drizzle ORM configured for **MySQL** (`mysql2`, `mysqlTable`, `mysqlEnum`).
   - NeuroClass uses **PostgreSQL** (Supabase).
   - Because `test_creation` must be deployed as "another project" and uses a completely different database engine, it cannot easily share the exact same database instance as NeuroClass without a massive rewrite of its Drizzle schema to Postgres.
   - *Solution:* The `test_creation` portal will run on its own MySQL database (e.g., PlanetScale, TiDB, or a separate MySQL instance). NeuroClass will simply provide a URL link to the portal. The test portal will manage its own tests and questions. 

3. **NeuroClass Frontend Changes:**
   - In `ClassroomView.tsx` and `InstructorDashboard.tsx`, we will replace the inline `<TestDesignerPortal>` with an external link or an iframe pointing to the external test creation URL (e.g., `https://neuroclass-test-portal.vercel.app/test-wizard`).
   - We will make it configurable via an environment variable `VITE_TEST_PORTAL_URL`.
   - We will remove the old `TestDesignerPortal.tsx` from NeuroClass to clean up the codebase.

Let's implement the frontend changes in NeuroClass.
