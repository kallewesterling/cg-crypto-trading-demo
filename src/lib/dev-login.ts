import prisma from "./prisma";

export type TestAccount = {
  email: string;
  name: string;
  summary: string;
};

export function isDevLoginEnabled() {
  return (
    process.env.NODE_ENV === "development" && process.env.DEV_LOGIN === "true"
  );
}

function formatUsd(value: { toString(): string } | null | undefined) {
  const amount = Number(value?.toString() ?? "0");
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(amount);
}

function formatBtc(value: { toString(): string } | null | undefined) {
  const amount = Number(value?.toString() ?? "0");
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 8,
  }).format(amount);
}

function tradeLabel(count: number) {
  return count === 1 ? "1 trade" : `${count} trades`;
}

export async function listTestAccounts(): Promise<TestAccount[]> {
  if (!isDevLoginEnabled()) {
    return [];
  }

  const users = await prisma.user.findMany({
    take: 50,
    orderBy: [{ name: "asc" }, { email: "asc" }],
    select: {
      email: true,
      name: true,
      wallet: { select: { usdtBalance: true, btcBalance: true } },
      _count: { select: { trades: true } },
    },
  });

  return users.map((user) => ({
    email: user.email,
    name: user.name?.trim() || "Unnamed account",
    summary: `${formatUsd(user.wallet?.usdtBalance)} cash · ${formatBtc(user.wallet?.btcBalance)} BTC · ${tradeLabel(user._count.trades)}`,
  }));
}
