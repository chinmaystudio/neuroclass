# Architecture Research Findings

## Supabase private classroom materials

Supabase documents that private buckets are subject to RLS for all operations, including downloads. Private assets can be downloaded with an authenticated JWT or exposed through a time-limited signed URL. Public buckets bypass access control for retrieval, so classroom learning files must remain private. Source: [Supabase Storage Buckets](https://supabase.com/docs/guides/storage/buckets/fundamentals).

**Design consequence:** store classroom materials in a private bucket, keep metadata and visibility in Postgres, authorize material access through classroom membership/teacher ownership, and generate short-lived signed URLs only from an authorized backend path. Do not put public asset URLs into AI prompts or student-facing records.

## Algorand verification primitives

The official Algorand REST API documentation separates Algod, Indexer, and KMD APIs. The Indexer provides search and lookup endpoints for indexed chain data, while Algod provides node operations and confirmation-related APIs. Source: [Algorand REST APIs](https://developer.algorand.org/docs/rest-apis/indexer/) and current reference links at [Algorand Developer Portal](https://dev.algorand.co/reference/rest-api/indexer/).

**Design consequence:** payment receipts should be backed by the server’s verified transaction record, not only a URL parameter or frontend header. Reconciliation should query the configured network’s Indexer/Algod endpoint, record verification timestamps and failures, and preserve the original x402 facilitator settlement response.

## x402 settlement boundary

The existing x402 research remains the protocol authority for the project: the server declares payment requirements, the facilitator verifies and settles the payment, and access is granted only after server-side settlement. The frontend timeline is evidence of the backend lifecycle, not an authorization source.

**Design consequence:** introduce a durable request/state-transition record and reconcile delayed or ambiguous settlement states without granting access on `submitted` alone.
