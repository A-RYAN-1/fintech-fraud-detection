interface BarListProps {
  items: { label: string; value: number }[];
  /** Read when every value is 0 or the list is empty. */
  empty: string;
}

/** Horizontal bars as plain HTML, so the numbers stay readable without a chart library or colour. */
export default function BarList({ items, empty }: BarListProps) {
  const max = Math.max(0, ...items.map((i) => i.value));
  if (items.length === 0 || max === 0) {
    return (
      <p className="text-sm text-neutral-500 dark:text-neutral-400">{empty}</p>
    );
  }
  return (
    <ul className="space-y-3">
      {items.map((item) => (
        <li key={item.label}>
          <div className="flex items-baseline justify-between gap-4 text-sm">
            <span className="text-neutral-700 dark:text-neutral-300">
              {item.label}
            </span>
            <span className="font-medium tabular-nums text-neutral-900 dark:text-neutral-100">
              {item.value}
            </span>
          </div>
          <div
            aria-hidden="true"
            className="mt-1 h-2 rounded-full bg-neutral-100 dark:bg-neutral-800"
          >
            <div
              className="h-2 rounded-full bg-primary-500"
              style={{ width: `${(item.value / max) * 100}%` }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}
