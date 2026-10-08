"use client";

import { executeTrade } from "@/actions/trade";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  quoteDelayLabel,
  type BtcQuoteStatus,
} from "@/lib/btc-quote";
import { cn } from "@/lib/utils";
import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

const formSchema = z.object({
  amount: z.coerce
    .number()
    .positive({ message: "Amount must be greater than 0" }),
});

interface TradeFormProps {
  initialBtcPrice: number | null;
  quoteStatus: BtcQuoteStatus;
  usdtBalance: number;
  btcBalance: number;
}

function isQuoteStatus(value: unknown): value is BtcQuoteStatus {
  return value === "fresh" || value === "stale" || value === "unavailable";
}

export function TradeForm({
  initialBtcPrice,
  quoteStatus: initialQuoteStatus,
  usdtBalance,
  btcBalance,
}: TradeFormProps) {
  const [btcPrice, setBtcPrice] = useState<number | null>(initialBtcPrice);
  const [quoteStatus, setQuoteStatus] = useState<BtcQuoteStatus>(
    initialQuoteStatus
  );
  const [tradeType, setTradeType] = useState<"BUY" | "SELL">("BUY");
  const [isPending, startTransition] = useTransition();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: { amount: 0 },
  });
  const amount = form.watch("amount");

  // Determine which asset is being spent and which is being received
  const spendAsset: "USDT" | "BTC" = tradeType === "BUY" ? "USDT" : "BTC";
  const receiveAsset = tradeType === "BUY" ? "BTC" : "USDT";
  const spendBalance = tradeType === "BUY" ? usdtBalance : btcBalance;

  // Calculate the received amount based on the input amount
  const receiveAmount =
    amount > 0 && btcPrice != null && btcPrice > 0
      ? spendAsset === "USDT"
        ? amount / btcPrice
        : amount * btcPrice
      : 0;

  // Function to handle quick percentage clicks
  const handlePercentageClick = (percentage: number) => {
    if (tradeType === "SELL" && percentage === 1) {
      // For 100% sell, use the exact btcBalance
      form.setValue("amount", parseFloat(btcBalance.toFixed(8)));
    } else {
      const value = spendBalance * percentage;
      form.setValue(
        "amount",
        parseFloat(value.toFixed(spendAsset === "USDT" ? 2 : 8))
      );
    }
  };

  // Refetch price periodically. A failed refresh keeps the last quote and
  // marks it delayed instead of clearing the form.
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const response = await fetch("/api/btc-price", { cache: "no-store" });
        const data = await response.json();
        const usd = data?.bitcoin?.usd;
        const status = data?.quote?.status;
        if (isQuoteStatus(status)) {
          if (status === "unavailable") {
            setBtcPrice(null);
          } else if (typeof usd === "number" && usd > 0) {
            setBtcPrice(usd);
          }
          setQuoteStatus(status);
          return;
        }
        if (typeof usd === "number" && usd > 0) {
          setBtcPrice(usd);
        }
        setQuoteStatus((current) =>
          current === "fresh" ? "stale" : current
        );
      } catch (error) {
        console.error("Client-side error fetching BTC price:", error);
        setQuoteStatus((current) =>
          current === "unavailable" ? "unavailable" : "stale"
        );
      }
    }, 10000);
    return () => clearInterval(interval);
  }, []);

  const delayLabel = quoteDelayLabel(quoteStatus);
  const quoteReady = quoteStatus === "fresh" && btcPrice != null && btcPrice > 0;
  const priceText =
    btcPrice == null
      ? "—"
      : `$${btcPrice.toLocaleString(undefined, {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })}`;

  function onSubmit(values: z.infer<typeof formSchema>) {
    if (!quoteReady) {
      toast.error("Trading is paused until a live BTC quote returns.");
      return;
    }
    startTransition(async () => {
      const payload = {
        tradeType,
        amount: values.amount,
        asset: spendAsset,
      };
      const result = await executeTrade(payload);
      if (result.success) {
        toast.success(result.success);
        form.reset({ amount: 0 });
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <Card>
      <CardHeader>
        <Tabs
          value={tradeType}
          onValueChange={(value) => setTradeType(value as "BUY" | "SELL")}
          className="w-full"
        >
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="BUY">Buy</TabsTrigger>
            <TabsTrigger value="SELL">Sell</TabsTrigger>
          </TabsList>
        </Tabs>
      </CardHeader>
      <CardContent>
        <div className="mb-4 flex items-center justify-between gap-3">
          <span
            className={cn(
              "text-sm font-medium tabular-nums",
              delayLabel && "text-muted-foreground"
            )}
          >
            {priceText}
          </span>
          {delayLabel ? (
            <Badge variant="outline">{delayLabel}</Badge>
          ) : null}
        </div>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          {/* --- SPEND INPUT --- */}
          <div className="space-y-2">
            <label className="text-sm font-medium">You Pay</label>
            <div className="relative">
              <Input
                type="number"
                step="any"
                className="pr-16 text-lg"
                {...form.register("amount")}
                placeholder="0.00"
              />
              <span className="absolute inset-y-0 right-4 flex items-center text-muted-foreground font-semibold">
                {spendAsset}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-xs text-muted-foreground">
                Available: {spendBalance.toFixed(spendAsset === "USDT" ? 2 : 6)}{" "}
                {spendAsset}
              </span>
              <div className="space-x-1">
                {[25, 50, 100].map((p) => (
                  <Button
                    key={p}
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => handlePercentageClick(p / 1000)}
                  >
                    {p}%
                  </Button>
                ))}
              </div>
            </div>
          </div>

          {/* --- RECEIVE DISPLAY --- */}
          <div className="space-y-2">
            <label className="text-sm font-medium">You Receive</label>
            <div className="relative">
              <Input
                readOnly
                className="pr-16 text-lg bg-muted/50"
                value={receiveAmount.toFixed(2)}
              />
              <span className="absolute inset-y-0 right-4 flex items-center text-muted-foreground font-semibold">
                {receiveAsset}
              </span>
            </div>
          </div>

          <Button
            type="submit"
            className="w-full"
            disabled={isPending || !quoteReady}
          >
            {isPending ? "Processing..." : `${tradeType} BTC`}
          </Button>
          {delayLabel ? (
            <p className="text-xs text-center text-muted-foreground">
              Buying and selling stay paused until a live quote returns.
            </p>
          ) : null}
        </form>
      </CardContent>
    </Card>
  );
}
