import { NavLink, Outlet } from "react-router-dom";
import { cn } from "@/utils";

const TABS = [
  { to: "/payments/pay", label: "Pay" },
  { to: "/payments/history", label: "History" },
];

export default function PaymentsLayout() {
  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-neutral-900 dark:text-neutral-100">
          Payments
        </h1>
        <p className="text-neutral-600 dark:text-neutral-400">
          A customer pays, Sentrix judges the payment, a reviewer sees the
          evidence, an admin sets the limits.
        </p>
      </div>

      <nav
        aria-label="Payments sections"
        className="flex gap-1 border-b border-neutral-200 dark:border-neutral-800"
      >
        {TABS.map((tab) => (
          <NavLink
            key={tab.to}
            to={tab.to}
            className={({ isActive }) =>
              cn(
                "-mb-px border-b-2 px-4 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "border-primary-600 text-primary-700 dark:border-primary-400 dark:text-primary-300"
                  : "border-transparent text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-100",
              )
            }
          >
            {tab.label}
          </NavLink>
        ))}
      </nav>

      <Outlet />
    </div>
  );
}
