# NeuroClass x402 Agentic Payments Submission Architecture

## Product use case and business model

NeuroClass is a pay-per-use education platform for instructors. The primary paying-user action is **AI test generation**: an instructor submits a subject, topic, difficulty, question count, duration, and marks, then pays `0.10 USDC` for one generated test paper. The secondary paying-user action is **AI assignment generation**, priced at `0.05 USDC` per generated assignment. There is no subscription requirement and no recurring billing in either flow.

The product value is practical: instructors pay only when they need assessment content, receive a structured test or assignment, and can verify the settlement on Algorand Testnet using the returned transaction ID. The same application also provides Facecam attendance and AI proctoring as non-payment-gated classroom features.

## Standards-based architecture

| Layer | Implementation | Responsibility |
|---|---|---|
| Browser client | React/Vite, `@x402/fetch`, `@x402/avm`, `@perawallet/connect` | Calls the paid route, handles the 402 challenge, asks Pera to sign the AVM transaction, retries with `PAYMENT-SIGNATURE`, and displays the receipt. |
| Resource server | Next.js route adapters and Hono x402 middleware | Declares exact payment requirements for each paid route and blocks the business handler until payment is verified and settled. |
| Facilitator | `https://facilitator.goplausible.xyz` | Verifies the signed AVM payment payload and settles the USDC ASA transfer to the merchant receiver. |
| Settlement asset | Algorand Testnet USDC ASA `10458941` with six decimals | Provides the stablecoin pay-per-call denomination. |
| Merchant receiver | `HYNRAYO4IGZRBJ6MWZTBIRAOVWQFZODFDQBSJNQNFSP3TRGV5IYOOAZN5A` | Receives the settled USDC transfer and is opted into the Testnet USDC ASA. |
| Receipt contract | JSON `x402` object plus `PAYMENT-RESPONSE` and `X-402-Transaction-Id` headers | Proves that the paid response is linked to a facilitator settlement transaction. |
| Settlement ledger | Supabase `public.x402_payments`, service-role only | Records the verified settlement transaction, network, USDC ASA, micro-USDC amount, payer, endpoint, and facilitator response without storing payer secrets. |

The facilitator-compatible Algorand Testnet CAIP-2 identifier is `algorand:SGO1GKSzyE7IEPItTxCByw9x8FmnrCDexi9/cOUJOiI=`. This full genesis-hash identifier is used in the server route requirements and browser client; the installed AVM package normalizes it to its internal alias when processing transactions.

## Complete payment sequence

1. The browser calls `POST /api/ai/generate-test` without a payment signature.
2. The resource server returns `402 Payment Required` with a base64 `PAYMENT-REQUIRED` header. The requirement includes scheme `exact`, the Algorand Testnet network, USDC ASA `10458941`, amount `100000`, the merchant receiver, and a 120-second timeout.
3. The shared x402 browser wrapper decodes the challenge and constructs the payment transaction. Pera Wallet asks the user to approve the exact USDC amount; NeuroClass does not receive or store the user’s private key.
4. The browser retries the original request with the standard `PAYMENT-SIGNATURE` header containing the signed AVM payment payload.
5. The Hono x402 resource server sends the payload to the GoPlausible facilitator. The facilitator verifies the signature, network, asset, amount, receiver, timeout, and transaction validity, then settles the transfer.
6. Only after successful settlement does the AI handler call the generation service and return the generated content.
7. The server records the decoded settlement receipt in the service-role-only `public.x402_payments` ledger using the settlement transaction as the idempotency key. A duplicate transaction is ignored safely.
8. The response includes the facilitator’s encoded `PAYMENT-RESPONSE`, the `X-402-Transaction-Id` header, and the JSON object below.

```json
{
  "x402": {
    "protocolVersion": 2,
    "network": "algorand:SGO1GKSzyE7IEPItTxCByw9x8FmnrCDexi9/cOUJOiI=",
    "asset": "10458941",
    "transactionId": "<facilitator-settlement-transaction-id>",
    "payer": "<payer-address>",
    "amount": "100000",
    "receiptHeader": "<base64-payment-response>"
  }
}
```

A successful paid response without a transaction ID is treated as a contract violation. The browser UI surfaces the transaction ID and links it to the Algorand Testnet Explorer.

## Endpoint contract

| Endpoint | Price | Unpaid response | Paid response |
|---|---:|---|---|
| `POST /api/ai/generate-test` | `100000` micro-USDC (`0.10 USDC`) | HTTP 402 with `PAYMENT-REQUIRED` | Generated test plus x402 settlement receipt |
| `POST /api/ai/generate-assignment` | `50000` micro-USDC (`0.05 USDC`) | HTTP 402 with `PAYMENT-REQUIRED` | Generated assignment plus x402 settlement receipt |
| `GET /api/health` | Free | HTTP 200 | Operational status only; not a paid route |

All paid routes allow browser preflight requests and expose `PAYMENT-REQUIRED`, `PAYMENT-RESPONSE`, and `X-402-Transaction-Id`. The AI request payload remains bounded and is validated before generation to prevent oversized or malformed calls.

## Configuration

Backend deployment variables:

```dotenv
NEUROCLASS_TREASURY_ADDRESS=HYNRAYO4IGZRBJ6MWZTBIRAOVWQFZODFDQBSJNQNFSP3TRGV5IYOOAZN5A
X402_FACILITATOR_URL=https://facilitator.goplausible.xyz
X402_TEST_PRICE_USDC_MICRO=100000
X402_ASSIGNMENT_PRICE_USDC_MICRO=50000
```

Frontend deployment variables:

```dotenv
VITE_BACKEND_URL=https://<backend-host>
VITE_ALGOD_SERVER_URL=https://testnet-api.algonode.cloud
VITE_ALGORAND_PORT=443
VITE_NEUROCLASS_TREASURY_ADDRESS=HYNRAYO4IGZRBJ6MWZTBIRAOVWQFZODFDQBSJNQNFSP3TRGV5IYOOAZN5A
VITE_X402_NETWORK=algorand:SGO1GKSzyE7IEPItTxCByw9x8FmnrCDexi9/cOUJOiI=
VITE_X402_USDC_ASSET_ID=10458941
```

The merchant account must be opted into the USDC ASA. The payer’s Pera account must hold Testnet USDC and be opted into the same ASA. x402 settlement is facilitator-backed and does not require a merchant mnemonic in the web application. The server ledger uses `SUPABASE_SERVICE_ROLE_KEY` and has no anonymous or authenticated policies. Any future manual refund signer must be a fresh dedicated wallet managed through a deployment secret manager, never a committed file. The legacy `public.user_wallets` custodial table has been removed.

## Validation and live-demo runbook

Before the demonstration, run the following checks:

```bash
npm run lint
npm run build
(cd backend && npm run typecheck && npm run build)
curl -i -X POST "$BACKEND_URL/api/ai/generate-test" \
  -H 'Content-Type: application/json' \
  --data '{"topic":"Graphs","subject":"Computer Science","difficulty":"Medium","questionCount":5,"durationMins":45,"totalMarks":50}'
```

The curl request must return HTTP 402 and a `PAYMENT-REQUIRED` header. During the five-minute demo, show the unpaid challenge first, connect Pera Wallet on Testnet, approve the exact USDC amount, show the automatic retry, display the generated test, copy the returned transaction ID, and open the Algorand Testnet Explorer to verify the settlement. Use the final minute to show Facecam attendance/proctoring and explain the instructor pay-per-call value proposition.

## Mainnet migration

The current submission target is Algorand Testnet. For a final Mainnet deployment, use the facilitator-supported Mainnet CAIP-2 identifier and Mainnet USDC ASA only after changing the merchant account, asset opt-in, pricing, wallet-network UX, and environment configuration together. Do not mix a Mainnet receiver or asset with Testnet requirements.

## References

[1]: https://dev.algorand.co/resources/x402-on-algorand/ "Algorand Developer Portal — x402 on Algorand"

[2]: https://github.com/GoPlausible/.github/blob/main/profile/algorand-x402-documentation/typescript/x402-avm-hono-examples.md "GoPlausible — TypeScript AVM Hono examples"

[3]: https://facilitator.goplausible.xyz/ "GoPlausible x402 facilitator"

[4]: https://facilitator.goplausible.xyz/supported "GoPlausible facilitator supported methods"
