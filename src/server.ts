/**
 * x402-markets — Express server with the dual-rail x402 paywall.
 *
 * Paid routes return the purchased artifact directly in the 200 response body.
 * Buyers pay in USDC on Base (EVM) or on Solana; the 402 challenge advertises
 * both rails and the client picks.
 */
import "dotenv/config";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import {
  facilitatorUrl,
  paywall,
  rails,
  solanaCheckoutRouter,
  usingSuiteDefaultPayTo,
  type RoutePrices,
} from "./payments.js";
import {
  filings,
  NotFoundError,
  price,
  UPSTREAMS,
  UpstreamRateLimitedError,
} from "./service.js";

const require = createRequire(import.meta.url);
const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const publicDir = join(root, "public");

/** Paid routes. Anything not listed here is free. */
const ROUTES: RoutePrices = {
  "GET /price/:coinId": {
    price: "$0.001",
    description:
      "Live crypto spot price and 24h statistics from CoinGecko — price, 1h/24h/7d change, 24h range, volume, market cap, supply, all-time high and low.",
    outputSchema: {
      type: "object",
      properties: {
        id: { type: "string" },
        price: { type: "number" },
        change: { type: "object" },
        marketCap: { type: "number" },
      },
    },
  },
  "GET /filings/:ticker": {
    price: "$0.003",
    description:
      "Recent SEC EDGAR filings for a US-listed ticker, parsed into form, dates, direct document link, decoded 8-K items, and a plain-English summary.",
    outputSchema: {
      type: "object",
      properties: {
        ticker: { type: "string" },
        company: { type: "string" },
        count: { type: "integer" },
        filings: { type: "array", items: { type: "object" } },
      },
    },
  },
};

const app = express();
app.disable("x-powered-by");
app.use(express.json());

// Dual-rail x402 paywall: USDC on Base or Solana.
app.use(paywall(ROUTES, { service: "x402-markets" }));

// Optional: browser (Phantom) Solana checkout helper. No-op when the modal
// package is not installed — agent clients never need it.
const checkoutRouter = await solanaCheckoutRouter();
if (checkoutRouter) app.use("/api/x402-checkout", checkoutRouter);

// Discovery manifest — registered before express.static so it keeps an explicit
// application/json content type (the file has no extension).
app.get("/.well-known/x402", (_req, res) => {
  res.type("application/json").sendFile(join(publicDir, ".well-known", "x402"));
});

// Agent-facing contract and machine spec, served from the repo root.
app.get("/skill.md", (_req, res) => {
  res.type("text/markdown").sendFile(join(root, "skill.md"));
});
app.get("/openapi.json", (_req, res) => {
  res.type("application/json").sendFile(join(root, "openapi.json"));
});

// Static site.
app.use(express.static(publicDir));

// Free: service info.
app.get("/", (_req, res) => {
  res.json({
    name: "x402-markets",
    description:
      "Crypto prices via CoinGecko and SEC filings via EDGAR — real market data per lookup",
    payment: {
      protocol: "x402",
      note: "Pay in USDC on Base or Solana — your client picks the rail.",
      facilitator: facilitatorUrl(),
      rails: rails(),
    },
    backend: {
      live: true,
      keyless: true,
      upstreams: UPSTREAMS,
      note: "CoinGecko's free tier and SEC EDGAR are both keyless and called live. EDGAR asks for a contact address in the User-Agent — set CONTACT_EMAIL to your own.",
    },
    routes: {
      "GET /price/{coinId}": {
        price: "$0.001",
        params: "coinId — CoinGecko slug (bitcoin) or common ticker (btc); vs (currency, default usd)",
        returns: "spot price, 1h/24h/7d change, 24h range, volume, market cap, supply, ATH/ATL",
      },
      "GET /filings/{ticker}": {
        price: "$0.003",
        params: "ticker — US-listed symbol; limit (1-100, default 20); forms (comma-separated, e.g. 10-K,8-K)",
        returns: "parsed recent filings with form, dates, document link, decoded items, and a summary",
      },
      "GET /health": { price: "free" },
      "GET /.well-known/x402": { price: "free" },
      "GET /skill.md": { price: "free" },
      "GET /openapi.json": { price: "free" },
    },
    docs: "https://nirholas.github.io/x402-markets/",
    skill: "https://github.com/nirholas/x402-markets/blob/main/skill.md",
  });
});

// Free: health check.
app.get("/health", (_req, res) => {
  res.json({ status: "ok", uptime: process.uptime() });
});

/** Map an upstream failure onto an honest HTTP status. Nothing settles on 4xx/5xx. */
function sendUpstreamError(res: express.Response, err: unknown): void {
  if (err instanceof NotFoundError) {
    res.status(404).json({ error: "not_found", message: err.message });
    return;
  }
  if (err instanceof UpstreamRateLimitedError) {
    res.setHeader("Retry-After", String(err.retryAfterSeconds));
    res.status(503).json({ error: "upstream_rate_limited", message: err.message });
    return;
  }
  res.status(502).json({
    error: "upstream_error",
    message: err instanceof Error ? err.message : "Upstream request failed",
  });
}

// Paid: $0.001 — crypto spot + 24h stats. Artifact returned in this response body.
app.get("/price/:coinId", async (req, res) => {
  const coinId = String(req.params.coinId ?? "").trim();
  if (!coinId || !/^[A-Za-z0-9._-]{1,60}$/.test(coinId)) {
    res.status(400).json({
      error: "invalid_coin_id",
      message: 'Path segment must be a CoinGecko id such as "bitcoin", or a ticker such as "btc".',
    });
    return;
  }
  const vs = String(req.query.vs ?? "usd").trim().toLowerCase();
  if (!/^[a-z]{2,10}$/.test(vs)) {
    res.status(400).json({
      error: "invalid_currency",
      message: 'Query param "vs" must be a currency code such as usd, eur, or jpy.',
    });
    return;
  }
  try {
    res.json(await price(coinId, vs));
  } catch (err) {
    sendUpstreamError(res, err);
  }
});

// Paid: $0.003 — SEC filings. Artifact returned in this response body.
app.get("/filings/:ticker", async (req, res) => {
  const ticker = String(req.params.ticker ?? "").trim();
  if (!ticker) {
    res.status(400).json({ error: "missing_ticker", message: "Provide a US-listed ticker symbol." });
    return;
  }
  const limitRaw = req.query.limit;
  const limit = limitRaw == null ? 20 : Number(limitRaw);
  if (!Number.isFinite(limit) || limit < 1 || limit > 100) {
    res.status(400).json({
      error: "invalid_limit",
      message: 'Query param "limit" must be a number between 1 and 100.',
    });
    return;
  }
  const forms = req.query.forms
    ? String(req.query.forms)
        .split(",")
        .map((f) => f.trim())
        .filter(Boolean)
    : undefined;
  try {
    res.json(await filings(ticker, { limit, forms }));
  } catch (err) {
    sendUpstreamError(res, err);
  }
});

// Unknown route.
app.use((_req, res) => {
  res.status(404).json({ error: "not_found", docs: "https://nirholas.github.io/x402-markets/" });
});

const port = Number(process.env.PORT ?? 4023);
app.listen(port, () => {
  const pkg = require("../package.json") as { version: string };
  console.log(`x402-markets v${pkg.version} listening on :${port}`);
  console.log("  payment rails:");
  for (const rail of rails()) {
    console.log(
      `    ${rail.rail === "evm" ? "EVM   " : "Solana"}  ${rail.network.padEnd(14)} ${rail.asset} → ${rail.payTo}`,
    );
  }
  console.log(`  facilitator: ${facilitatorUrl()}`);
  if (usingSuiteDefaultPayTo()) {
    console.log(
      "  note:        using suite default payTo — set PAY_TO_ADDRESS/SOLANA_PAY_TO_ADDRESS to receive funds yourself",
    );
  }
  console.log(`  backend:     ${UPSTREAMS.join(", ")} (keyless, live)`);
  console.log("  paid routes:");
  for (const [route, spec] of Object.entries(ROUTES)) {
    console.log(`    ${route.padEnd(28)} ${typeof spec === "string" ? spec : spec.price}`);
  }
  console.log("  free routes: GET /, GET /health, GET /.well-known/x402, GET /skill.md");
});
