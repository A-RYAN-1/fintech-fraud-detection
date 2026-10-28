const usd = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

const usdWhole = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

/** The one money formatter: USD, en-US. `whole` drops the cents for totals. */
export function formatMoney(
  amount: number | string,
  options: { whole?: boolean } = {},
): string {
  const value = typeof amount === "string" ? parseFloat(amount) : amount;
  if (!Number.isFinite(value)) return usd.format(0);
  return (options.whole ? usdWhole : usd).format(value);
}
