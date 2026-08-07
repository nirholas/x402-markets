# Tutorial — x402-markets

From a clean checkout to a paid API call, on either payment rail.

## 1. Install

```bash
git clone https://github.com/nirholas/x402-markets
cd x402-markets
npm install
```

Node 18 or newer.

## 2. Configure (optional)

```bash
cp .env.example .env
```

Nothing is required. Out of the box the server:

- listens on port `4023`,
- accepts USDC on **Base Sepolia** and on **Solana**, paying out to the suite's
  public receive addresses,
- queries CoinGecko and SEC EDGAR live — no keys needed, nothing to configure.

To be paid yourself, change these two lines:

```bash
PAY_TO_ADDRESS=0xYourEvmAddress
SOLANA_PAY_TO_ADDRESS=YourSolanaAddress
```

Nothing here requires a key. One variable is worth setting before you run this
anywhere public:

```bash
CONTACT_EMAIL=you@example.com
```

SEC EDGAR's [fair-access policy](https://www.sec.gov/os/webmaster-faq#developers)
asks every automated caller to identify itself with a contact address in the
User-Agent. Unset, the service falls back to the suite's address — fine for a
local try, impolite in production.

If you hold a CoinGecko Pro plan, point at it for higher limits:

```bash
COINGECKO_BASE_URL=https://pro-api.coingecko.com/api/v3
```

## 3. Run the server

```bash
npm run dev
```

```
x402-markets v0.1.0 listening on :4023
  payment rails:
    EVM     base-sepolia  USDC → 0x40252CFDF8B20Ed757D61ff157719F33Ec332402
    Solana  solana         USDC → WwwuGbqHrwF5RG89KhUbmRWEvjnRH9k5kVM5p7T3WwW
  facilitator: https://x402.org/facilitator
  paid routes:
    GET /price/:coinId           $0.001
    GET /filings/:ticker         $0.003
  free routes: GET /, GET /health, GET /.well-known/x402
```

Check it is alive:

```bash
curl -s http://localhost:4023/health
# {"status":"ok","uptime":1.2}
```

## 4. Your first 402

```bash
curl -s "http://localhost:4023/price/bitcoin" | jq
```

You get HTTP **402** and a challenge listing **both** rails:

```json
{
  "x402Version": 1,
  "error": "X-PAYMENT header is required",
  "accepts": [
    { "scheme": "exact", "network": "base-sepolia", "maxAmountRequired": "1000",
      "payTo": "0x40252CFDF8B20Ed757D61ff157719F33Ec332402", "asset": "0x036CbD53842c5426634e7929541eC2318f3dCF7e" },
    { "scheme": "exact", "network": "solana", "maxAmountRequired": "1000",
      "payTo": "WwwuGbqHrwF5RG89KhUbmRWEvjnRH9k5kVM5p7T3WwW", "asset": "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v" }
  ]
}
```

That is the whole price negotiation: no key, no signup, no account. The price
is `1000` USDC base units (6 decimals) = **$0.001**.

## 5. Pay for real

Get a Base Sepolia test wallet and fund it with test USDC from
<https://faucet.circle.com>. Then:

```bash
PRIVATE_KEY=0xYourTestKey npm run client
```

[`examples/agent-client.ts`](../examples/agent-client.ts) does the full flow:

1. Calls the route unpaid and prints both rails from the 402.
2. Signs an EIP-3009 USDC authorization for exactly $0.001.
3. Retries with the `X-PAYMENT` header.
4. Prints the artifact and decodes the `X-PAYMENT-RESPONSE` receipt.

Prefer Solana? The bottom of that file shows the equivalent flow — the server
needs no changes, since the same 402 already advertises the `solana` rail.

## 6. Read the artifact

The 200 body **is** the purchase:

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

For `/price`, `price` is the spot quote and `change.pct24h` the 24h move;
`range24h` tells you whether the current print sits near the top or bottom of
the day, and `allTimeHigh.changePct` how far below the peak it is.
`lastUpdated` is CoinGecko's own timestamp — use it, not your clock, to judge
freshness.

For `/filings`, each entry's `summary` explains what that form type *is* in one
sentence, and for 8-Ks it decodes the item codes — so `items: ["2.02","9.01"]`
reads as "results of operations and financial condition; financial statements
and exhibits" rather than as numbers. `url` points straight at the primary
document; `filingIndexUrl` at the full filing index if you need the exhibits.

Full field-by-field reference: [api.md](api.md).

## 7. Going to mainnet

```bash
# EVM: Base mainnet
NETWORK=base
PAY_TO_ADDRESS=0xYourRealAddress

# Solana: mainnet (this is already the default)
SOLANA_NETWORK=mainnet-beta
SOLANA_PAY_TO_ADDRESS=YourRealSolanaAddress
SOLANA_RPC_URL=https://your-dedicated-rpc.example.com

# A facilitator that settles on the networks you accept
FACILITATOR_URL=https://x402.org/facilitator
```

Then run `npm run build && npm start`. Nothing else changes: the same routes,
the same prices, real USDC.

> Use a dedicated Solana RPC in production. The public endpoint is heavily
> rate-limited.

## Where to go next

- [api.md](api.md) — every endpoint, parameter, and error
- [agents.md](agents.md) — discovery, MCP, and listing your instance
- [../skill.md](https://github.com/nirholas/x402-markets/blob/main/skill.md) — the agent-facing skill file
- [../examples/curl.md](https://github.com/nirholas/x402-markets/blob/main/examples/curl.md) — the same flow in raw curl
