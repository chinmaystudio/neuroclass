# Supabase Vector Schema Verification

I verified the live NeuroClass Supabase project `hdjtgyvdlxwntfriqhff` using read-only metadata and SQL queries.

## Live Schema

The live database contains `public.face_embeddings`. Its relevant columns are:

| Column | Live type | Role |
| :--- | :--- | :--- |
| `id` | `uuid` | Embedding-row identifier. |
| `profile_id` | `uuid` | Foreign key to `face_profiles.id`. |
| `student_id` | `uuid` | Foreign key to `students.id`. |
| `classroom_id` | `uuid` | Foreign key to `classrooms.id`. |
| `embedding` | PostgreSQL `vector` | The ArcFace embedding column. |
| `source` | `text` | Embedding provenance. |
| `quality_score` | `numeric` | Enrollment quality metadata. |
| `created_at` | `timestamptz` | Creation timestamp. |

The live PostgreSQL type modifier for `face_embeddings.embedding` is **512**, confirming that the column is `vector(512)`. The query returned `udt_name = vector`, `data_type = USER-DEFINED`, and `atttypmod = 512`.

## Current Production Row Count

A read-only count query returned:

```json
{
  "rows": 0,
  "embeddings": 0
}
```

This is important: the table and its 512-dimensional schema are present, but the connected production database currently contains no persisted face-embedding rows. Therefore, the system is not currently using Supabase as a populated durable embedding catalog for this project. Enrollment must be run successfully against the deployed service, and the Vercel/Render enrollment persistence path must be verified afterward.

## Storage Size

A single float32 vector of 512 dimensions is approximately 2,048 bytes before PostgreSQL and pgvector row/index overhead. At 1,000 students, the raw numeric payload is approximately 1.95 MiB; actual database usage is higher after row, transaction, and index overhead.

The benchmark’s one-centroid-per-student design keeps the embedding count at one vector per student. It does not load a second InsightFace model and does not increase the Render model footprint.

## Benchmark Interpretation

The 1,000-identity benchmark used a local FAISS catalog populated with one normalized centroid vector per registered identity. It validates the recognition algorithm and storage accounting, but it does not prove that the live Supabase table is populated. The production row count above is the authoritative live-database finding.
