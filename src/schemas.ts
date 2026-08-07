/**
 * Per-route request/response schemas published in the x402 402 challenge.
 *
 * Generated from `openapi.json` so the discovery metadata and the runtime
 * challenge cannot drift apart: `accepts[].outputSchema.input` describes how to
 * call the route, `accepts[].outputSchema.output` describes what the paid 200
 * returns. Keys match the paywall route map in `server.ts` exactly.
 *
 * Update `openapi.json` first, then re-derive this file.
 */

/** x402 Bazaar-style schema pair carried by every accept entry. */
export type RouteSchema = {
  /** How to invoke the route: method, query params and/or JSON body fields. */
  input: Record<string, unknown>;
  /** JSON Schema of the paid 200 response body. */
  output: Record<string, unknown>;
};

export const ROUTE_SCHEMAS: Record<string, RouteSchema> = {
  "GET /price/:coinId": {
    "input": {
      "type": "http",
      "method": "GET",
      "pathParams": {
        "coinId": {
          "type": "string",
          "description": "CoinGecko coin id (`bitcoin`, `usd-coin`, `avalanche-2`) or a common ticker shorthand (`btc`, `eth`, `sol`).",
          "example": "bitcoin"
        }
      },
      "queryParams": {
        "vs": {
          "type": "string",
          "description": "Quote currency. Default `usd`. Any CoinGecko-supported code — `eur`, `jpy`, `gbp`.",
          "example": "usd"
        }
      }
    },
    "output": {
      "type": "object",
      "required": [
        "source",
        "id",
        "symbol",
        "name",
        "currency",
        "price",
        "retrievedAt"
      ],
      "properties": {
        "source": {
          "type": "string",
          "enum": [
            "coingecko"
          ]
        },
        "id": {
          "type": "string",
          "description": "Resolved CoinGecko id."
        },
        "symbol": {
          "type": "string"
        },
        "name": {
          "type": "string"
        },
        "currency": {
          "type": "string"
        },
        "price": {
          "type": [
            "number",
            "null"
          ]
        },
        "marketCapRank": {
          "type": [
            "integer",
            "null"
          ]
        },
        "change": {
          "type": "object",
          "properties": {
            "pct1h": {
              "type": [
                "number",
                "null"
              ]
            },
            "pct24h": {
              "type": [
                "number",
                "null"
              ]
            },
            "pct7d": {
              "type": [
                "number",
                "null"
              ]
            },
            "abs24h": {
              "type": [
                "number",
                "null"
              ],
              "description": "Absolute 24h move in the quote currency."
            }
          }
        },
        "range24h": {
          "type": "object",
          "properties": {
            "high": {
              "type": [
                "number",
                "null"
              ]
            },
            "low": {
              "type": [
                "number",
                "null"
              ]
            }
          }
        },
        "volume24h": {
          "type": [
            "number",
            "null"
          ]
        },
        "marketCap": {
          "type": [
            "number",
            "null"
          ]
        },
        "fullyDilutedValuation": {
          "type": [
            "number",
            "null"
          ]
        },
        "supply": {
          "type": "object",
          "properties": {
            "circulating": {
              "type": [
                "number",
                "null"
              ]
            },
            "total": {
              "type": [
                "number",
                "null"
              ]
            },
            "max": {
              "type": [
                "number",
                "null"
              ]
            }
          }
        },
        "allTimeHigh": {
          "type": "object",
          "properties": {
            "price": {
              "type": [
                "number",
                "null"
              ]
            },
            "date": {
              "type": [
                "string",
                "null"
              ],
              "format": "date-time"
            },
            "changePct": {
              "type": [
                "number",
                "null"
              ],
              "description": "Percent below (negative) the all-time high."
            }
          }
        },
        "allTimeLow": {
          "type": "object",
          "properties": {
            "price": {
              "type": [
                "number",
                "null"
              ]
            },
            "date": {
              "type": [
                "string",
                "null"
              ],
              "format": "date-time"
            },
            "changePct": {
              "type": [
                "number",
                "null"
              ]
            }
          }
        },
        "lastUpdated": {
          "type": [
            "string",
            "null"
          ],
          "format": "date-time",
          "description": "CoinGecko's timestamp for the quote."
        },
        "retrievedAt": {
          "type": "string",
          "format": "date-time"
        }
      }
    }
  },
  "GET /filings/:ticker": {
    "input": {
      "type": "http",
      "method": "GET",
      "pathParams": {
        "ticker": {
          "type": "string",
          "description": "US-listed ticker symbol, e.g. `AAPL`, `NVDA`, `BRK.B`. Case-insensitive.",
          "example": "AAPL"
        }
      },
      "queryParams": {
        "limit": {
          "type": "integer",
          "description": "Filings to return, 1–100. Default 20.",
          "example": 5
        },
        "forms": {
          "type": "string",
          "description": "Comma-separated form types to keep, e.g. `10-K,10-Q,8-K`. Omit for every recent filing including Forms 3/4/5.",
          "example": "10-K,10-Q,8-K"
        }
      }
    },
    "output": {
      "type": "object",
      "required": [
        "source",
        "ticker",
        "cik",
        "company",
        "count",
        "filings",
        "retrievedAt"
      ],
      "properties": {
        "source": {
          "type": "string",
          "enum": [
            "sec-edgar"
          ]
        },
        "ticker": {
          "type": "string"
        },
        "cik": {
          "type": "string",
          "description": "Zero-padded 10-digit SEC Central Index Key."
        },
        "company": {
          "type": "string"
        },
        "sic": {
          "type": [
            "string",
            "null"
          ]
        },
        "sicDescription": {
          "type": [
            "string",
            "null"
          ]
        },
        "exchanges": {
          "type": "array",
          "items": {
            "type": "string"
          }
        },
        "fiscalYearEnd": {
          "type": [
            "string",
            "null"
          ],
          "description": "MMDD."
        },
        "formsFilter": {
          "type": [
            "array",
            "null"
          ],
          "items": {
            "type": "string"
          }
        },
        "count": {
          "type": "integer"
        },
        "filings": {
          "type": "array",
          "items": {
            "type": "object",
            "required": [
              "form",
              "filingDate",
              "accessionNumber",
              "summary",
              "url"
            ],
            "properties": {
              "form": {
                "type": "string"
              },
              "filingDate": {
                "type": "string",
                "format": "date"
              },
              "reportDate": {
                "type": [
                  "string",
                  "null"
                ],
                "format": "date"
              },
              "accessionNumber": {
                "type": "string"
              },
              "primaryDocument": {
                "type": "string"
              },
              "description": {
                "type": "string"
              },
              "items": {
                "type": "array",
                "items": {
                  "type": "string"
                },
                "description": "SEC item codes, present on 8-Ks."
              },
              "summary": {
                "type": "string",
                "description": "Plain-English gloss of the form and its items."
              },
              "url": {
                "type": "string",
                "format": "uri",
                "description": "Direct link to the primary document."
              },
              "filingIndexUrl": {
                "type": "string",
                "format": "uri"
              },
              "sizeBytes": {
                "type": [
                  "integer",
                  "null"
                ]
              },
              "isXBRL": {
                "type": "boolean"
              }
            }
          }
        },
        "retrievedAt": {
          "type": "string",
          "format": "date-time"
        }
      }
    }
  },
};
