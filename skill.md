# x402-markets — agent skill

Two market-data lookups, each returning its answer in the paid response.
`/price/{coinId}` gives a live CoinGecko snapshot: spot price, 1h/24h/7d
change, the 24h high–low range, volume, market cap, circulating and max supply,
and distance from all-time high and low. `/filings/{ticker}` resolves a US
ticker to its SEC CIK and returns the company's recent EDGAR filings, each with
its form type, filing and report dates, a direct link to the primary document,
decoded 8-K item codes, and a one-sentence summary of what that form actually
is. Both upstreams are keyless and queried live.

**Base URL:** `{BASE_URL}` (local default `http://localhost:4023`)

Every paid call returns the purchased artifact **in the 200 response body**.
There is nothing to poll and nothing to collect later.

## Payment

This service speaks **x402** (HTTP 402 Payment Required, <https://x402.org>).

**Pay in USDC on Base or Solana — your client picks the rail.**

| Rail | Network | Asset | payTo |
|------|---------|-------|-------|
| EVM | `base-sepolia` (`base` on mainnet) | USDC | `0x40252CFDF8B20Ed757D61ff157719F33Ec332402` |
| Solana | `solana` (`solana-devnet` on devnet) | USDC | `WwwuGbqHrwF5RG89KhUbmRWEvjnRH9k5kVM5p7T3WwW` |

Facilitator: `https://x402.org/facilitator` (verifies and settles both rails).

Flow:

1. Call the endpoint with no `X-PAYMENT` header. You get **402** with an
   `accepts` array holding **both** rails.
2. Pick a rail, sign the payment, and put the base64 payload in `X-PAYMENT`.
3. Repeat the request. You get **200** with the artifact, and a settlement
   receipt in the `X-PAYMENT-RESPONSE` header (base64 JSON:
   `{ success, rail, network, transaction, payer, amount, asset }`).

Use `x402-fetch` (EVM), a Solana x402 client, or any x402-aware HTTP client —
the wire format is the standard one.

```ts
import { wrapFetchWithPayment, createSigner } from "x402-fetch";
const signer = await createSigner("base-sepolia", process.env.PRIVATE_KEY!);
const pay = wrapFetchWithPayment(fetch, signer);
const res = await pay("{BASE_URL}/price/bitcoin");
const artifact = await res.json();
```

## Endpoints

### `GET /price/:coinId` — $0.001

Live crypto spot price and 24h statistics

| Param | In | Required | Type | Description |
|-------|----|----------|------|-------------|
| `coinId` | path | yes | string | CoinGecko coin id (`bitcoin`, `usd-coin`, `avalanche-2`) or a common ticker shorthand (`btc`, `eth`, `sol`). |
| `vs` | query | no | string | Quote currency. Default `usd`. Any CoinGecko-supported code — `eur`, `jpy`, `gbp`. |

**Returns** (`200 application/json`) — Spot price, 1h/24h/7d change, 24h high–low range, volume, market cap, supply, and distance from all-time high and low

```json
{
  "source": "coingecko",
  "id": "bitcoin",
  "symbol": "BTC",
  "name": "Bitcoin",
  "currency": "usd",
  "price": 64384,
  "marketCapRank": 1,
  "change": {
    "pct1h": 0.2,
    "pct24h": -0.3,
    "pct7d": -0.7,
    "abs24h": -75.5658198497913
  },
  "range24h": {
    "high": 64916,
    "low": 64114
  },
  "volume24h": 18458654525,
  "marketCap": 1291996236000,
  "fullyDilutedValuation": 1291996236000,
  "supply": {
    "circulating": 20066734,
    "total": 20066721,
    "max": 21000000
  },
  "allTimeHigh": {
    "price": 126080,
    "date": "2025-10-06T10:57:42.000Z",
    "changePct": -48.93369
  },
  "allTimeLow": {
    "price": 67.81,
    "date": "2013-07-05T16:00:00.000Z",
    "changePct": 94849.56131
  },
  "lastUpdated": "2026-08-07T02:52:20.000Z",
  "retrievedAt": "2026-08-07T02:52:23.481Z"
}
```

---

### `GET /filings/:ticker` — $0.003

Recent SEC EDGAR filings for a US-listed ticker, parsed and summarized

| Param | In | Required | Type | Description |
|-------|----|----------|------|-------------|
| `ticker` | path | yes | string | US-listed ticker symbol, e.g. `AAPL`, `NVDA`, `BRK.B`. Case-insensitive. |
| `limit` | query | no | integer | Filings to return, 1–100. Default 20. |
| `forms` | query | no | string | Comma-separated form types to keep, e.g. `10-K,10-Q,8-K`. Omit for every recent filing including Forms 3/4/5. |

**Returns** (`200 application/json`) — Company identity (CIK, SIC, exchanges) plus recent filings with form, dates, direct document link, decoded 8-K items, and a plain-English summary

```json
{
  "source": "sec-edgar",
  "ticker": "AAPL",
  "cik": "0000320193",
  "company": "Apple Inc.",
  "sic": "3571",
  "sicDescription": "Electronic Computers",
  "exchanges": [
    "Nasdaq"
  ],
  "fiscalYearEnd": "0927",
  "formsFilter": [
    "10-K",
    "10-Q",
    "8-K"
  ],
  "count": 2,
  "filings": [
    {
      "form": "10-Q",
      "filingDate": "2026-07-31",
      "reportDate": "2026-06-27",
      "accessionNumber": "0000320193-26-000020",
      "primaryDocument": "aapl-20260627.htm",
      "description": "10-Q",
      "items": [],
      "summary": "Apple Inc.: Quarterly report — unaudited financials and management discussion for the quarter.",
      "url": "https://www.sec.gov/Archives/edgar/data/320193/000032019326000020/aapl-20260627.htm",
      "filingIndexUrl": "https://www.sec.gov/Archives/edgar/data/320193/000032019326000020/0000320193-26-000020-index.htm",
      "sizeBytes": 5946811,
      "isXBRL": true
    },
    {
      "form": "8-K",
      "filingDate": "2026-07-30",
      "reportDate": "2026-07-30",
      "accessionNumber": "0000320193-26-000018",
      "primaryDocument": "aapl-20260730.htm",
      "description": "8-K",
      "items": [
        "2.02",
        "9.01"
      ],
      "summary": "Apple Inc.: Current report — a material event the company must disclose within four business days. Reported items: results of operations and financial condition; financial statements and exhibits.",
      "url": "https://www.sec.gov/Archives/edgar/data/320193/000032019326000018/aapl-20260730.htm",
      "filingIndexUrl": "https://www.sec.gov/Archives/edgar/data/320193/000032019326000018/0000320193-26-000018-index.htm",
      "sizeBytes": 417360,
      "isXBRL": true
    }
  ],
  "retrievedAt": "2026-08-07T02:53:11.204Z"
}
```


## Free endpoints

- `GET /` — Service metadata, live prices, active payment rails, upstream list
- `GET /health` — Liveness probe
- `GET /.well-known/x402` — Machine-readable discovery manifest
- `GET /skill.md` — This agent skill card
- `GET /openapi.json` — OpenAPI 3.1 spec

## Error codes

| HTTP | `error` | Meaning |
|------|---------|---------|
| 400 | `invalid_coin_id` | The `coinId` path segment is not a plausible CoinGecko id. |
| 400 | `invalid_currency` | `vs` is not a currency code such as `usd`, `eur`, `jpy`. |
| 400 | `invalid_limit` | `limit` outside 1…100. |
| 404 | `not_found` | No such CoinGecko coin, or no SEC registrant under that ticker. |
| 503 | `upstream_rate_limited` | CoinGecko or EDGAR rate-limited this server. `Retry-After` included. Nothing settled. |
| 502 | `upstream_error` | The upstream failed or timed out. Nothing settled. |
| 402 | — | Payment required or rejected. Body carries `accepts` (both rails) and an `error` reason. |
| 500 | `no_payment_rail_configured` | Server has neither a valid EVM nor Solana payTo. |

## Data source

Two live, keyless upstreams:

- **[CoinGecko public API](https://www.coingecko.com/en/api)** — spot prices and 24h market statistics for thousands of assets. Free tier, no key; rate-limited per IP (roughly 5–15 calls/minute) and answers 429 when exceeded.
- **[SEC EDGAR](https://www.sec.gov/search-filings/edgar-application-programming-interfaces)** — every filing by every SEC registrant. Free, no key. EDGAR's fair-access policy asks for a User-Agent identifying the caller with a contact address; set `CONTACT_EMAIL` to your own.

The ticker→CIK map (a ~1MB file that changes at most daily) is fetched once and
cached in memory for 24 hours; everything else is live per request. A rate-limited
upstream surfaces as `503 upstream_rate_limited` with a `Retry-After` header, an
unknown coin or ticker as `404 not_found` — never as partial JSON. There are no
fixtures in this repo.

## Discovery

Machine-readable manifest: **`GET /.well-known/x402`**
(also at <https://github.com/nirholas/x402-markets/blob/main/public/.well-known/x402>).
Indexed by [x402scan.com](https://x402scan.com), the x402 Bazaar, and
[agentic.market](https://agentic.market).

OpenAPI 3.1: [`openapi.json`](https://github.com/nirholas/x402-markets/blob/main/openapi.json)

## Contact

nichxbt@gmail.com · <https://github.com/nirholas/x402-markets>
