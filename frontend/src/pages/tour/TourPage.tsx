import { Link } from "react-router-dom";
import {
  ArrowRight,
  Bot,
  Check,
  ExternalLink,
  Github,
  PlayCircle,
  ShieldCheck,
  Sparkles,
  X,
} from "lucide-react";
import ThemeToggle from "@/components/common/ThemeToggle";
import { Button } from "@/components/ui";
import {
  demoAccounts,
  homePathFor,
  pipelineIcons,
  pipelineSteps,
  type DemoAccount,
} from "@/config";
import { useAuth, useLogin } from "@/features/auth/hooks";
import { countsFor } from "@/features/home";
import { usePublicPipeline } from "@/features/tour";
import { useTheme } from "@/hooks";
import { cn } from "@/utils";

export const VIDEO_URL = "https://youtu.be/i2tTB4IEENQ";
export const REPO_URL = "https://github.com/A-RYAN-1/fintech-fraud-detection";

const NAV = [
  { href: "#how", label: "How it works" },
  { href: "#ai", label: "AI with limits" },
  { href: "#agents", label: "Agents" },
  { href: "#try", label: "Try it" },
  { href: "#judges", label: "For judges" },
];

const PROBLEMS = [
  {
    title: "Checks are blunt or opaque",
    body: "Fixed rules block good customers; a single risk score says no without saying why. A reviewer is left guessing.",
  },
  {
    title: "AI near money needs a leash",
    body: "A language model can explain a case well, but it should never be the thing that releases or refunds a payment.",
  },
  {
    title: "Agents now pay for people",
    body: "AI shopping agents spend on someone's behalf. Each payment needs a limit set by the owner, and a record of what was refused.",
  },
];

const AI_MAY = [
  "Explain why a payment was held, in plain words",
  "Escalate a payment to a person",
  "Answer a reviewer's question about a case",
  "Draft a case summary and checks to make",
  "Draft one rule change, replayed over stored payments",
];

const AI_NEVER = [
  "Release a hold, capture, void or refund",
  "See emails, IP addresses, device ids or the customer's note",
  "Edit a live rule; only an admin accepts a draft",
  "Show a sentence that cites a number or rule not in the case facts",
];

const ROLE_STEPS: Record<string, string[]> = {
  customer: [
    "Pay with PayPal's sandbox buttons on Pay",
    "Open History: the scores, the AI verdict and what happens to your money",
    "Agents: give an AI agent a mandate with caps",
  ],
  reviewer: [
    "Open the Review Queue: one card per held payment",
    "Ask the analyst why, see similar past cases",
    "Capture or void: a real call to PayPal's sandbox",
  ],
  admin: [
    "Agents: mandates, refusals and held agent payments",
    "Rule Changes: an agent-drafted change with its replay",
    "Audit Log: every human and agent action",
  ],
};

const CRITERIA = [
  {
    name: "Technological implementation",
    where:
      "PayPal Orders v2 authorize, then capture or void behind the risk gate; a signature-checked webhook receiver; Gemini bounded by a facts-only payload and a grounding check; pgvector similar cases.",
    look: "Reviewer: Review Queue",
  },
  {
    name: "Design",
    where:
      "One product, four roles: the customer's view, the reviewer's case card, the admin's approvals and agents. Dark and light themes, an accessibility pass and phones down to 375 px.",
    look: "Any role: Home",
  },
  {
    name: "Potential impact",
    where:
      "Doubtful payments wait for a person instead of being declined outright. Each reviewer decision becomes a label that scores the rules, shows their false alarms and drives rule-change drafts.",
    look: "Admin: Feedback, Rule Changes",
  },
  {
    name: "Creativity",
    where:
      "Agent mandates: an AI agent pays only inside the owner's scope and caps, every refusal is on record, and payments inside the mandate still face the same checks.",
    look: "Admin or customer: Agents",
  },
];

const CHANGES = [
  {
    area: "PayPal",
    what: "Sandbox orders: create, authorize, capture, void and refund behind the risk gate; hold expiry; idempotency keys; signature-verified webhook receiver",
  },
  {
    area: "AI",
    what: "Bounded analyst verdict, evidence timeline, ask the analyst, case narrative, grounding check on every AI text",
  },
  {
    area: "Scoring",
    what: "Explainable second score, editable rules, reviewer decisions as labels, per-rule false alarms, rule-change drafts with a replay",
  },
  {
    area: "Agentic commerce",
    what: "Agent mandates (scope, caps, expiry, revoke), agent context on a case, owner notices",
  },
  {
    area: "Review and roles",
    what: "Reviewer and admin decision limits, four-eyes approval above a limit and for refunds, the customer's status and note",
  },
  {
    area: "Product",
    what: "Role-based app, live pipeline counts, this tour, accessibility pass",
  },
];

const STACK = [
  "Rails 8",
  "PostgreSQL + pgvector",
  "React 19",
  "TypeScript",
  "Tailwind",
  "PayPal Orders v2",
  "Google Gemini",
  "Solid Queue",
  "Render",
  "Vercel",
];

function useRoleSignIn() {
  const { isAuthenticated, user } = useAuth();
  const login = useLogin();
  return {
    pending: login.isPending,
    pendingEmail: login.variables?.email,
    isAuthenticated,
    homePath: homePathFor(user?.role),
    signIn: (account: DemoAccount) =>
      login.mutate({ email: account.email, password: account.password }),
  };
}

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary-700 dark:text-primary-300">
      {children}
    </p>
  );
}

function SectionTitle({
  id,
  eyebrow,
  title,
  lead,
}: {
  id: string;
  eyebrow: string;
  title: string;
  lead?: string;
}) {
  return (
    <div className="mx-auto max-w-2xl text-center">
      <Eyebrow>{eyebrow}</Eyebrow>
      <h2
        id={id}
        className="mt-3 text-balance text-3xl font-semibold tracking-tight text-neutral-900 sm:text-4xl dark:text-neutral-50"
      >
        {title}
      </h2>
      {lead && (
        <p className="mt-4 text-pretty text-base leading-relaxed text-neutral-600 dark:text-neutral-400">
          {lead}
        </p>
      )}
    </div>
  );
}

const PANEL =
  "rounded-2xl border border-neutral-200/80 bg-white shadow-soft dark:border-white/[0.07] dark:bg-neutral-925 dark:shadow-inset-hi";

/** A drawn example of the reviewer's case card: an illustration, not live data. */
function CasePreview() {
  return (
    <figure
      aria-label="Example of a held payment as a reviewer sees it"
      className={cn(PANEL, "relative overflow-hidden p-5 text-left sm:p-6")}
    >
      <div className="absolute inset-x-0 top-0 h-px bg-brand-gradient opacity-60" />
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-neutral-500 dark:text-neutral-400">
            Held for a person
          </p>
          <p className="mt-1 text-3xl font-semibold tabular-nums tracking-tight">
            $42.00
          </p>
          <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
            Authorized at PayPal. Nothing is charged yet.
          </p>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-warning-100 px-2.5 py-1 text-xs font-medium text-warning-800 dark:bg-warning-500/15 dark:text-warning-300">
          <span className="h-1.5 w-1.5 rounded-full bg-warning-500" />
          Held
        </span>
      </div>
      <div className="mt-5 grid grid-cols-3 gap-2">
        {[
          { k: "Rules", v: "30", s: "New device" },
          { k: "Model", v: "3%", s: "Low risk" },
          { k: "AI analyst", v: "Review", s: "Escalated" },
        ].map((x) => (
          <div
            key={x.k}
            className="rounded-xl border border-neutral-200 bg-neutral-50 p-3 dark:border-white/[0.06] dark:bg-white/[0.03]"
          >
            <p className="text-[11px] text-neutral-500 dark:text-neutral-400">
              {x.k}
            </p>
            <p className="mt-0.5 text-lg font-semibold tabular-nums">{x.v}</p>
            <p className="text-[11px] text-neutral-500 dark:text-neutral-400">
              {x.s}
            </p>
          </div>
        ))}
      </div>
      <div className="mt-4 rounded-xl border border-accent-500/20 bg-accent-500/[0.06] p-3">
        <p className="flex items-center gap-1.5 text-xs font-medium text-accent-600 dark:text-accent-300">
          <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
          Why this verdict?
        </p>
        <p className="mt-1 text-sm leading-relaxed text-neutral-700 dark:text-neutral-300">
          The payment came from a device this buyer has not used before. The
          amount is in line with their history, so a person should confirm.
        </p>
        <p className="mt-1.5 flex items-center gap-1 text-[11px] text-neutral-500 dark:text-neutral-400">
          <ShieldCheck className="h-3 w-3" aria-hidden="true" />
          Checked against the case facts. Advice only.
        </p>
      </div>
      <div className="mt-4 flex gap-2">
        <span className="inline-flex h-9 flex-1 items-center justify-center rounded-lg bg-primary-700 text-sm font-medium text-white">
          Capture at PayPal
        </span>
        <span className="inline-flex h-9 flex-1 items-center justify-center rounded-lg border border-neutral-300 text-sm font-medium dark:border-white/10">
          Void at PayPal
        </span>
      </div>
      <figcaption className="mt-3 text-center text-[11px] text-neutral-500 dark:text-neutral-400">
        Illustration of the reviewer's case card
      </figcaption>
    </figure>
  );
}

function LiveStats() {
  const { data, isLoading, isError } = usePublicPipeline();
  const p = data?.pipeline;
  const stats: [string, number | undefined][] = [
    ["payments authorized", p?.authorized],
    ["held for a person", p?.held],
    ["read by the AI analyst", p?.ai_read],
    ["captured at PayPal", p?.captured],
  ];
  return (
    <div className="mt-12">
      <p className="flex items-center justify-center gap-2 text-xs font-medium text-neutral-500 dark:text-neutral-400 lg:justify-start">
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full rounded-full bg-success-500 opacity-60 motion-safe:animate-ping" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-success-500" />
        </span>
        {isError
          ? "Live counts are waking up; the free API can take a minute"
          : `Live from the demo, last ${data?.window_days ?? 7} days`}
      </p>
      <dl className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {stats.map(([label, value]) => (
          <div
            key={label}
            className="rounded-xl border border-neutral-200/80 bg-white/60 px-4 py-3 backdrop-blur dark:border-white/[0.07] dark:bg-white/[0.03]"
          >
            <dd className="text-2xl font-semibold tabular-nums tracking-tight text-neutral-900 dark:text-neutral-50">
              {isLoading || value === undefined ? (
                <span className="inline-block h-7 w-10 animate-pulse rounded bg-neutral-200 dark:bg-neutral-800" />
              ) : (
                value
              )}
            </dd>
            <dt className="mt-0.5 text-xs text-neutral-500 dark:text-neutral-400">
              {label}
            </dt>
          </div>
        ))}
      </dl>
    </div>
  );
}

function PipelineFlow() {
  const { data } = usePublicPipeline();
  return (
    <ol className="relative mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute left-0 right-0 top-9 hidden h-px overflow-hidden bg-neutral-200 xl:block dark:bg-white/10"
      >
        <div className="h-px w-1/3 bg-gradient-to-r from-transparent via-primary-400 to-transparent motion-safe:animate-flow" />
      </div>
      {pipelineSteps.map((step, i) => {
        const Icon = pipelineIcons[step.key];
        return (
          <li key={step.key} className={cn(PANEL, "relative p-5")}>
            <div className="flex items-center gap-3">
              <span className="relative flex h-9 w-9 items-center justify-center rounded-xl bg-brand-gradient text-white shadow-glow">
                <Icon className="h-4 w-4" aria-hidden="true" />
              </span>
              <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-neutral-500 dark:text-neutral-400">
                Step {i + 1}
              </span>
            </div>
            <h3 className="mt-4 font-semibold text-neutral-900 dark:text-neutral-50">
              {step.title}
            </h3>
            <p className="mt-1.5 text-sm leading-relaxed text-neutral-600 dark:text-neutral-400">
              {step.line}
            </p>
            {data && (
              <dl className="mt-4 flex flex-wrap gap-x-3 gap-y-1 border-t border-neutral-200 pt-3 dark:border-white/[0.06]">
                {countsFor(step.key, data.pipeline).map(([label, value]) => (
                  <div
                    key={label}
                    className="flex flex-row-reverse items-baseline justify-end gap-1"
                  >
                    <dt className="text-xs text-neutral-500 dark:text-neutral-400">
                      {label}
                    </dt>
                    <dd className="text-base font-semibold tabular-nums text-neutral-900 dark:text-neutral-100">
                      {value}
                    </dd>
                  </div>
                ))}
              </dl>
            )}
          </li>
        );
      })}
    </ol>
  );
}

function MandatePreview() {
  return (
    <figure
      aria-label="Example of an agent mandate"
      className={cn(PANEL, "p-5 sm:p-6")}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-neutral-100 dark:bg-white/[0.06]">
            <Bot className="h-4 w-4" aria-hidden="true" />
          </span>
          <div>
            <p className="font-medium">Groceries agent</p>
            <p className="text-xs text-neutral-500 dark:text-neutral-400">
              Only at one store, until the expiry date
            </p>
          </div>
        </div>
        <span className="rounded-full bg-success-100 px-2.5 py-1 text-xs font-medium text-success-800 dark:bg-success-500/15 dark:text-success-300">
          Active
        </span>
      </div>
      <div className="mt-5 space-y-4">
        {[
          { label: "This payment", cap: "$30 of the $50 cap", pct: 60 },
          { label: "Spent so far", cap: "$144 of $200", pct: 72 },
        ].map((b) => (
          <div key={b.label}>
            <div className="flex justify-between text-xs text-neutral-500 dark:text-neutral-400">
              <span>{b.label}</span>
              <span className="tabular-nums">{b.cap}</span>
            </div>
            <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-neutral-200 dark:bg-white/10">
              <div
                className="h-full rounded-full bg-brand-gradient"
                style={{ width: `${Math.max(b.pct, 4)}%` }}
              />
            </div>
          </div>
        ))}
      </div>
      <ul className="mt-5 space-y-2 text-sm">
        {[
          "Wrong merchant",
          "Above the per-payment cap",
          "Past the total cap",
          "After the owner revoked it",
        ].map((r) => (
          <li
            key={r}
            className="flex items-center justify-between rounded-lg border border-neutral-200 px-3 py-2 dark:border-white/[0.06]"
          >
            <span className="text-neutral-700 dark:text-neutral-300">{r}</span>
            <span className="font-mono text-[11px] text-danger-600 dark:text-danger-400">
              refused, audited
            </span>
          </li>
        ))}
      </ul>
      <figcaption className="mt-3 text-center text-[11px] text-neutral-500 dark:text-neutral-400">
        Illustration. Agent payments in the demo are simulated: an agent cannot
        click PayPal's approval window.
      </figcaption>
    </figure>
  );
}

type RoleSignIn = ReturnType<typeof useRoleSignIn>;

/** Signs a guest in as a sandbox role; a signed-in person is sent to the app instead. */
function RoleButton({
  role,
  account,
  className,
  children,
  variant,
}: {
  role: RoleSignIn;
  account: DemoAccount;
  className?: string;
  children: React.ReactNode;
  variant?: "default" | "outline";
}) {
  if (role.isAuthenticated) {
    return (
      <Button asChild variant={variant} className={className}>
        <Link to={role.homePath}>
          Open the app
          <ArrowRight className="ml-2 h-4 w-4" aria-hidden="true" />
        </Link>
      </Button>
    );
  }
  return (
    <Button
      variant={variant}
      className={className}
      isLoading={role.pending && role.pendingEmail === account.email}
      disabled={role.pending}
      onClick={() => role.signIn(account)}
    >
      {children}
    </Button>
  );
}

export default function TourPage() {
  const { isDark } = useTheme();
  const role = useRoleSignIn();
  const reviewer = demoAccounts.find((a) => a.role === "reviewer");

  return (
    <div className="min-h-screen bg-neutral-50 text-neutral-900 dark:bg-neutral-950 dark:text-neutral-100">
      <header className="sticky top-0 z-40 border-b border-neutral-200/70 bg-white/70 backdrop-blur-xl backdrop-saturate-150 dark:border-white/[0.06] dark:bg-neutral-950/60">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
          <Link to="/tour" className="flex items-center" aria-label="Sentrix">
            <img
              src={isDark ? "/logo_dark.png" : "/logo.png"}
              alt="Sentrix"
              className={cn(
                "w-auto object-contain",
                isDark ? "h-8" : "-my-5 h-[74px]",
              )}
            />
          </Link>
          <nav
            aria-label="Tour sections"
            className="hidden items-center gap-1 md:flex"
          >
            {NAV.map((n) => (
              <a
                key={n.href}
                href={n.href}
                className="rounded-lg px-3 py-2 text-sm text-neutral-600 transition-colors hover:bg-neutral-100 hover:text-neutral-900 dark:text-neutral-400 dark:hover:bg-white/[0.06] dark:hover:text-neutral-100"
              >
                {n.label}
              </a>
            ))}
          </nav>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Button asChild size="sm">
              <Link to={role.isAuthenticated ? role.homePath : "/login"}>
                {role.isAuthenticated ? "Open the app" : "Sign in"}
              </Link>
            </Button>
          </div>
        </div>
      </header>

      <main>
        {/* Hero */}
        <section
          aria-labelledby="hero-title"
          className="ambient-glow relative overflow-hidden bg-no-repeat"
        >
          <div
            aria-hidden="true"
            className="dot-grid pointer-events-none absolute inset-0 [mask-image:radial-gradient(ellipse_at_top,black_20%,transparent_70%)]"
          />
          <div className="relative mx-auto grid max-w-6xl items-center gap-12 px-4 pb-20 pt-14 sm:px-6 sm:pt-20 lg:grid-cols-[1.35fr_1fr] lg:gap-14">
            <div className="text-center lg:text-left">
              <span className="inline-flex items-center gap-2 rounded-full border border-neutral-200 bg-white/70 px-3 py-1 text-xs font-medium text-neutral-600 backdrop-blur dark:border-white/10 dark:bg-white/[0.04] dark:text-neutral-300">
                <span className="h-1.5 w-1.5 rounded-full bg-brand-gradient" />
                PayPal AI Hackathon 2026 entry, live on the PayPal sandbox
              </span>
              <h1
                id="hero-title"
                className="mt-6 text-balance text-4xl font-semibold leading-[1.04] tracking-[-0.03em] sm:text-5xl lg:text-[3.5rem]"
              >
                Every PayPal payment,{" "}
                <span className="text-gradient">
                  checked before the money moves.
                </span>
              </h1>
              <p className="mx-auto mt-6 max-w-xl text-pretty text-lg leading-relaxed text-neutral-600 lg:mx-0 dark:text-neutral-400">
                PayPal authorizes, Sentrix decides. Rules, a trained model and
                an AI analyst read each payment. Safe ones are captured,
                doubtful ones wait for a person, and AI agents can only spend
                inside the limits their owner set.
              </p>
              <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center lg:justify-start">
                {reviewer && (
                  <RoleButton
                    role={role}
                    account={reviewer}
                    className="h-11 w-full px-6 sm:w-auto"
                  >
                    Try it as the reviewer
                    <ArrowRight className="ml-2 h-4 w-4" aria-hidden="true" />
                  </RoleButton>
                )}
                <Button
                  asChild
                  variant="outline"
                  className="h-11 w-full px-6 sm:w-auto"
                >
                  <a href={VIDEO_URL} target="_blank" rel="noreferrer">
                    <PlayCircle className="mr-2 h-4 w-4" aria-hidden="true" />
                    Watch the 2-minute demo
                  </a>
                </Button>
              </div>
              <p className="mt-3 text-xs text-neutral-500 dark:text-neutral-400">
                No sign-up. Sandbox only: no real money moves.
              </p>
              <LiveStats />
            </div>
            <div className="mx-auto w-full max-w-md lg:max-w-none">
              <CasePreview />
            </div>
          </div>
        </section>

        {/* Problem */}
        <section
          aria-labelledby="problem"
          className="mx-auto max-w-6xl px-4 py-20 sm:px-6"
        >
          <SectionTitle
            id="problem"
            eyebrow="Why it exists"
            title="Fraud checks either say no without a reason, or hand the decision to a black box."
          />
          <div className="mt-12 grid gap-4 md:grid-cols-3">
            {PROBLEMS.map((p, i) => (
              <div key={p.title} className={cn(PANEL, "p-6")}>
                <span className="font-mono text-xs text-neutral-400 dark:text-neutral-500">
                  0{i + 1}
                </span>
                <h3 className="mt-3 font-semibold">{p.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-neutral-600 dark:text-neutral-400">
                  {p.body}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* How */}
        <section
          id="how"
          aria-labelledby="how-title"
          className="scroll-mt-20 border-y border-neutral-200/70 bg-white/50 py-20 dark:border-white/[0.05] dark:bg-white/[0.015]"
        >
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <SectionTitle
              id="how-title"
              eyebrow="How it works"
              title="Six steps between PayPal's authorization and the money moving"
              lead="PayPal holds the buyer's money without moving it. Sentrix runs its checks in that window, then makes the capture or void call itself. The counts under each step are live."
            />
            <PipelineFlow />
          </div>
        </section>

        {/* AI with limits */}
        <section
          id="ai"
          aria-labelledby="ai-title"
          className="mx-auto max-w-6xl scroll-mt-20 px-4 py-20 sm:px-6"
        >
          <SectionTitle
            id="ai-title"
            eyebrow="AI with limits"
            title="The AI sits next to the decision, not in it"
            lead="Gemini reads a facts-only summary of each case. It can explain and escalate. A rule or a person keeps the power to act, and every sentence it writes is checked against the facts before anyone sees it."
          />
          <div className="mt-12 grid gap-4 md:grid-cols-2">
            <div className={cn(PANEL, "p-6")}>
              <h3 className="flex items-center gap-2 font-semibold">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-success-100 text-success-700 dark:bg-success-500/15 dark:text-success-300">
                  <Check className="h-4 w-4" aria-hidden="true" />
                </span>
                The analyst may
              </h3>
              <ul className="mt-4 space-y-3">
                {AI_MAY.map((x) => (
                  <li
                    key={x}
                    className="flex gap-3 text-sm text-neutral-700 dark:text-neutral-300"
                  >
                    <Check
                      className="mt-0.5 h-4 w-4 shrink-0 text-success-600 dark:text-success-400"
                      aria-hidden="true"
                    />
                    {x}
                  </li>
                ))}
              </ul>
            </div>
            <div className={cn(PANEL, "p-6")}>
              <h3 className="flex items-center gap-2 font-semibold">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-danger-100 text-danger-700 dark:bg-danger-500/15 dark:text-danger-300">
                  <X className="h-4 w-4" aria-hidden="true" />
                </span>
                The analyst never
              </h3>
              <ul className="mt-4 space-y-3">
                {AI_NEVER.map((x) => (
                  <li
                    key={x}
                    className="flex gap-3 text-sm text-neutral-700 dark:text-neutral-300"
                  >
                    <X
                      className="mt-0.5 h-4 w-4 shrink-0 text-danger-600 dark:text-danger-400"
                      aria-hidden="true"
                    />
                    {x}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        {/* Agents */}
        <section
          id="agents"
          aria-labelledby="agents-title"
          className="scroll-mt-20 border-y border-neutral-200/70 bg-white/50 py-20 dark:border-white/[0.05] dark:bg-white/[0.015]"
        >
          <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 sm:px-6 lg:grid-cols-2">
            <div>
              <Eyebrow>Agentic commerce</Eyebrow>
              <h2
                id="agents-title"
                className="mt-3 text-balance text-3xl font-semibold tracking-tight sm:text-4xl"
              >
                An AI agent pays only inside a mandate
              </h2>
              <p className="mt-4 text-base leading-relaxed text-neutral-600 dark:text-neutral-400">
                The owner gives an agent a token with a merchant, a cap per
                payment, a total cap and an expiry, and can revoke it at any
                time. Anything outside it is refused before PayPal is reached
                and written to the audit log. Payments inside it still go
                through every check, so a new device or an odd amount still
                waits for a person.
              </p>
              <ul className="mt-6 grid gap-3 sm:grid-cols-2">
                {[
                  "The amount is reserved under a row lock",
                  "The owner gets a notice for every payment",
                  "The reviewer sees the mandate on the case",
                  "Revoking never touches a payment already made",
                ].map((x) => (
                  <li
                    key={x}
                    className="flex gap-2 text-sm text-neutral-700 dark:text-neutral-300"
                  >
                    <Check
                      className="mt-0.5 h-4 w-4 shrink-0 text-primary-600 dark:text-primary-400"
                      aria-hidden="true"
                    />
                    {x}
                  </li>
                ))}
              </ul>
            </div>
            <MandatePreview />
          </div>
        </section>

        {/* Try */}
        <section
          id="try"
          aria-labelledby="try-title"
          className="mx-auto max-w-6xl scroll-mt-20 px-4 py-20 sm:px-6"
        >
          <SectionTitle
            id="try-title"
            eyebrow="Try it"
            title="Three roles, one click each"
            lead="Sandbox accounts, reset for the demo. Each one opens the app with what that person would see first."
          />
          <div className="mt-12 grid gap-4 md:grid-cols-3">
            {demoAccounts.map((account) => (
              <div
                key={account.role}
                className={cn(PANEL, "flex flex-col p-6")}
              >
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-primary-700 dark:text-primary-300">
                  {account.label}
                </p>
                <p className="mt-2 text-sm leading-relaxed text-neutral-600 dark:text-neutral-400">
                  {account.description}
                </p>
                <ol className="mt-5 flex-1 space-y-2.5">
                  {(ROLE_STEPS[account.role] ?? []).map((s, i) => (
                    <li
                      key={s}
                      className="flex gap-3 text-sm text-neutral-700 dark:text-neutral-300"
                    >
                      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-neutral-100 font-mono text-[11px] text-neutral-600 dark:bg-white/[0.06] dark:text-neutral-300">
                        {i + 1}
                      </span>
                      {s}
                    </li>
                  ))}
                </ol>
                <RoleButton
                  role={role}
                  account={account}
                  variant={account.role === "reviewer" ? "default" : "outline"}
                  className="mt-6 w-full"
                >
                  Sign in as {account.label.toLowerCase()}
                  <ArrowRight className="ml-2 h-4 w-4" aria-hidden="true" />
                </RoleButton>
              </div>
            ))}
          </div>
        </section>

        {/* Judges */}
        <section
          id="judges"
          aria-labelledby="judges-title"
          className="scroll-mt-20 border-y border-neutral-200/70 bg-white/50 py-20 dark:border-white/[0.05] dark:bg-white/[0.015]"
        >
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <SectionTitle
              id="judges-title"
              eyebrow="For judges"
              title="Where each judging criterion shows"
            />
            <div
              className={cn(
                PANEL,
                "mt-12 divide-y divide-neutral-200 dark:divide-white/[0.06]",
              )}
            >
              {CRITERIA.map((c) => (
                <div
                  key={c.name}
                  className="grid gap-2 p-5 sm:grid-cols-[14rem_1fr_12rem] sm:items-baseline sm:gap-6 sm:p-6"
                >
                  <h3 className="font-semibold">{c.name}</h3>
                  <p className="text-sm leading-relaxed text-neutral-600 dark:text-neutral-400">
                    {c.where}
                  </p>
                  <p className="font-mono text-xs text-primary-700 sm:text-right dark:text-primary-300">
                    {c.look}
                  </p>
                </div>
              ))}
            </div>

            <div className="mt-16 grid gap-10 lg:grid-cols-[1fr_1.4fr]">
              <div>
                <Eyebrow>What changed since 1 October</Eyebrow>
                <h3 className="mt-3 text-2xl font-semibold tracking-tight">
                  An existing project, significantly updated
                </h3>
                <p className="mt-3 text-sm leading-relaxed text-neutral-600 dark:text-neutral-400">
                  Sentrix grew out of a transaction risk-scoring app built
                  before the hackathon. On 1 October its backend had no PayPal
                  code. Everything on the right was built during the submission
                  period, one pull request at a time, each with tests and a live
                  check. The pull requests are public.
                </p>
                <Button asChild variant="outline" className="mt-5">
                  <a
                    href={`${REPO_URL}/pulls?q=is%3Apr+is%3Amerged`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <Github className="mr-2 h-4 w-4" aria-hidden="true" />
                    Merged pull requests
                    <ExternalLink
                      className="ml-2 h-3.5 w-3.5"
                      aria-hidden="true"
                    />
                  </a>
                </Button>
              </div>
              <dl
                className={cn(
                  PANEL,
                  "divide-y divide-neutral-200 dark:divide-white/[0.06]",
                )}
              >
                {CHANGES.map((c) => (
                  <div
                    key={c.area}
                    className="grid gap-1 px-5 py-4 sm:grid-cols-[9rem_1fr] sm:gap-4"
                  >
                    <dt className="text-sm font-medium">{c.area}</dt>
                    <dd className="text-sm leading-relaxed text-neutral-600 dark:text-neutral-400">
                      {c.what}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
          </div>
        </section>

        {/* Built with + closing */}
        <section className="mx-auto max-w-6xl px-4 py-20 text-center sm:px-6">
          <Eyebrow>Built with</Eyebrow>
          <ul className="mx-auto mt-5 flex max-w-3xl flex-wrap justify-center gap-2">
            {STACK.map((s) => (
              <li
                key={s}
                className="rounded-full border border-neutral-200 bg-white px-3 py-1 text-sm text-neutral-700 dark:border-white/10 dark:bg-white/[0.03] dark:text-neutral-300"
              >
                {s}
              </li>
            ))}
          </ul>
          <div
            className={cn(
              PANEL,
              "relative mx-auto mt-16 max-w-3xl overflow-hidden p-8 sm:p-12",
            )}
          >
            <div className="absolute inset-x-0 top-0 h-px bg-brand-gradient" />
            <h2 className="text-balance text-2xl font-semibold tracking-tight sm:text-3xl">
              See one payment go from PayPal to a decision
            </h2>
            <p className="mx-auto mt-3 max-w-lg text-sm leading-relaxed text-neutral-600 dark:text-neutral-400">
              Sign in as the reviewer, open the first held payment and ask the
              analyst why it was held. Then capture it at PayPal.
            </p>
            <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
              {reviewer && (
                <RoleButton
                  role={role}
                  account={reviewer}
                  className="h-11 px-6"
                >
                  Try it as the reviewer
                  <ArrowRight className="ml-2 h-4 w-4" aria-hidden="true" />
                </RoleButton>
              )}
              <Button asChild variant="outline" className="h-11 px-6">
                <a href={REPO_URL} target="_blank" rel="noreferrer">
                  <Github className="mr-2 h-4 w-4" aria-hidden="true" />
                  Source on GitHub
                </a>
              </Button>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-neutral-200/70 py-8 dark:border-white/[0.06]">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-4 text-xs text-neutral-500 sm:flex-row sm:px-6 dark:text-neutral-400">
          <p>Sentrix. PayPal sandbox only: no real money moves.</p>
          <div className="flex gap-4">
            <a
              className="hover:text-neutral-900 dark:hover:text-neutral-100"
              href={VIDEO_URL}
              target="_blank"
              rel="noreferrer"
            >
              Demo video
            </a>
            <a
              className="hover:text-neutral-900 dark:hover:text-neutral-100"
              href={REPO_URL}
              target="_blank"
              rel="noreferrer"
            >
              GitHub
            </a>
            <Link
              className="hover:text-neutral-900 dark:hover:text-neutral-100"
              to="/login"
            >
              Sign in
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
