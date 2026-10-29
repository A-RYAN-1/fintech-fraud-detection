import { useEffect, useState } from "react";
import {
  Shield,
  Wallet,
  ListChecks,
  Cpu,
  Sparkles,
  UserCheck,
  CircleCheck,
  ArrowRight,
  ArrowLeft,
  type LucideIcon,
} from "lucide-react";
import ThemeToggle from "@/components/common/ThemeToggle";
import { Button } from "@/components/ui";
import { pipelineSteps, type PipelineStep } from "@/config";
import LoginForm from "./LoginForm";

const ICONS: Record<PipelineStep["key"], LucideIcon> = {
  paypal: Wallet,
  rules: ListChecks,
  model: Cpu,
  ai: Sparkles,
  human: UserCheck,
  result: CircleCheck,
};

const FACE =
  "col-start-1 row-start-1 rounded-2xl border border-neutral-200 bg-white p-5 shadow-soft [backface-visibility:hidden] dark:border-neutral-800 dark:bg-neutral-900 sm:p-6";

/**
 * Sign-in page: one centred card. The front says what Sentrix is, the back
 * holds the sign-in form and the sandbox logins; a link on each face flips it.
 */
export default function LoginFlipCard() {
  const [showLogin, setShowLogin] = useState(false);

  useEffect(() => {
    if (showLogin) {
      document.getElementById("email")?.focus({ preventScroll: true });
    }
  }, [showLogin]);

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-neutral-50 px-4 py-6 text-neutral-900 dark:bg-neutral-950 dark:text-neutral-100">
      <div className="absolute right-4 top-4">
        <ThemeToggle />
      </div>

      <div className="w-full max-w-md [perspective:1800px]">
        <div
          className={
            "grid transition-transform duration-700 ease-in-out [transform-style:preserve-3d] motion-reduce:transition-none " +
            (showLogin ? "[transform:rotateY(180deg)]" : "")
          }
        >
          <section
            aria-label="About Sentrix"
            aria-hidden={showLogin}
            inert={showLogin}
            className={FACE}
          >
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary-600 text-white">
                <Shield className="h-5 w-5" aria-hidden="true" />
              </span>
              <span className="text-xl font-semibold tracking-tight">
                Sentrix
              </span>
            </div>
            <h1 className="mt-5 text-xl font-semibold leading-tight sm:text-2xl">
              PayPal payments, judged by AI before the money moves.
            </h1>
            <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">
              Rules, a trained model and an AI analyst check every authorized
              payment. Safe ones are captured, doubtful ones wait for a person,
              the rest are voided, and every decision is on record.
            </p>

            <ol
              aria-label="How a payment is decided"
              className="mt-5 grid grid-cols-2 gap-2"
            >
              {pipelineSteps.map((step, i) => {
                const Icon = ICONS[step.key];
                return (
                  <li
                    key={step.key}
                    className="flex items-center gap-2 rounded-md border border-neutral-200 px-2.5 py-2 text-sm dark:border-neutral-800"
                  >
                    <Icon
                      className="h-4 w-4 shrink-0 text-primary-600 dark:text-primary-300"
                      aria-hidden="true"
                    />
                    <span>
                      {i + 1}. {step.title}
                    </span>
                  </li>
                );
              })}
            </ol>

            <Button
              type="button"
              className="mt-5 w-full"
              onClick={() => setShowLogin(true)}
            >
              Continue to sign in
              <ArrowRight className="ml-2 h-4 w-4" aria-hidden="true" />
            </Button>
            <p className="mt-3 text-center text-xs text-neutral-500 dark:text-neutral-400">
              Demo on the PayPal sandbox. No real money moves.
            </p>
          </section>

          <section
            aria-label="Sign in"
            aria-hidden={!showLogin}
            inert={!showLogin}
            className={FACE + " [transform:rotateY(180deg)]"}
          >
            <div className="mx-auto w-full max-w-md">
              <h1 className="text-xl font-semibold">Sign in to Sentrix</h1>
              <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
                Use your account, or pick a sandbox login below.
              </p>
              <div className="mt-4">
                <LoginForm />
              </div>
              <button
                type="button"
                onClick={() => setShowLogin(false)}
                className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-primary-600 hover:text-primary-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 dark:text-primary-400"
              >
                <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                About Sentrix
              </button>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
