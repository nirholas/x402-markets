/**
 * x402-markets — service layer.
 *
 * Two live, keyless upstreams:
 *   - CoinGecko public API  https://api.coingecko.com/api/v3   (crypto spot + 24h stats)
 *   - SEC EDGAR             https://data.sec.gov               (company filings)
 *
 * Both are called on every request. CoinGecko's free tier is rate-limited by
 * IP (roughly 5–15 calls/minute) and answers 429 when exceeded; EDGAR asks for
 * a descriptive User-Agent carrying a contact address and caps callers at 10
 * requests/second. Both limits are respected below, and both upstreams'
 * failures are surfaced as structured errors rather than partial JSON.
 */

const COINGECKO = process.env.COINGECKO_BASE_URL?.replace(/\/+$/, "") ?? "https://api.coingecko.com/api/v3";
const SEC_TICKERS_URL = "https://www.sec.gov/files/company_tickers.json";
const SEC_SUBMISSIONS = "https://data.sec.gov/submissions";
const TIMEOUT_MS = 12_000;

/**
 * EDGAR's fair-access policy requires a User-Agent that identifies the caller
 * and carries a contact address. Set CONTACT_EMAIL to your own.
 *
 * The SEC's documented format is literally `Company Name contact@example.com`
 * — a User-Agent containing a URL or parentheses is rejected with 403, so the
 * EDGAR header is deliberately plainer than the one sent everywhere else.
 */
const CONTACT = process.env.CONTACT_EMAIL || "nichxbt@gmail.com";
const UA = `x402-markets/0.1.0 (https://github.com/nirholas/x402-markets; ${CONTACT})`;
const SEC_UA = `x402-markets ${CONTACT}`;

/** The live, keyless upstreams this service queries. */
export const UPSTREAMS = ["CoinGecko", "SEC EDGAR"] as const;

export class UpstreamRateLimitedError extends Error {
  readonly retryAfterSeconds: number;
  constructor(source: string, retryAfterSeconds = 30) {
    super(
      `${source} is rate-limiting this server's IP. Retry in about ${retryAfterSeconds}s, ` +
        `or run this service from a less contended egress address.`,
    );
    this.name = "UpstreamRateLimitedError";
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

export class NotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NotFoundError";
  }
}

/* ────────────────────────── http ────────────────────────── */

async function getJson(url: string, source: string): Promise<unknown> {
  const userAgent = source === "SEC EDGAR" ? SEC_UA : UA;
  let res: Response;
  try {
    res = await fetch(url, {
      headers: {
        "User-Agent": userAgent,
        Accept: "application/json",
        "Accept-Encoding": "gzip, deflate",
      },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (err) {
    throw new Error(`${source} unreachable: ${(err as Error).message}`);
  }
  // EDGAR answers 403 (not 429) when it throttles an automated caller.
  if (res.status === 429 || res.status === 503 || (res.status === 403 && source === "SEC EDGAR")) {
    const retry = Number(res.headers.get("retry-after")) || 30;
    throw new UpstreamRateLimitedError(source, retry);
  }
  if (res.status === 404) throw new NotFoundError(`${source} has no record for that identifier.`);
  if (!res.ok) throw new Error(`${source} responded HTTP ${res.status}`);
  return res.json();
}

/* ══════════════════════════ crypto prices ══════════════════════════ */

export interface PriceSnapshot {
  source: "coingecko";
  id: string;
  symbol: string;
  name: string;
  currency: string;
  price: number | null;
  marketCapRank: number | null;
  change: {
    pct1h: number | null;
    pct24h: number | null;
    pct7d: number | null;
    abs24h: number | null;
  };
  range24h: { high: number | null; low: number | null };
  volume24h: number | null;
  marketCap: number | null;
  fullyDilutedValuation: number | null;
  supply: { circulating: number | null; total: number | null; max: number | null };
  allTimeHigh: { price: number | null; date: string | null; changePct: number | null };
  allTimeLow: { price: number | null; date: string | null; changePct: number | null };
  lastUpdated: string | null;
  retrievedAt: string;
}

const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);

/**
 * Spot price and 24h statistics for one CoinGecko coin id (`bitcoin`, not `BTC`).
 * Common tickers are aliased so agents can pass either.
 */
export async function price(coinId: string, vsCurrency = "usd"): Promise<PriceSnapshot> {
  const id = resolveCoinId(coinId);
  const url =
    `${COINGECKO}/coins/markets?vs_currency=${encodeURIComponent(vsCurrency)}` +
    `&ids=${encodeURIComponent(id)}&price_change_percentage=1h,24h,7d&precision=full`;
  const data = (await getJson(url, "CoinGecko")) as Array<Record<string, unknown>>;
  const c = Array.isArray(data) ? data[0] : undefined;
  if (!c) {
    throw new NotFoundError(
      `CoinGecko has no coin with id "${id}". Ids are slugs like "bitcoin" or "usd-coin" — ` +
        `see https://api.coingecko.com/api/v3/coins/list.`,
    );
  }

  return {
    source: "coingecko",
    id: String(c.id ?? id),
    symbol: String(c.symbol ?? "").toUpperCase(),
    name: String(c.name ?? ""),
    currency: vsCurrency.toLowerCase(),
    price: num(c.current_price),
    marketCapRank: num(c.market_cap_rank),
    change: {
      pct1h: num(c.price_change_percentage_1h_in_currency),
      pct24h: num(c.price_change_percentage_24h_in_currency) ?? num(c.price_change_percentage_24h),
      pct7d: num(c.price_change_percentage_7d_in_currency),
      abs24h: num(c.price_change_24h),
    },
    range24h: { high: num(c.high_24h), low: num(c.low_24h) },
    volume24h: num(c.total_volume),
    marketCap: num(c.market_cap),
    fullyDilutedValuation: num(c.fully_diluted_valuation),
    supply: {
      circulating: num(c.circulating_supply),
      total: num(c.total_supply),
      max: num(c.max_supply),
    },
    allTimeHigh: {
      price: num(c.ath),
      date: typeof c.ath_date === "string" ? c.ath_date : null,
      changePct: num(c.ath_change_percentage),
    },
    allTimeLow: {
      price: num(c.atl),
      date: typeof c.atl_date === "string" ? c.atl_date : null,
      changePct: num(c.atl_change_percentage),
    },
    lastUpdated: typeof c.last_updated === "string" ? c.last_updated : null,
    retrievedAt: new Date().toISOString(),
  };
}

/** Ticker shorthands agents reach for, mapped to CoinGecko slugs. */
const COIN_ALIASES: Record<string, string> = {
  btc: "bitcoin",
  eth: "ethereum",
  sol: "solana",
  usdc: "usd-coin",
  usdt: "tether",
  bnb: "binancecoin",
  xrp: "ripple",
  ada: "cardano",
  doge: "dogecoin",
  avax: "avalanche-2",
  matic: "matic-network",
  link: "chainlink",
  dot: "polkadot",
  ltc: "litecoin",
  atom: "cosmos",
  arb: "arbitrum",
  op: "optimism",
};

export function resolveCoinId(raw: string): string {
  const id = raw.trim().toLowerCase();
  return COIN_ALIASES[id] ?? id;
}

/* ══════════════════════════ SEC filings ══════════════════════════ */

/**
 * EDGAR maps tickers to CIKs in one ~1MB file. It changes at most daily, so it
 * is fetched once and cached in memory for 24 hours.
 */
let tickerMap: Map<string, { cik: string; title: string }> | null = null;
let tickerMapFetchedAt = 0;
const TICKER_TTL_MS = 24 * 60 * 60 * 1000;

async function getTickerMap(): Promise<Map<string, { cik: string; title: string }>> {
  if (tickerMap && Date.now() - tickerMapFetchedAt < TICKER_TTL_MS) return tickerMap;
  const raw = (await getJson(SEC_TICKERS_URL, "SEC EDGAR")) as Record<
    string,
    { cik_str: number; ticker: string; title: string }
  >;
  const map = new Map<string, { cik: string; title: string }>();
  for (const entry of Object.values(raw)) {
    if (!entry?.ticker) continue;
    map.set(entry.ticker.toUpperCase(), {
      cik: String(entry.cik_str).padStart(10, "0"),
      title: entry.title,
    });
  }
  tickerMap = map;
  tickerMapFetchedAt = Date.now();
  return map;
}

/** Plain-English gloss for the SEC form types agents actually encounter. */
const FORM_MEANINGS: Record<string, string> = {
  "10-K": "Annual report — audited financials, risk factors, and management discussion for the fiscal year.",
  "10-Q": "Quarterly report — unaudited financials and management discussion for the quarter.",
  "8-K": "Current report — a material event the company must disclose within four business days.",
  "S-1": "Registration statement for a new public offering of securities.",
  "S-3": "Shelf registration statement for securities offered by an already-reporting company.",
  "S-4": "Registration statement for securities issued in a merger or exchange offer.",
  "4": "Insider transaction — a director, officer, or 10% owner bought or sold company stock.",
  "3": "Initial statement of beneficial ownership by a new insider.",
  "5": "Annual statement of changes in insider beneficial ownership.",
  "DEF 14A": "Definitive proxy statement — the agenda, board slate, and executive compensation put to shareholders.",
  "DEFA14A": "Additional proxy soliciting material.",
  "SC 13G": "Passive beneficial ownership above 5%.",
  "SC 13D": "Activist beneficial ownership above 5%, with stated intent.",
  "13F-HR": "Quarterly institutional holdings report.",
  "6-K": "Report of a foreign private issuer — the non-US analogue of an 8-K.",
  "20-F": "Annual report of a foreign private issuer — the non-US analogue of a 10-K.",
  "424B2": "Prospectus supplement filed after an effective shelf registration.",
  "11-K": "Annual report for an employee stock purchase or savings plan.",
  "144": "Notice of proposed sale of restricted securities.",
};

/** 8-K item codes carry the actual news; decode the common ones. */
const ITEM_MEANINGS: Record<string, string> = {
  "1.01": "entry into a material agreement",
  "1.02": "termination of a material agreement",
  "2.01": "completion of an acquisition or disposition",
  "2.02": "results of operations and financial condition",
  "2.03": "creation of a material financial obligation",
  "2.05": "costs associated with exit or disposal activities",
  "3.01": "notice of delisting or failure to satisfy a listing rule",
  "3.02": "unregistered sale of equity securities",
  "4.01": "change in the registrant's certifying accountant",
  "4.02": "non-reliance on previously issued financial statements",
  "5.02": "departure or appointment of directors or officers",
  "5.03": "amendments to articles of incorporation or bylaws",
  "5.07": "submission of matters to a vote of security holders",
  "7.01": "regulation FD disclosure",
  "8.01": "other events",
  "9.01": "financial statements and exhibits",
};

function summarize(form: string, items: string, description: string, company: string): string {
  const base = FORM_MEANINGS[form.toUpperCase()] ?? description ?? `SEC form ${form}.`;
  const codes = items
    .split(",")
    .map((i) => i.trim())
    .filter(Boolean);
  if (codes.length === 0) return `${company}: ${base}`;
  const decoded = codes.map((c) => ITEM_MEANINGS[c] ?? `item ${c}`);
  return `${company}: ${base} Reported items: ${decoded.join("; ")}.`;
}

export interface Filing {
  form: string;
  filingDate: string;
  reportDate: string | null;
  accessionNumber: string;
  primaryDocument: string;
  description: string;
  items: string[];
  summary: string;
  url: string;
  filingIndexUrl: string;
  sizeBytes: number | null;
  isXBRL: boolean;
}

export interface FilingsResult {
  source: "sec-edgar";
  ticker: string;
  cik: string;
  company: string;
  sic: string | null;
  sicDescription: string | null;
  exchanges: string[];
  fiscalYearEnd: string | null;
  formsFilter: string[] | null;
  count: number;
  filings: Filing[];
  retrievedAt: string;
}

/**
 * Recent EDGAR filings for a US-listed ticker, parsed into form, dates, a
 * direct document link, and a plain-English summary of what the form is.
 */
export async function filings(
  ticker: string,
  opts: { limit?: number; forms?: string[] } = {},
): Promise<FilingsResult> {
  const symbol = ticker.trim().toUpperCase();
  if (!/^[A-Z0-9.\-]{1,10}$/.test(symbol)) {
    throw new NotFoundError(`"${ticker}" is not a plausible ticker symbol.`);
  }

  const map = await getTickerMap();
  const entry = map.get(symbol);
  if (!entry) {
    throw new NotFoundError(
      `No SEC registrant is listed under ticker "${symbol}". EDGAR only covers issuers that file with the SEC.`,
    );
  }

  const sub = (await getJson(`${SEC_SUBMISSIONS}/CIK${entry.cik}.json`, "SEC EDGAR")) as Record<
    string,
    any
  >;
  const recent = sub.filings?.recent ?? {};
  const forms: string[] = recent.form ?? [];
  const wanted = opts.forms?.map((f) => f.trim().toUpperCase()).filter(Boolean) ?? null;
  const limit = Math.min(Math.max(opts.limit ?? 20, 1), 100);
  const company = String(sub.name ?? entry.title);
  const cikNumeric = String(Number(entry.cik));

  const out: Filing[] = [];
  for (let i = 0; i < forms.length && out.length < limit; i++) {
    const form = String(forms[i] ?? "");
    if (wanted && !wanted.includes(form.toUpperCase())) continue;

    const accession = String(recent.accessionNumber?.[i] ?? "");
    const accessionNoDash = accession.replace(/-/g, "");
    const primaryDocument = String(recent.primaryDocument?.[i] ?? "");
    const itemsRaw = String(recent.items?.[i] ?? "");
    const description = String(recent.primaryDocDescription?.[i] ?? "");
    const base = `https://www.sec.gov/Archives/edgar/data/${cikNumeric}/${accessionNoDash}`;

    out.push({
      form,
      filingDate: String(recent.filingDate?.[i] ?? ""),
      reportDate: recent.reportDate?.[i] || null,
      accessionNumber: accession,
      primaryDocument,
      description,
      items: itemsRaw.split(",").map((s) => s.trim()).filter(Boolean),
      summary: summarize(form, itemsRaw, description, company),
      url: primaryDocument ? `${base}/${primaryDocument}` : `${base}/${accession}-index.htm`,
      filingIndexUrl: `${base}/${accession}-index.htm`,
      sizeBytes: num(recent.size?.[i]),
      isXBRL: Boolean(recent.isXBRL?.[i]),
    });
  }

  return {
    source: "sec-edgar",
    ticker: symbol,
    cik: entry.cik,
    company,
    sic: sub.sic ? String(sub.sic) : null,
    sicDescription: sub.sicDescription ? String(sub.sicDescription) : null,
    exchanges: Array.isArray(sub.exchanges) ? sub.exchanges.map(String) : [],
    fiscalYearEnd: sub.fiscalYearEnd ? String(sub.fiscalYearEnd) : null,
    formsFilter: wanted,
    count: out.length,
    filings: out,
    retrievedAt: new Date().toISOString(),
  };
}
