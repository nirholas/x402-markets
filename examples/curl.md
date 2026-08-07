# Raw HTTP walkthrough — 402 → pay → 200

Everything below is plain `curl`. No SDK required.

## 0. Start the server

```bash
npm install
npm run dev      # http://localhost:4023
```

## 1. Free routes need no payment

```bash
curl -s http://localhost:4023/health
curl -s http://localhost:4023/ | jq
curl -s http://localhost:4023/.well-known/x402 | jq
```

## 2. Call a paid route with no payment → 402, both rails

```bash
curl -s -i "http://localhost:4023/price/bitcoin"
```

```http
HTTP/1.1 402 Payment Required
Content-Type: application/json
```

```json
{
  "x402Version": 1,
  "error": "X-PAYMENT header is required",
  "hint": "Pay in USDC on Base or Solana — your client picks the rail. See /.well-known/x402",
  "accepts": [
    {
      "scheme": "exact",
      "network": "base-sepolia",
      "maxAmountRequired": "1000",
      "resource": "http://localhost:4023/price/:coinId",
      "description": "Live crypto spot price and 24h statistics",
      "mimeType": "application/json",
      "payTo": "0x40252CFDF8B20Ed757D61ff157719F33Ec332402",
      "maxTimeoutSeconds": 120,
      "asset": "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
      "extra": { "name": "USDC", "version": "2" }
    },
    {
      "scheme": "exact",
      "network": "solana",
      "maxAmountRequired": "1000",
      "resource": "http://localhost:4023/price/:coinId",
      "description": "Live crypto spot price and 24h statistics",
      "mimeType": "application/json",
      "payTo": "WwwuGbqHrwF5RG89KhUbmRWEvjnRH9k5kVM5p7T3WwW",
      "maxTimeoutSeconds": 120,
      "asset": "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
      "extra": { "name": "USDC", "decimals": 6, "feePayer": "<facilitator sponsor>" }
    }
  ]
}
```

`maxAmountRequired` is in USDC base units (6 decimals): `1000` = $0.001.

## 3. Build the payment

Pick **one** entry from `accepts`.

**EVM (Base):** sign an EIP-3009 `transferWithAuthorization` for
`maxAmountRequired` USDC to `payTo`. No gas needed from you — the facilitator
submits it.

**Solana:** build an SPL `transferChecked` of `maxAmountRequired` USDC to
`payTo`, with `extra.feePayer` as the transaction fee payer, and sign it. You
need USDC only — the facilitator sponsors the SOL fee.

Either way, base64-encode the x402 payload:

```json
{ "x402Version": 1, "scheme": "exact", "network": "<the rail you picked>", "payload": { … } }
```

In practice, let a library do it:

```bash
PRIVATE_KEY=0xYourTestKey npm run client
```

## 4. Repeat the request with the header → 200 + artifact

```bash
curl -s -i -H "X-PAYMENT: <base64 payload>" "http://localhost:4023/price/bitcoin"
```

```http
HTTP/1.1 200 OK
Content-Type: application/json
X-PAYMENT-RESPONSE: eyJzdWNjZXNzIjp0cnVlLCJyYWlsIjoiZXZtIiwi…
```

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

Decode the receipt:

```bash
echo '<X-PAYMENT-RESPONSE value>' | base64 -d | jq
# { "success": true, "rail": "evm", "network": "base-sepolia",
#   "transaction": "0x…", "payer": "0x…", "amount": "1000", "asset": "USDC" }
```

The artifact is in the body of that same 200. There is nothing else to fetch.

## All paid routes

### `GET /price/:coinId` — $0.001

```bash
curl -s -H "X-PAYMENT: <payload>" "http://localhost:4023/price/bitcoin"
```

### `GET /filings/:ticker` — $0.003

```bash
curl -s -H "X-PAYMENT: <payload>" "http://localhost:4023/filings/AAPL?limit=5&forms=10-K,10-Q,8-K"
```
