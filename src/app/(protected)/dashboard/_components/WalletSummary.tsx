"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useEffect, useState } from "react";
// import { Skeleton } from '@/components/ui/skeleton'; // Uncomment if you have Skeleton

interface WalletSummaryProps {
  usdtBalance: number;
  btcBalance: number;
  initialBtcPrice: number;
}

const INITIAL_CAPITAL = 10000;

export function WalletSummary({
  usdtBalance,
  btcBalance,
  initialBtcPrice,
}: WalletSummaryProps) {
  const [btcPrice, setBtcPrice] = useState(initialBtcPrice);
  const [isLoading, setIsLoading] = useState(initialBtcPrice === 0);

  useEffect(() => {
    const fetchPrice = async () => {
      try {
        // Fetch from local API proxy
        const response = await fetch("/api/btc-price");
        if (!response.ok) {
          console.error("Failed to fetch price from local API proxy.");
          return;
        }
        const data = await response.json();
        if (data.bitcoin?.usd) {
          setBtcPrice(data.bitcoin.usd);
        }
        if (isLoading) setIsLoading(false);
      } catch (error) {
        console.error("Client-side error fetching BTC price:", error);
      }
    };
    if (isLoading) {
      fetchPrice();
    }
    const interval = setInterval(fetchPrice, 10000);
    return () => clearInterval(interval);
  }, [isLoading]);

  const btcValueInUsd = btcBalance * btcPrice;
  const totalPortfolioValue = usdtBalance + btcValueInUsd;
  const pnl = totalPortfolioValue - INITIAL_CAPITAL;
  const pnlPercentage = (pnl / INITIAL_CAPITAL) * 100;
  const pnlColor = pnl >= 0 ? "text-green-500" : "text-red-500";

  // Uncomment this block if you have a Skeleton component
  // if (isLoading) {
  //   return (
  //       <Card>
  //           <CardHeader><CardTitle>Wallet Summary</CardTitle></CardHeader>
  //           <CardContent className="space-y-4">
  //               <Skeleton className="h-4 w-[150px]" />
  //               <Skeleton className="h-4 w-[200px]" />
  //               <Skeleton className="h-10 w-full mt-4" />
  //               <Skeleton className="h-4 w-[180px]" />
  //           </CardContent>
  //       </Card>
  //   );
  // }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Wallet Summary</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex justify-between items-center">
          <span className="text-muted-foreground">USDT Balance:</span>
          <span className="font-mono font-semibold">
            ${usdtBalance.toFixed(2)}
          </span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-muted-foreground">BTC Holdings:</span>
          <span className="font-mono font-semibold">
            {btcBalance.toFixed(8)} BTC
          </span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-muted-foreground">BTC Value:</span>
          <span className="font-mono font-semibold">
            ${btcValueInUsd.toFixed(2)}
          </span>
        </div>
        <hr className="my-3" />
        <div className="flex justify-between items-center">
          <span className="font-bold">Total Portfolio Value:</span>
          <span className="font-bold text-lg">
            ${totalPortfolioValue.toFixed(2)}
          </span>
        </div>
        <div
          className={`flex justify-between items-center text-lg ${pnlColor}`}
        >
          <span className="font-bold">Total P&L:</span>
          <span className="font-bold font-mono">
            {pnl >= 0 ? "+" : ""}${pnl.toFixed(2)} ({pnlPercentage.toFixed(2)}%)
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
