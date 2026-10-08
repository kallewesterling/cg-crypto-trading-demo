"use client";

import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  quoteDelayLabel,
  type BtcQuoteStatus,
} from "@/lib/btc-quote";
import * as React from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceLine,
  XAxis,
  YAxis,
} from "recharts";

type ChartDataPoint = { date: string; price: number };

const timeRangeOptions = [
  { label: "Last 7 Days", value: "7" },
  { label: "Last 30 Days", value: "30" },
  { label: "Last 3 Months", value: "90" },
  { label: "Last Year", value: "365" },
];

function chartStatus(value: unknown): BtcQuoteStatus | null {
  if (value === "fresh" || value === "stale" || value === "unavailable") {
    return value;
  }
  return null;
}

export function BtcPriceChart() {
  const [data, setData] = React.useState<ChartDataPoint[]>([]);
  const [loadedRange, setLoadedRange] = React.useState<string | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [quoteStatus, setQuoteStatus] = React.useState<BtcQuoteStatus>("fresh");
  const [timeRange, setTimeRange] = React.useState("30");
  const dataRef = React.useRef(data);
  const loadedRangeRef = React.useRef(loadedRange);
  dataRef.current = data;
  loadedRangeRef.current = loadedRange;

  React.useEffect(() => {
    let cancelled = false;
    const fetchData = async () => {
      const hasThisRange = loadedRangeRef.current === timeRange;
      if (!hasThisRange) setIsLoading(true);
      try {
        const response = await fetch(`/api/btc-chart?days=${timeRange}`, {
          cache: "no-store",
        });
        const payload = await response.json();
        if (cancelled) return;
        const points = Array.isArray(payload)
          ? payload
          : Array.isArray(payload?.points)
            ? payload.points
            : null;
        const status = chartStatus(payload?.status);
        if (!response.ok || !points || points.length === 0) {
          if (hasThisRange && dataRef.current.length > 0) {
            setQuoteStatus("stale");
          } else {
            setData([]);
            setLoadedRange(null);
            setQuoteStatus(status === "stale" ? "stale" : "unavailable");
          }
          return;
        }
        setData(points);
        setLoadedRange(timeRange);
        setQuoteStatus(status ?? "fresh");
      } catch (error) {
        if (cancelled) return;
        console.error("Failed to fetch chart data", error);
        if (hasThisRange && dataRef.current.length > 0) {
          setQuoteStatus("stale");
        } else {
          setData([]);
          setLoadedRange(null);
          setQuoteStatus("unavailable");
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };
    fetchData();
    return () => {
      cancelled = true;
    };
  }, [timeRange]);

  const { chartDomain, isPositiveChange, currentPrice, priceChange } =
    React.useMemo(() => {
      if (!data || data.length === 0) {
        return {
          chartDomain: [0, 0],
          isPositiveChange: true,
          currentPrice: 0,
          priceChange: { value: 0, percent: 0 },
        };
      }

      const prices = data.map((d) => d.price);
      const minPrice = Math.min(...prices);
      const maxPrice = Math.max(...prices);
      const padding = (maxPrice - minPrice) * 0.05;

      const startPrice = prices[0];
      const endPrice = prices[prices.length - 1];
      const changeValue = endPrice - startPrice;
      const changePercent = (changeValue / startPrice) * 100;

      return {
        chartDomain: [minPrice - padding, maxPrice + padding],
        isPositiveChange: endPrice >= startPrice,
        currentPrice: endPrice,
        priceChange: { value: changeValue, percent: changePercent },
      };
    }, [data]);

  const strokeColor = isPositiveChange
    ? "hsl(var(--chart-positive))"
    : "hsl(var(--chart-negative))";
  const fillColorId = isPositiveChange ? "fillPositive" : "fillNegative";
  const showSkeleton = isLoading && loadedRange !== timeRange;
  const delayLabel = quoteDelayLabel(quoteStatus);

  return (
    <Card>
      <CardHeader className="flex flex-col items-start gap-4 space-y-0 border-b py-5 sm:flex-row sm:items-center sm:gap-6">
        <div className="grid flex-1 gap-1">
          <CardTitle className="flex items-center gap-2">
            Bitcoin Price
            {delayLabel ? <Badge variant="outline">{delayLabel}</Badge> : null}
          </CardTitle>
          <CardDescription>
            {data.length === 0
              ? "Chart unavailable"
              : `${isPositiveChange ? "Increased" : "Decreased"} by $${priceChange.value.toFixed(2)} (${priceChange.percent.toFixed(2)}%)`}
          </CardDescription>
        </div>
        <Select value={timeRange} onValueChange={setTimeRange}>
          <SelectTrigger
            className="w-[160px] rounded-lg sm:ml-auto"
            aria-label="Select a value"
          >
            <SelectValue placeholder="Select time range" />
          </SelectTrigger>
          <SelectContent className="rounded-xl">
            {timeRangeOptions.map(({ label, value }) => (
              <SelectItem key={value} value={value} className="rounded-lg">
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </CardHeader>
      <CardContent className="px-2 pt-4 sm:px-6 sm:pt-6">
        {showSkeleton ? (
          <Skeleton className="h-[250px] w-full" />
        ) : data.length === 0 ? (
          <div className="flex h-[250px] items-center justify-center text-sm text-muted-foreground">
            Chart unavailable
          </div>
        ) : (
          <ChartContainer config={{}} className="aspect-auto h-[250px] w-full">
            <AreaChart data={data}>
              <defs>
                <linearGradient id="fillPositive" x1="0" y1="0" x2="0" y2="1">
                  <stop
                    offset="5%"
                    stopColor="hsl(var(--chart-positive))"
                    stopOpacity={0.8}
                  />
                  <stop
                    offset="95%"
                    stopColor="hsl(var(--chart-positive))"
                    stopOpacity={0.1}
                  />
                </linearGradient>
                <linearGradient id="fillNegative" x1="0" y1="0" x2="0" y2="1">
                  <stop
                    offset="5%"
                    stopColor="hsl(var(--chart-negative))"
                    stopOpacity={0.8}
                  />
                  <stop
                    offset="95%"
                    stopColor="hsl(var(--chart-negative))"
                    stopOpacity={0.1}
                  />
                </linearGradient>
              </defs>
              <CartesianGrid
                vertical={false}
                stroke={`hsl(var(--muted-foreground), 0.2)`}
              />
              <XAxis
                dataKey="date"
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                tickFormatter={(value) =>
                  new Date(value).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                  })
                }
              />
              <YAxis
                domain={chartDomain}
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                tickFormatter={(value) =>
                  `$${(Number(value) / 100).toFixed(1)}k`
                }
              />
              <ChartTooltip
                cursor={false}
                content={
                  <ChartTooltipContent
                    indicator="dot"
                    formatter={(value) => `$${Number(value).toLocaleString()}`}
                  />
                }
              />
              <Area
                dataKey="price"
                type="natural"
                fill={`url(#${fillColorId})`}
                stroke={strokeColor}
                strokeWidth={2}
                dot={false}
              />
              <ReferenceLine
                y={currentPrice}
                stroke={strokeColor}
                strokeDasharray="3 3"
              />
            </AreaChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  );
}
