# API reference — x402-markets

Base URL: `http://localhost:4023` in development.
Machine-readable: [`openapi.json`](https://github.com/nirholas/x402-markets/blob/main/openapi.json) (OpenAPI 3.1).

All paid routes return the purchased artifact in the **200 response body**.

## Payment

Every paid route answers an unpaid request with **402** and an `accepts` array
holding both rails:

| Rail | Network | Asset | payTo |
|------|---------|-------|-------|
| EVM | `base-sepolia` (`base` on mainnet) | USDC | `0x40252CFDF8B20Ed757D61ff157719F33Ec332402` |
| Solana | `solana` (`solana-devnet` on devnet) | USDC | `WwwuGbqHrwF5RG89KhUbmRWEvjnRH9k5kVM5p7T3WwW` |

Prices are quoted in USDC base units (6 decimals) as `maxAmountRequired`.
On success the response carries `X-PAYMENT-RESPONSE`: base64 JSON with
`{ success, rail, network, transaction, payer, amount, asset }`.

---

## `GET /price/:coinId`

**$0.001** — Live crypto spot price and 24h statistics

### Parameters

| Param | In | Required | Type | Description |
|-------|----|----------|------|-------------|
| `coinId` | path | yes | string | CoinGecko coin id (`bitcoin`, `usd-coin`, `avalanche-2`) or a common ticker shorthand (`btc`, `eth`, `sol`). |
| `vs` | query | no | string | Quote currency. Default `usd`. Any CoinGecko-supported code — `eur`, `jpy`, `gbp`. |

### Example request

```bash
curl -s -H "X-PAYMENT: <base64 payload>" "http://localhost:4023/price/bitcoin"
```

### Response `200 application/json`

`lastUpdated` is CoinGecko's own timestamp for the quote — trust it over your wall clock when judging freshness. Common tickers (`btc`, `eth`, `sol`, `usdc`, …) are aliased to their CoinGecko slugs, so both `/price/btc` and `/price/bitcoin` work. Fields CoinGecko does not publish for an asset come back as `null` rather than being omitted.

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

### Errors

| HTTP | `error` | When |
|------|---------|------|
| 400 | `invalid_coin_id` | Path segment is not a plausible id. Nothing settled. |
| 400 | `invalid_currency` | `vs` is not a currency code. Nothing settled. |
| 404 | `not_found` | CoinGecko has no coin with that id. Nothing settled. |
| 503 | `upstream_rate_limited` | CoinGecko throttled this server. Nothing settled. |
| 402 | — | No or invalid `X-PAYMENT`. Body carries `accepts` with both rails. |
| 502 | `upstream_error` | The upstream data source failed or timed out. |

---

## `GET /filings/:ticker`

**$0.003** — Recent SEC EDGAR filings for a US-listed ticker, parsed and summarized

### Parameters

| Param | In | Required | Type | Description |
|-------|----|----------|------|-------------|
| `ticker` | path | yes | string | US-listed ticker symbol, e.g. `AAPL`, `NVDA`, `BRK.B`. Case-insensitive. |
| `limit` | query | no | integer | Filings to return, 1–100. Default 20. |
| `forms` | query | no | string | Comma-separated form types to keep, e.g. `10-K,10-Q,8-K`. Omit for every recent filing including Forms 3/4/5. |

### Example request

```bash
curl -s -H "X-PAYMENT: <base64 payload>" "http://localhost:4023/filings/AAPL?limit=5&forms=10-K,10-Q,8-K"
```

### Response `200 application/json`

`summary` is generated from the form type and, for 8-Ks, the SEC item codes — so `items: ["2.02","9.01"]` reads as "results of operations and financial condition; financial statements and exhibits". `url` points at the primary document itself; `filingIndexUrl` at the full filing index including exhibits. `formsFilter` echoes the `forms` filter you applied, or `null`.

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

### Errors

| HTTP | `error` | When |
|------|---------|------|
| 400 | `missing_ticker` | Empty path segment. Nothing settled. |
| 400 | `invalid_limit` | `limit` outside 1…100. Nothing settled. |
| 404 | `not_found` | No SEC registrant is listed under that ticker. Nothing settled. |
| 503 | `upstream_rate_limited` | EDGAR throttled this server. Nothing settled. |
| 402 | — | No or invalid `X-PAYMENT`. Body carries `accepts` with both rails. |
| 502 | `upstream_error` | The upstream data source failed or timed out. |


---

## Free routes

### `GET /`

Service metadata: description, live prices, active payment rails, data-source
status, and docs links.

### `GET /health`

```json
{ "status": "ok", "uptime": 12.5 }
```

### `GET /.well-known/x402`

The discovery manifest — every resource with its price, output schema, and both
accepted rails. See [agents.md](agents.md).
