# x402-markets

[![License: Apache-2.0](https://img.shields.io/badge/license-Apache--2.0-blue.svg)](LICENSE)
[![x402](https://img.shields.io/badge/payments-x402-0052ff.svg)](https://x402.org)
[![USDC on Base](https://img.shields.io/badge/USDC-Base-0052ff.svg)](https://base.org)
[![USDC on Solana](https://img.shields.io/badge/USDC-Solana-14f195.svg)](https://solana.com)

**Crypto prices via CoinGecko and SEC filings via EDGAR — real market data per
lookup.** One HTTP call, USDC on Base *or* Solana, and the data comes back in
the response body: spot price with 24h range and change, or a company's recent
filings parsed into form, dates, direct document links, and plain-English
summaries.

Docs site: **https://nirholas.github.io/x402-markets/**

## Why x402 for this

Market data is sold by the month and consumed by the second. An agent checking
one price before a trade, or reading one 8-K before answering a question, has no
use for a data-terminal seat — and cannot sign up for one anyway. x402 prices
the call instead of the relationship: $0.001 for a price snapshot, $0.003 for a
filings pull, paid in USDC on whichever chain the agent holds funds on. Both
upstreams are free and keyless, so the price buys the parsing, the ticker→CIK
resolution, and the form decoding, not a resold feed.

## Quickstart

```bash
git clone https://github.com/nirholas/x402-markets
cd x402-markets
npm install
npm run dev            # http://localhost:4023 — no configuration needed
```

See the price with no wallet at all:

```bash
curl -s "http://localhost:4023/price/bitcoin" | jq
# 402 + accepts: [ USDC on Base, USDC on Solana ]
```

Then buy it, from an agent (wallet funded with Base Sepolia USDC —
https://faucet.circle.com):

```bash
PRIVATE_KEY=0xYourTestKey npm run client
```

## API

| Route | Price | What you get back |
|-------|-------|-------------------|
| `GET /price/:coinId` | **$0.001** | Spot price, 1h/24h/7d change, 24h high–low range, volume, market cap, supply, and distance from all-time high and low |
| `GET /filings/:ticker` | **$0.003** | Company identity (CIK, SIC, exchanges) plus recent filings with form, dates, direct document link, decoded 8-K items, and a plain-English summary |
| `GET /` | free | Service metadata, live prices, active payment rails, upstream list |
| `GET /health` | free | Liveness probe |
| `GET /.well-known/x402` | free | Machine-readable discovery manifest |
| `GET /skill.md` | free | This agent skill card |
| `GET /openapi.json` | free | OpenAPI 3.1 spec |

Full reference: [docs/api.md](docs/api.md) · [openapi.json](openapi.json)

## How x402 works

**Pay in USDC on Base or Solana — your client picks the rail.**

1. **402** — the route, called without payment, replies HTTP 402 with an
   `accepts` array holding **both** rails: exact price
   ($0.001 → `1000` USDC base units), asset, and `payTo`.
2. **Sign** — on Base, the client signs an EIP-3009 USDC authorization (no gas
   from the payer). On Solana, it signs an SPL `transferChecked` whose fee payer
   is the facilitator's sponsor account (so the buyer needs USDC only, no SOL).
3. **Settle** — the server hands the payload to the facilitator
   (`https://x402.org/facilitator`), which verifies and settles on the chosen chain.
4. **200** — the same request returns the artifact in the body, with the
   settlement receipt in the `X-PAYMENT-RESPONSE` header.

| Rail | Network | Asset | payTo |
|------|---------|-------|-------|
| EVM | `base-sepolia` (`base` on mainnet) | USDC | `0x40252CFDF8B20Ed757D61ff157719F33Ec332402` |
| Solana | `solana` (`solana-devnet` on devnet) | USDC | `WwwuGbqHrwF5RG89KhUbmRWEvjnRH9k5kVM5p7T3WwW` |

Those are the suite's public receive addresses and the server's defaults. Set
`PAY_TO_ADDRESS` / `SOLANA_PAY_TO_ADDRESS` to be paid yourself.

Walkthroughs: [examples/curl.md](examples/curl.md) ·
[examples/agent-client.ts](examples/agent-client.ts) ·
[docs/tutorial.md](docs/tutorial.md)

## Real backend / API keys

| Env | Effect |
|-----|--------|
| *(nothing)* | Both upstreams are keyless and called live out of the box. `npm install && npm run dev` returns real prices and real filings. |
| `CONTACT_EMAIL` | Goes into the User-Agent sent to SEC EDGAR, as their [fair-access policy](https://www.sec.gov/os/webmaster-faq#developers) requires. Set it to your own address before running this anywhere public. |
| `COINGECKO_BASE_URL` | Point at CoinGecko Pro (`https://pro-api.coingecko.com/api/v3`) if you have a paid plan and want its higher limits. Optional — the free public endpoint is the default. |

All variables: [.env.example](.env.example)

## For AI agents

- **[skill.md](skill.md)** — agent-facing skill file: endpoints, prices,
  schemas, both payment rails. Point your agent at it.
- **`GET /.well-known/x402`** — discovery manifest listing every resource with
  both networks. Indexable by [x402scan.com](https://x402scan.com), the x402
  Bazaar, and [agentic.market](https://agentic.market).
- **MCP** — [examples/mcp-tool.md](examples/mcp-tool.md) exposes these routes as
  Claude MCP tools, with per-wallet spend caps and a
  `claude_desktop_config.json` example.
- More: [docs/agents.md](docs/agents.md)

## Docs

- Landing: https://nirholas.github.io/x402-markets/
- [Tutorial](docs/tutorial.md) · [API reference](docs/api.md) · [For AI agents](docs/agents.md)

## Support

Questions, bugs, or a listing request: **nichxbt@gmail.com** ·
[open an issue](https://github.com/nirholas/x402-markets/issues)

## License

Apache-2.0. Part of the [x402 Suite](https://github.com/nirholas/x402-suite).

## Star History

[![Star History Chart](https://api.star-history.com/svg?repos=nirholas/x402-markets&type=Date)](https://www.star-history.com/#nirholas/x402-markets&Date)
