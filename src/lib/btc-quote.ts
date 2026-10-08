export const FRESH_TTL_MS = 60_000;

export const TRADE_PAUSED_ERROR =
  "Trading is paused until a live BTC quote returns.";

export type BtcQuoteStatus = "fresh" | "stale" | "unavailable";

export type CachedQuote = {
  usd: number;
  usd24hChange: number | null;
  fetchedAt: number;
};

export type UpstreamQuote =
  | { ok: true; usd: number; usd24hChange: number | null }
  | { ok: false };

export type ResolvedQuote = {
  usd: number | null;
  usd24hChange: number | null;
  status: BtcQuoteStatus;
  fetchedAt: number | null;
  ageMs: number | null;
  nextCache: CachedQuote | null;
};

export function quoteDelayLabel(status: BtcQuoteStatus): string | null {
  switch (status) {
    case "fresh":
      return null;
    case "stale":
      return "Price delayed";
    case "unavailable":
      return "Price unavailable";
    default: {
      const exhaustive: never = status;
      return exhaustive;
    }
  }
}

export function assertTradableQuote(quote: {
  status: BtcQuoteStatus;
  usd: number | null;
}): { ok: true; usd: number } | { ok: false; error: string } {
  switch (quote.status) {
    case "fresh":
      if (quote.usd != null && Number.isFinite(quote.usd) && quote.usd > 0) {
        return { ok: true, usd: quote.usd };
      }
      return { ok: false, error: TRADE_PAUSED_ERROR };
    case "stale":
    case "unavailable":
      return { ok: false, error: TRADE_PAUSED_ERROR };
    default: {
      const exhaustive: never = quote.status;
      return exhaustive;
    }
  }
}

function usableCache(
  cached: CachedQuote | null,
  now: number
): CachedQuote | null {
  if (!cached) return null;
  if (!Number.isFinite(cached.usd) || cached.usd <= 0) return null;
  if (!Number.isFinite(cached.fetchedAt) || cached.fetchedAt > now + 5_000) {
    return null;
  }
  const change = cached.usd24hChange;
  return {
    usd: cached.usd,
    usd24hChange: change != null && Number.isFinite(change) ? change : null,
    fetchedAt: cached.fetchedAt,
  };
}

function usableUpstream(upstream: UpstreamQuote): CachedQuote | null {
  if (!upstream.ok) return null;
  if (!Number.isFinite(upstream.usd) || upstream.usd <= 0) return null;
  const change = upstream.usd24hChange;
  return {
    usd: upstream.usd,
    usd24hChange: change != null && Number.isFinite(change) ? change : null,
    fetchedAt: 0,
  };
}

export function resolveBtcQuote(input: {
  now: number;
  cached: CachedQuote | null;
  upstream: UpstreamQuote | null;
}): ResolvedQuote {
  const cached = usableCache(input.cached, input.now);
  const upstream = input.upstream ? usableUpstream(input.upstream) : null;

  if (upstream) {
    const nextCache = { ...upstream, fetchedAt: input.now };
    return {
      usd: nextCache.usd,
      usd24hChange: nextCache.usd24hChange,
      status: "fresh",
      fetchedAt: input.now,
      ageMs: 0,
      nextCache,
    };
  }

  if (cached) {
    const ageMs = Math.max(0, input.now - cached.fetchedAt);
    const status: BtcQuoteStatus =
      input.upstream === null && ageMs < FRESH_TTL_MS ? "fresh" : "stale";
    return {
      usd: cached.usd,
      usd24hChange: cached.usd24hChange,
      status,
      fetchedAt: cached.fetchedAt,
      ageMs,
      nextCache: null,
    };
  }

  return {
    usd: null,
    usd24hChange: null,
    status: "unavailable",
    fetchedAt: null,
    ageMs: null,
    nextCache: null,
  };
}
