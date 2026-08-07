# Exposing x402-markets as an MCP tool

[MCP](https://modelcontextprotocol.io) lets Claude (and other MCP clients) call
this service directly. The wrapper below holds the wallet, pays the x402
invoice, and hands the artifact straight back to the model.

## Minimal server

```ts
// mcp-x402-markets.ts
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createSigner, wrapFetchWithPayment } from "x402-fetch";
import { z } from "zod";

const BASE_URL = process.env.MARKETS_URL ?? "http://localhost:4023";

const signer = await createSigner("base-sepolia", process.env.PRIVATE_KEY!);
const payFetch = wrapFetchWithPayment(fetch, signer);

const server = new McpServer({ name: "x402-markets", version: "0.1.0" });

server.tool(
  "crypto_price",
  "Live crypto spot price and 24h statistics",
  {
    coinId: z.string().describe("CoinGecko coin id (`bitcoin`, `usd-coin`, `avalanche-2`) or a common ticker shorthand (`btc`, `eth`, `sol`)."),
    vs: z.string().optional().describe("Quote currency. Default `usd`. Any CoinGecko-supported code — `eur`, `jpy`, `gbp`."),
  },
  async (args) => {
    const url = new URL(`${BASE_URL}/price/${encodeURIComponent(args.coinId)}`);
    if (args.vs) url.searchParams.set("vs", args.vs);
    const res = await payFetch(url);
    if (!res.ok) throw new Error(`GET /price/:coinId → ${res.status}`);
    return { content: [{ type: "text", text: JSON.stringify(await res.json(), null, 2) }] };
  },
);

server.tool(
  "sec_filings",
  "Recent SEC EDGAR filings for a US-listed ticker, parsed and summarized",
  {
    ticker: z.string().describe("US-listed ticker symbol, e.g. `AAPL`, `NVDA`, `BRK.B`. Case-insensitive."),
    limit: z.number().optional().describe("Filings to return, 1–100. Default 20."),
    forms: z.string().optional().describe("Comma-separated form types to keep, e.g. `10-K,10-Q,8-K`. Omit for every recent filing including Forms 3/4/5."),
  },
  async (args) => {
    const url = new URL(`${BASE_URL}/filings/${encodeURIComponent(args.ticker)}`);
    if (args.limit) url.searchParams.set("limit", String(args.limit));
    if (args.forms) url.searchParams.set("forms", args.forms);
    const res = await payFetch(url);
    if (!res.ok) throw new Error(`GET /filings/:ticker → ${res.status}`);
    return { content: [{ type: "text", text: JSON.stringify(await res.json(), null, 2) }] };
  },
);

await server.connect(new StdioServerTransport());
```

## Wire it into Claude Desktop

`claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "x402-markets": {
      "command": "npx",
      "args": ["tsx", "/absolute/path/to/mcp-x402-markets.ts"],
      "env": {
        "PRIVATE_KEY": "0xYourFundedTestKey",
        "MARKETS_URL": "http://localhost:4023"
      }
    }
  }
}
```

## Spending caps

Each GET /price/:coinId call costs $0.001. Wrap `payFetch` with a
budget so a runaway loop cannot drain the wallet:

```ts
let spentMicros = 0;
const CAP_MICROS = 1_000_000; // $1.00

const cappedFetch: typeof fetch = async (input, init) => {
  if (spentMicros >= CAP_MICROS) throw new Error("x402 spend cap reached");
  const res = await payFetch(input, init);
  const receipt = res.headers.get("X-PAYMENT-RESPONSE");
  if (receipt) {
    const { amount } = JSON.parse(Buffer.from(receipt, "base64").toString());
    spentMicros += Number(amount ?? 0);
  }
  return res;
};
```

## Notes

- The tool descriptions above come from [`skill.md`](../skill.md) — keep them in
  sync so the model knows exactly what it is buying.
- Paying on Solana instead? Swap `x402-fetch` for a Solana x402 client; the 402
  challenge already advertises the `solana` rail, so nothing on this
  server changes.
- Discovery for autonomous agents: [`/.well-known/x402`](../public/.well-known/x402).
