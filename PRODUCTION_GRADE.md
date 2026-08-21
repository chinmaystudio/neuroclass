# NeuroClass Production-Grade Architecture & Implementation Guide

## Executive Summary

NeuroClass is a next-generation AI-powered educational platform integrated with the **x402 v2 pay-per-call protocol** and **USDC ASA settlement on Algorand Testnet**. Its primary paying-user use case is an instructor who pays a small USDC amount each time they generate an AI test or assignment. The platform combines rigorous error handling, secure biometric proctoring, facilitator-backed payment verification, and containerized deployment readiness.

---

## 1. System Architecture Overview

The production architecture decouples the client-side futuristic UI from resilient backend microservices, which govern AI intelligence and cryptographic settlement via Algorand.

```
┌────────────────────────────────────────────────────────┐
│                   Frontend (React / Vite)              │
│       Dashboard | Classrooms | AI Marketplace | Wallet │
└───────────────────────────┬────────────────────────────┘
                            │ HTTPS / REST / JSON-RPC
                            ▼
┌────────────────────────────────────────────────────────┐
│             Backend API Gateway (Node.js / Express)    │
│      Auth & Session | Error Middleware | Rate Limiting │
└───────┬───────────────────┬────────────────────┬───────┘
        │                   │                    │
        ▼                   ▼                    ▼
┌──────────────┐    ┌──────────────┐    ┌────────────────┐
│  AI Service  │    │  x402 Layer  │    │ Supabase / SQL │
│ (Google GenAI│    │ & Verification│   │  (PostgreSQL)  │
│  / OpenAI)   │    └──────┬───────┘    └────────────────┘
└──────────────┘           │
                           ▼
                 ┌──────────────────┐
                 │ Algorand TestNet │
                 │ Smart Settlement │
                 └──────────────────┘
```

---

## 2. Key Production Enhancements

### A. Standards-Compliant Algorand x402 Gateway
NeuroClass uses the official `@x402/hono`, `@x402/core`, `@x402/avm`, and `@x402/fetch` packages to gate the two paying-user AI services with exact USDC ASA payments on Algorand Testnet.

- **Challenge**: `POST /api/ai/generate-test` and `POST /api/ai/generate-assignment` return HTTP `402 Payment Required` with a base64 `PAYMENT-REQUIRED` header containing x402 v2 requirements, the full Algorand Testnet CAIP-2 network, USDC ASA `10458941`, the configured treasury, and the exact micro-USDC price.
- **Client retry**: The browser uses `@x402/fetch` and the AVM exact client. Pera Wallet signs the transaction group after the initial 402 response, and the wrapper retries the original request with the standard `PAYMENT-SIGNATURE` header.
- **Facilitator verification and settlement**: The Hono resource server uses `https://facilitator.goplausible.xyz`, which verifies the AVM payload and settles the USDC transfer before the paid handler response is released.
- **Transaction-linked receipts**: Every successful paid response includes `x402.transactionId`, `x402.network`, `x402.asset`, and the encoded `receiptHeader` in JSON, plus `PAYMENT-RESPONSE` and `X-402-Transaction-Id` response headers.
- **Pay-per-use pricing**: Test generation defaults to `100000` micro-USDC (`0.10 USDC`) and assignment generation defaults to `50000` micro-USDC (`0.05 USDC`); these are configurable per call route and are not subscriptions.
- **Non-custodial security**: NeuroClass never generates or stores a browser mnemonic. x402 settlement does not require a treasury private key in the application; any operational refund signer must be managed outside source control and outside the x402 request path.

### B. Enterprise-Grade Security & Error Handling
- **Centralized Error Middleware**: Standardized JSON error responses with operational vs. programming error classification.
- **Row-Level Security (RLS)**: Enforced PostgreSQL policies on Supabase for data isolation across teachers, students, and classrooms.
- **Biometric Integrity**: Face-ID embedding verification logs for proctoring sessions with tamper-evident violation tracking.

### C. DevOps & Containerization
- **Multi-Stage Dockerfile**: Optimized container build supporting Node.js 20+ runtime for backend and API services.
- **Docker Compose Orchestration**: Seamless local and staging deployment integrating PostgreSQL, Redis cache, and Node services.
- **GitHub Actions CI/CD**: Automated workflows for TypeScript compilation, unit testing, linting, and staging deployment.

---

## 3. Production Deployment Instructions

1. **Environment Configuration**:
   Configure the backend with `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `GEMINI_API_KEY`, `NEUROCLASS_TREASURY_ADDRESS`, `X402_FACILITATOR_URL=https://facilitator.goplausible.xyz`, `X402_TEST_PRICE_USDC_MICRO=100000`, and `X402_ASSIGNMENT_PRICE_USDC_MICRO=50000`. Do not configure a mnemonic for the x402 settlement path. If a separate operational refund process is introduced later, its signer must be a fresh, dedicated wallet stored only in a deployment secret manager; never commit it to Git.

   Configure the frontend with `VITE_BACKEND_URL`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_ALGOD_SERVER_URL`, and `VITE_NEUROCLASS_TREASURY_ADDRESS`. `VITE_SUPABASE_PUBLISHABLE_KEY` is a browser-safe Supabase publishable key; never use `SUPABASE_SERVICE_ROLE_KEY` in frontend variables. The current project URL is `https://hdjtgyvdlxwntfriqhff.supabase.co`. The user’s Pera Wallet must be on Algorand Testnet, hold Testnet USDC ASA `10458941`, and be opted into that ASA before using paid AI features.
2. **Build & Run with Docker**:
   ```bash
   docker-compose up --build -d
   ```
3. **Database Migration**:
   Execute `supabase/schema.sql` on your PostgreSQL / Supabase instance. The payment ledger is server-managed; do not restore anonymous SELECT or INSERT policies for `x402_payments`.
4. **Wallet flow**:
   Open the AI Test Designer, submit the request, observe the HTTP 402 challenge, connect Pera Wallet, and approve the exact USDC ASA transfer. The x402 fetch wrapper retries with `PAYMENT-SIGNATURE`; the facilitator verifies and settles the transfer, then the API returns the generated content together with the Algorand transaction ID receipt.
5. **Submission use case and five-minute demo**:
   Demonstrate an instructor generating a test as a real pay-per-call service. In minute one, show the pricing and the unpaid 402 challenge. In minutes two and three, connect Pera, sign the Testnet USDC transfer, and show the retry. In minute four, show the generated test and the `x402.transactionId`; open the Algorand Testnet Explorer to verify the settlement. In minute five, briefly show Facecam attendance/proctoring and explain the business model: instructors pay `0.10 USDC` per generated test or `0.05 USDC` per generated assignment, with no subscription requirement.
6. **Validation**:
   ```bash
   npm run lint
   npm run build
   (cd backend && npm run typecheck && npm run build)
   # unpaid challenge smoke test
   curl -i -X POST "$BACKEND_URL/api/ai/generate-test" -H 'Content-Type: application/json' \
     --data '{"topic":"Graphs","subject":"Computer Science","difficulty":"Medium","questionCount":5,"durationMins":45,"totalMarks":50}'
   ```

---
*Prepared by Manus AI for NeuroClass Project*
