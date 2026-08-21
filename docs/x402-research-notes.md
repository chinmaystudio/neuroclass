# x402 Algorand Research Notes

## Sources reviewed

1. Algorand Developer Portal: https://dev.algorand.co/resources/x402-on-algorand/
2. GoPlausible AVM Hono examples: https://github.com/GoPlausible/.github/blob/main/profile/algorand-x402-documentation/typescript/x402-avm-hono-examples.md

## Findings

The required x402 flow has three parties: client, resource server, and facilitator. The client first calls a paid route, receives HTTP 402 payment requirements, signs/submits an Algorand payment, then retries with proof. The resource server asks a facilitator to verify the payment payload and settle it before returning the paid response.

The official Algorand guidance supports Algorand Testnet assets including USDC, provided accounts are opted into the asset. The Testnet CAIP-2 network identifier is `algorand:SGO1GKSzyE7IEPItTxCByw9x8FmnrCDexi9/cOUJOiI=`. The recommended TypeScript client packages include `@x402/core`, `@x402/fetch`, and `@x402/avm`; the resource-server examples use `@x402/core`, `@x402/avm`, `@x402/hono`, and `@x402-avm/extensions`.

The official AVM Hono example configures a facilitator with `x402Facilitator`, `registerExactAvmScheme`, `toFacilitatorAvmSigner`, and `ALGORAND_TESTNET_CAIP2`. It exposes `/verify`, `/settle`, and `/supported` endpoints. The resource server should use the facilitator URL `https://facilitator.goplausible.xyz` (or a configurable equivalent) instead of treating a raw transaction ID as payment proof.

The current NeuroClass implementation uses custom ALGO transaction verification and a Pera wallet flow. That must be replaced or adapted to use the standard x402 payment payload and USDC ASA requirements. Every successful paid response must carry the settled transaction ID in a stable response field and header, and the UI should display it as a receipt.

## Live facilitator observations

The live facilitator home page at https://facilitator.goplausible.xyz/ reports version 2.0.0 and exposes `/verify` and `/settle` core endpoints, along with `/supported` and `/health`. It states that it verifies and settles stablecoin payments across Algorand, Base, and Solana.

The live `/supported` page at https://facilitator.goplausible.xyz/supported reports six network configurations, including Algorand Mainnet and Algorand Testnet. Both use the `exact` scheme and x402 v2. The visible Algorand Testnet CAIP-2 prefix is `algorand:SGO1GKSzyE...`, matching the full identifier from the Algorand documentation. The facilitator exposes an AVM settlement signer, confirming the service is ready for AVM verification and settlement.

## Merchant guide findings

The official GoPlausible merchant guide at https://facilitator.goplausible.xyz/guide specifies the Algorand Testnet USDC ASA as `10458941`, with six-decimal units. It maps a `$0.01` price to amount `10000` and supports explicit requirements such as `price: { asset: "10458941", amount: "10000", extra: { name: "USDC", decimals: 6 } }`. It lists the Testnet CAIP-2 network as `algorand:SGO1GKSzyE7IEPItTxCByw9x8FmnrCDexi9/cOUJOiI=` and the facilitator base URL as `https://facilitator.goplausible.xyz`.

The route `/use-x402` returned 404, so implementation should rely on the official Algorand Developer Portal and GoPlausible repository examples rather than assuming that route exists.


## Implementation verification — 13 August 2026

The live GoPlausible facilitator advertises Algorand Testnet using the full genesis-hash CAIP-2 identifier `algorand:SGO1GKSzyE7IEPItTxCByw9x8FmnrCDexi9/cOUJOiI=`. The installed AVM package exposes a shortened alias internally, but the facilitator requires the full identifier; the resource server and browser client now use the full value.

The official Testnet USDC ASA is `10458941` with six decimals. The configured receiver `HYNRAYO4IGZRBJ6MWZTBIRAOVWQFZODFDQBSJNQNFSP3TRGV5IYOOAZN5A` is reachable on Testnet, has opted into the asset, and currently reports a Testnet USDC holding through the public indexer.

A local unpaid `POST /api/ai/generate-test` smoke test now returns `HTTP 402 Payment Required` with a base64 `PAYMENT-REQUIRED` header containing x402 v2 requirements, the full Algorand Testnet network, USDC ASA `10458941`, the configured pay-to address, and the `100000` micro-USDC price. Browser CORS exposes `PAYMENT-REQUIRED`, `PAYMENT-RESPONSE`, and `X-402-Transaction-Id`.
