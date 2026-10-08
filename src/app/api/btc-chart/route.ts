import { getBtcChart, parseChartDays } from "@/lib/btc-market";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const days = parseChartDays(request.nextUrl.searchParams.get("days"));
  if (!days) {
    return NextResponse.json(
      { status: "unavailable", points: [], error: "Unsupported chart range" },
      { status: 400 }
    );
  }

  const chart = await getBtcChart(days);
  return NextResponse.json({
    status: chart.status,
    points: chart.points,
  });
}
