---
name: x402-markets
description: Call the x402-markets HTTP service for a live crypto spot price with 24h statistics from CoinGecko, or recent SEC filings for a US ticker from EDGAR. Use when an agent needs real market data per lookup.
---

# x402-markets

x402-markets is an Express service over two public data sources. Callers pay per lookup in USDC over x402 and the artifact comes back in the response body.

## Run it

No package is published and there is no hosted instance, so run it from a clone: `git clone https://github.com/nirholas/x402-markets && cd x402-markets`, then `npm install`, `cp .env.example .env`, and `npm run dev` (tsx `src/server.ts`). It listens on `PORT`, default 4023. For production use `npm run build` then `npm start`.

Key env vars: `PORT`, `CONTACT_EMAIL` (sent to SEC EDGAR in the user agent; set your own, the default is the author's address), `COINGECKO_BASE_URL`, `PUBLIC_BASE_URL`, `PAY_TO_ADDRESS`, `SOLANA_PAY_TO_ADDRESS`, `NETWORK`, `SOLANA_NETWORK`, `SOLANA_RPC_URL`.

## Endpoints

- `GET /price/:coinId` ($0.001). `coinId` is a CoinGecko id such as `bitcoin`. Optional `vs` query (default `usd`). Returns spot price, 1h, 24h and 7d change, 24h range, volume, market cap, supply, and all-time high and low.
- `GET /filings/:ticker` ($0.003). `ticker` is a US-listed symbol. Optional `limit` (1 to 100, default 20) and `forms` (comma-separated form types, for example `10-K,8-K`). Returns recent SEC filings from EDGAR.
- `GET /`, `GET /health`, `GET /.well-known/x402`, `GET /skill.md`, `GET /openapi.json` (free).

Errors: 400 `missing_ticker`, `invalid_limit`, `invalid_coin_id`, `invalid_currency`; unknown routes return 404 `not_found`; upstream failures are reported with the upstream status.

Example: `GET {BASE_URL}/price/bitcoin?vs=usd`, then `GET {BASE_URL}/filings/AAPL?limit=5&forms=10-K,10-Q`. The data is informational and is not investment advice. This service only reads prices; it does not trade.

## Paying

Every paid route answers an unpaid request with HTTP 402 and a body whose `accepts` array lists two rails: USDC on Base (`base-sepolia` by default, `base` via `NETWORK`) and USDC on Solana (`solana` by default, `solana-devnet` via `SOLANA_NETWORK`). Pick the entry your wallet can sign, sign the USDC payment (EIP-3009 on Base, SPL `transferChecked` on Solana), and retry with the base64 `X-PAYMENT` header. The artifact is in the 200 body and the settlement receipt is in the `X-PAYMENT-RESPONSE` header. On the EVM rail `x402-fetch` with `viem` does this for you; `npm run client` runs `examples/agent-client.ts`, which reads `BASE_URL` and `PRIVATE_KEY`.

Discovery: `GET /.well-known/x402` lists routes, prices and rails, and `GET /skill.md` serves the repo's own reference. Paying moves real USDC on the configured network, so show the user the route, amount and rail first and wait for a yes before any paid call. Use a throwaway wallet on `base-sepolia` or `solana-devnet` for testing.
