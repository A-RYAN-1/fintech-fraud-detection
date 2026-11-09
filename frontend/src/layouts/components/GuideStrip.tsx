import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { ArrowLeft, ArrowRight, Compass, X } from "lucide-react";
import { guidedTour } from "@/config";
import { useAuth } from "@/features/auth/hooks";
import { cn } from "@/utils";

const STORAGE_KEY = "sentrix-guide-hidden";

function readHidden(): boolean {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

function writeHidden(hidden: boolean) {
  try {
    if (hidden) window.localStorage.setItem(STORAGE_KEY, "1");
    else window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Storage can be blocked; the guide then simply shows again next time.
  }
}

/**
 * A slim bar under the header that walks a role through the demo, page by page: where you are, what to do here,
 * and a link to the next page. It shows only on a page that is part of the role's path, and can be hidden.
 */
export default function GuideStrip() {
  const { user } = useAuth();
  const { pathname } = useLocation();
  const [hidden, setHidden] = useState(readHidden);

  const steps = user ? guidedTour[user.role] : undefined;
  if (!steps) return null;
  const index = steps.findIndex((s) => s.href === pathname);
  if (index === -1) return null;

  const step = steps[index];
  const prev = steps[index - 1];
  const next = steps[index + 1];

  const toggle = (value: boolean) => {
    setHidden(value);
    writeHidden(value);
  };

  if (hidden) {
    return (
      <div className="flex justify-end px-4 pt-3 md:px-6 lg:px-8">
        <button
          type="button"
          onClick={() => toggle(false)}
          className="inline-flex items-center gap-1.5 rounded-full border border-neutral-200 bg-white px-3 py-1 text-xs font-medium text-neutral-600 transition-colors hover:text-neutral-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 dark:border-white/10 dark:bg-white/[0.03] dark:text-neutral-400 dark:hover:text-neutral-100"
        >
          <Compass className="h-3.5 w-3.5" aria-hidden="true" />
          Show the guide ({index + 1} of {steps.length})
        </button>
      </div>
    );
  }

  return (
    <aside
      aria-label="Guided tour"
      className="border-b border-neutral-200/80 bg-white/60 backdrop-blur dark:border-white/[0.06] dark:bg-white/[0.02]"
    >
      <div className="flex flex-col gap-3 px-4 py-3 md:flex-row md:items-center md:gap-5 md:px-6 lg:px-8">
        <div className="flex min-w-0 flex-1 items-start gap-3">
          <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-brand-gradient text-white">
            <Compass className="h-3.5 w-3.5" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <p className="flex flex-wrap items-center gap-x-2 text-xs text-neutral-500 dark:text-neutral-400">
              <span className="font-semibold uppercase tracking-[0.12em] text-primary-700 dark:text-primary-300">
                Guided tour
              </span>
              <span>
                Step {index + 1} of {steps.length}: {step.title}
              </span>
            </p>
            <p className="mt-0.5 text-sm text-neutral-800 dark:text-neutral-200">
              {step.line}
            </p>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-3">
          <ol className="hidden items-center gap-1 sm:flex" aria-hidden="true">
            {steps.map((s, i) => (
              <li
                key={s.href}
                className={cn(
                  "h-1.5 rounded-full transition-all",
                  i === index
                    ? "w-5 bg-brand-gradient"
                    : i < index
                      ? "w-1.5 bg-primary-400/70"
                      : "w-1.5 bg-neutral-300 dark:bg-white/15",
                )}
              />
            ))}
          </ol>
          {prev && (
            <Link
              to={prev.href}
              aria-label={`Back to ${prev.title}`}
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-neutral-200 text-neutral-600 hover:bg-neutral-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 dark:border-white/10 dark:text-neutral-300 dark:hover:bg-white/[0.06]"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            </Link>
          )}
          {next ? (
            <Link
              to={next.href}
              className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-primary-700 px-3 text-sm font-medium text-white hover:bg-primary-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
            >
              Next: {next.title}
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          ) : (
            <Link
              to="/tour"
              className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-neutral-200 px-3 text-sm font-medium hover:bg-neutral-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 dark:border-white/10 dark:hover:bg-white/[0.06]"
            >
              Back to the tour
            </Link>
          )}
          <button
            type="button"
            onClick={() => toggle(true)}
            aria-label="Hide the guide"
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 dark:text-neutral-400 dark:hover:bg-white/[0.06] dark:hover:text-neutral-100"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      </div>
    </aside>
  );
}
