# x402 Research Findings

## Sources reviewed

1. [Algorand Developer Portal — x402 on Algorand](https://dev.algorand.co/resources/x402-on-algorand/)
2. [x402 Documentation — HTTP 402](https://docs.x402.org/core-concepts/http-402)

## Verified protocol behavior

The Algorand guide describes x402 as an HTTP-native pay-per-request flow with a client, resource server, facilitator, and Algorand settlement path. The resource server returns payment requirements with HTTP 402; the client signs the required transaction group; the client retries with a payment signature; the facilitator verifies and settles; and the resource server returns the paid response and settlement information.

The x402 V2 documentation defines three standardized Base64-encoded JSON headers: `PAYMENT-REQUIRED` from server to client on a 402 challenge, `PAYMENT-SIGNATURE` from client to server on the retry, and `PAYMENT-RESPONSE` from server to client after settlement. The client UI should therefore expose both the challenge/payment stages and the final settlement response, while treating the server settlement response as the authoritative receipt.

## Implementation decisions

- Keep the existing exact AVM scheme and USDC ASA payment model, but surface the challenge, wallet signing, facilitator verification, settlement, and receipt stages in a shared frontend event timeline.
- Include a canonical Algorand Testnet transaction URL derived from the settled transaction ID, while keeping the raw transaction ID and encoded receipt available for verification.
- Persist payment ledger rows server-side only; never expose service-role operations to the browser.
- Add idempotency protections around payment persistence and entitlement creation so retries do not duplicate business effects.
- Keep pricing in USDC micro-units consistently across backend, frontend, and receipt display; do not label USDC payments as ALGO.
