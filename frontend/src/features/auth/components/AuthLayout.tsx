import type { ReactNode } from "react";
import { Shield, ListChecks, Cpu, Sparkles, UserCheck } from "lucide-react";
import ThemeToggle from "@/components/common/ThemeToggle";

const CHECKS = [
  {
    icon: ListChecks,
    title: "Rules",
    text: "Amount, device, velocity and location rules add up a risk score.",
  },
  {
    icon: Cpu,
    title: "Model",
    text: "A trained model scores the same payment from its features.",
  },
  {
    icon: Sparkles,
    title: "AI analyst",
    text: "An agent reads the evidence and explains its verdict in words.",
  },
  {
    icon: UserCheck,
    title: "Human gate",
    text: "Held payments wait for a reviewer; big ones need a second person.",
  },
];

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-neutral-50 text-neutral-900 dark:bg-neutral-950 dark:text-neutral-100 lg:grid lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
      <aside className="border-b border-neutral-200 bg-white px-6 py-8 dark:border-neutral-800 dark:bg-neutral-900 lg:flex lg:flex-col lg:justify-between lg:border-b-0 lg:border-r lg:px-12 lg:py-12">
        <div>
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary-600 text-white">
              <Shield className="h-5 w-5" aria-hidden="true" />
            </span>
            <span className="text-xl font-semibold tracking-tight">
              Sentrix
            </span>
          </div>

          <h1 className="mt-8 text-2xl font-semibold leading-tight sm:text-3xl">
            Every payment is judged before the money moves.
          </h1>
          <p className="mt-3 max-w-md text-neutral-600 dark:text-neutral-400">
            Sentrix sits between a PayPal checkout and your books. It approves
            safe payments, holds doubtful ones for a person, and blocks the
            rest, with the reason for each decision on record.
          </p>
        </div>

        <section aria-labelledby="checks-heading" className="mt-8 lg:mt-12">
          <h2
            id="checks-heading"
            className="text-xs font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400"
          >
            The four checks on every payment
          </h2>
          <ol className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
            {CHECKS.map(({ icon: Icon, title, text }, i) => (
              <li key={title} className="flex gap-3">
                <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-neutral-200 text-primary-700 dark:border-neutral-700 dark:text-primary-300">
                  <Icon className="h-4 w-4" aria-hidden="true" />
                </span>
                <div>
                  <p className="text-sm font-medium">
                    {i + 1}. {title}
                  </p>
                  <p className="text-sm text-neutral-600 dark:text-neutral-400">
                    {text}
                  </p>
                </div>
              </li>
            ))}
          </ol>
          <p className="mt-6 text-xs text-neutral-500 dark:text-neutral-400">
            Demo deployment on the PayPal sandbox. No real money moves.
          </p>
        </section>
      </aside>

      <main className="relative flex items-center justify-center px-4 py-10 sm:px-8">
        <div className="absolute right-4 top-4">
          <ThemeToggle />
        </div>
        <div className="w-full max-w-md">{children}</div>
      </main>
    </div>
  );
}
