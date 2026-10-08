type Numeric = number | string | { toString(): string };

function asNumber(value: Numeric): number {
  return Number(value);
}

// Amount is the BTC quantity. The USD cash leg lives on usdtAmount.
export function formatTradeHistoryBtc(btcAmount: Numeric): string {
  return asNumber(btcAmount).toFixed(8);
}

// Total is the USDT cash leg (price × BTC). Do not format btcAmount as dollars.
export function formatTradeHistoryTotal(usdtAmount: Numeric): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(asNumber(usdtAmount));
}
