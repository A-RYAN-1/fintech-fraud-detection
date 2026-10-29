import type { ReactNode } from "react";
import {
  Shield,
  Wallet,
  ListChecks,
  Cpu,
  Sparkles,
  UserCheck,
  CircleCheck,
  type LucideIcon,
} from "lucide-react";
import ThemeToggle from "@/components/common/ThemeToggle";
import { pipelineSteps, type PipelineStep } from "@/config";

const ICONS: Record<PipelineStep["key"], LucideIcon> = {
  paypal: Wallet,
  rules: ListChecks,
  model: Cpu,
  ai: Sparkles,
  human: UserCheck,
  result: CircleCheck,
};

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-neutral-50 text-neutral-900 dark:bg-neutral-950 dark:text-neutral-100 lg:grid lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
      <aside className="border-t border-neutral-200 lg:border-t-0 bg-white px-6 py-8 dark:border-neutral-800 dark:bg-neutral-900 lg:flex lg:flex-col lg:justify-between lg:border-b-0 lg:border-r lg:px-12 lg:py-12">
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
            PayPal payments, judged by AI before the money moves.
          </h1>
          <p className="mt-3 max-w-md text-neutral-600 dark:text-neutral-400">
            Sentrix sits between a PayPal checkout and the capture. Rules, a
            trained model and an AI analyst check every authorized payment; safe
            ones are captured, doubtful ones wait for a person, the rest are
            voided, and the reason for each decision is on record.
          </p>
        </div>

        <section aria-labelledby="checks-heading" className="mt-8 lg:mt-10">
          <h2
            id="checks-heading"
            className="text-xs font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400"
          >
            How a payment is decided
          </h2>
          <ol className="relative mt-4 space-y-4">
            {pipelineSteps.map((step, i) => {
              const Icon = ICONS[step.key];
              const last = i === pipelineSteps.length - 1;
              return (
                <li key={step.key} className="relative flex gap-3">
                  {!last && (
                    <span
                      aria-hidden="true"
                      className="absolute left-4 top-9 h-[calc(100%-1.25rem)] w-px bg-neutral-200 dark:bg-neutral-700"
                    />
                  )}
                  <span className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-neutral-200 bg-white text-primary-700 dark:border-neutral-700 dark:bg-neutral-900 dark:text-primary-300">
                    <Icon className="h-4 w-4" aria-hidden="true" />
                  </span>
                  <div>
                    <p className="text-sm font-medium">{step.title}</p>
                    <p className="text-sm text-neutral-600 dark:text-neutral-400">
                      {step.line}
                    </p>
                  </div>
                </li>
              );
            })}
          </ol>
          <p className="mt-6 text-xs text-neutral-500 dark:text-neutral-400">
            Demo deployment on the PayPal sandbox. No real money moves.
          </p>
        </section>
      </aside>

      <main className="relative order-first flex items-center justify-center px-4 py-10 sm:px-8 lg:order-none">
        <div className="absolute right-4 top-4">
          <ThemeToggle />
        </div>
        <div className="w-full max-w-md">
          <p className="mb-6 pr-10 text-sm text-neutral-600 dark:text-neutral-400 lg:hidden">
            <span className="font-semibold text-neutral-900 dark:text-neutral-100">
              Sentrix
            </span>{" "}
            checks PayPal payments with rules, a model and an AI analyst
            before the money moves. How it works is below the form.
          </p>
          {children}
        </div>
      </main>
    </div>
  );
}
