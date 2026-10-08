import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  formatTradeHistoryBtc,
  formatTradeHistoryTotal,
} from "./trade-history.ts";

// Rows from the Trade History report. usdtAmount is the cash leg;
// btcAmount is that cash divided by the fill price.
const reportedRows = [
  { type: "BUY", price: 86006, usdt: 100 },
  { type: "BUY", price: 105613, usdt: 2499.87 },
  { type: "SELL", price: 105532, usdt: 99.48185044 },
  { type: "BUY", price: 106082, usdt: 100 },
] as const;

describe("trade history total", () => {
  for (const row of reportedRows) {
    const btc = row.usdt / row.price;

    it(`${row.type} at $${row.price} totals the USD cash leg`, () => {
      const amount = formatTradeHistoryBtc(btc);
      const total = formatTradeHistoryTotal(row.usdt);
      const product = row.price * Number(amount);

      assert.equal(total, formatTradeHistoryTotal(product));
      assert.notEqual(total, `$${btc.toFixed(2)}`);
      assert.notEqual(amount, row.usdt.toFixed(8));
      assert.ok(Math.abs(product - row.usdt) < 0.01);
    });
  }

  it("formats thousands and cents", () => {
    assert.equal(formatTradeHistoryTotal(2499.87), "$2,499.87");
    assert.equal(formatTradeHistoryTotal(100), "$100.00");
    assert.equal(formatTradeHistoryBtc(0.001162709), "0.00116271");
  });
});
