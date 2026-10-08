import { getBtcQuote } from "@/lib/btc-market";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const quote = await getBtcQuote();
  return NextResponse.json({
    bitcoin: {
      usd: quote.usd,
      usd_24h_change: quote.usd24hChange,
    },
    quote: {
      status: quote.status,
      fetchedAt:
        quote.fetchedAt == null
          ? null
          : new Date(quote.fetchedAt).toISOString(),
      ageMs: quote.ageMs,
    },
  });
}
