import { useMemo, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery } from "@tanstack/react-query";
import { ArrowRight, ExternalLink, RefreshCw, Search } from "lucide-react";
import { toast } from "sonner";
import { PageHeader, PageTransition } from "@/components/common";
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
  Label,
  Skeleton,
  Textarea,
} from "@/components/ui";
import { roleGuides } from "@/config";
import { useAuth } from "@/features/auth/hooks";
import { faqFor, helpApi, type SupportTopic } from "@/features/help";
import { getErrorMessage, type UserRole } from "@/types";
import { cn, formatDateTime } from "@/utils";

const ISSUES_URL = "https://github.com/A-RYAN-1/fintech-fraud-detection/issues";

const STAFF: UserRole[] = ["analyst", "reviewer", "admin"];

const TOPICS: { value: SupportTopic; label: string }[] = [
  { value: "payment", label: "A payment" },
  { value: "review", label: "A review or approval" },
  { value: "account", label: "My account" },
  { value: "other", label: "Something else" },
];

type Tone = "ok" | "warn" | "down" | "loading";

function StatusRow({
  label,
  tone,
  text,
}: {
  label: string;
  tone: Tone;
  text: string;
}) {
  return (
    <div className="flex items-start justify-between gap-4 py-2">
      <dt className="text-sm text-neutral-700 dark:text-neutral-300">
        {label}
      </dt>
      <dd className="flex items-center gap-2 text-right text-sm">
        <span
          aria-hidden="true"
          className={cn(
            "h-2 w-2 shrink-0 rounded-full",
            tone === "ok" && "bg-success-500",
            tone === "warn" && "bg-warning-500",
            tone === "down" && "bg-danger-500",
            tone === "loading" && "bg-neutral-300 dark:bg-neutral-600",
          )}
        />
        <span className="text-neutral-900 dark:text-neutral-100">{text}</span>
      </dd>
    </div>
  );
}

function LiveStatus({ staff }: { staff: boolean }) {
  const health = useQuery({
    queryKey: ["help", "health"],
    queryFn: helpApi.health,
    retry: false,
  });
  const analyst = useQuery({
    queryKey: ["help", "analyst"],
    queryFn: helpApi.analystStatus,
    enabled: staff,
    retry: false,
  });

  const apiTone: Tone = health.isLoading
    ? "loading"
    : health.data?.status === "ok"
      ? "ok"
      : "down";
  const dbTone: Tone = health.isLoading
    ? "loading"
    : health.data?.database === "connected"
      ? "ok"
      : "down";

  let analystTone: Tone = "loading";
  let analystText = "Checking...";
  if (analyst.isError) {
    analystTone = "down";
    analystText = "Status could not be read";
  } else if (analyst.data) {
    const a = analyst.data;
    if (!a.enabled) {
      analystTone = "warn";
      analystText = "Switched off; the rules and the model decide alone";
    } else if (a.state === "open") {
      analystTone = "warn";
      analystText = `Paused after failures, retries in ${Math.ceil(a.retry_in_seconds)} s`;
    } else {
      analystTone = "ok";
      analystText = `On (${a.model})`;
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between space-y-0">
        <div>
          <CardTitle>Live status</CardTitle>
          <CardDescription>
            {health.data
              ? `Read from the API at ${formatDateTime(health.data.timestamp)}.`
              : "Read from the API when this page opens."}
          </CardDescription>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            health.refetch();
            if (staff) analyst.refetch();
          }}
          disabled={health.isFetching}
        >
          <RefreshCw
            aria-hidden="true"
            className={cn("mr-2 h-4 w-4", health.isFetching && "animate-spin")}
          />
          Check again
        </Button>
      </CardHeader>
      <CardContent>
        <dl className="divide-y divide-neutral-200 dark:divide-neutral-800">
          <StatusRow
            label="API"
            tone={apiTone}
            text={
              apiTone === "loading"
                ? "Checking... (a sleeping free instance can take a minute)"
                : apiTone === "ok"
                  ? "Up"
                  : "Not reachable"
            }
          />
          <StatusRow
            label="Database"
            tone={dbTone}
            text={
              dbTone === "loading"
                ? "Checking..."
                : dbTone === "ok"
                  ? "Connected"
                  : "Not connected"
            }
          />
          {staff && (
            <StatusRow
              label="AI analyst"
              tone={analystTone}
              text={analystText}
            />
          )}
        </dl>
      </CardContent>
    </Card>
  );
}

function SupportForm() {
  const [topic, setTopic] = useState<SupportTopic>("payment");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [sentTo, setSentTo] = useState<number | null>(null);

  const send = useMutation({
    mutationFn: () => helpApi.sendSupportMessage({ topic, subject, message }),
    onSuccess: ({ delivered_to }) => {
      setSentTo(delivered_to);
      setSubject("");
      setMessage("");
      toast.success("Message sent to the admins");
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setSentTo(null);
    send.mutate();
  };

  return (
    <form
      onSubmit={submit}
      aria-label="Message the admins"
      className="space-y-4"
    >
      <fieldset disabled={send.isPending} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="support_topic">About</Label>
          <select
            id="support_topic"
            value={topic}
            onChange={(e) => setTopic(e.target.value as SupportTopic)}
            className="flex h-10 w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
          >
            {TOPICS.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="support_subject">Subject</Label>
          <Input
            id="support_subject"
            value={subject}
            maxLength={120}
            onChange={(e) => setSubject(e.target.value)}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="support_message">Message</Label>
          <Textarea
            id="support_message"
            value={message}
            maxLength={800}
            rows={5}
            onChange={(e) => setMessage(e.target.value)}
            aria-describedby="support_count"
            required
          />
          <p
            id="support_count"
            className="text-xs text-neutral-500 dark:text-neutral-400"
          >
            {message.length} of 800 characters. Up to 5 messages an hour.
          </p>
        </div>
        <Button type="submit" disabled={!subject.trim() || !message.trim()}>
          {send.isPending ? "Sending..." : "Send to the admins"}
        </Button>
      </fieldset>
      {sentTo !== null && (
        <p
          role="status"
          className="text-sm text-success-700 dark:text-success-400"
        >
          Sent. {sentTo === 1 ? "1 admin" : `${sentTo} admins`} will see it in
          their notifications.
        </p>
      )}
    </form>
  );
}

export default function HelpSupportPage() {
  const { user } = useAuth();
  const [query, setQuery] = useState("");
  const role = user?.role;
  const staff = Boolean(role && STAFF.includes(role));
  const guide = role ? roleGuides[role] : undefined;

  const faq = useMemo(() => {
    const q = query.trim().toLowerCase();
    return faqFor(role).filter(
      (entry) =>
        !q ||
        entry.question.toLowerCase().includes(q) ||
        entry.answer.toLowerCase().includes(q),
    );
  }, [role, query]);

  return (
    <PageTransition>
      <div className="mx-auto max-w-6xl space-y-6">
        <PageHeader
          title="Help"
          description="How Sentrix decides a PayPal payment, what your role can do, the live state of the service, and how to reach the admins."
        />

        <div className="grid gap-6 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-2">
            {guide && (
              <Card>
                <CardHeader>
                  <CardTitle>Your role: {guide.label}</CardTitle>
                  <CardDescription>{guide.summary}</CardDescription>
                </CardHeader>
                <CardContent>
                  <ul className="divide-y divide-neutral-200 dark:divide-neutral-800">
                    {guide.tasks.map((task) => (
                      <li key={task.href} className="py-3">
                        <Link
                          to={task.href}
                          className="group inline-flex items-center gap-1 font-medium text-primary-700 hover:underline dark:text-primary-300"
                        >
                          {task.title}
                          <ArrowRight
                            aria-hidden="true"
                            className="h-4 w-4 transition-transform group-hover:translate-x-0.5"
                          />
                        </Link>
                        <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
                          {task.body}
                        </p>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader>
                <CardTitle>Questions</CardTitle>
                <CardDescription>
                  Answers written from how the app works. Amounts are the
                  defaults; an admin can change the rules.
                </CardDescription>
                <div className="relative pt-2">
                  <Search
                    aria-hidden="true"
                    className="absolute left-3 top-1/2 mt-1 h-4 w-4 -translate-y-1/2 text-neutral-400"
                  />
                  <Input
                    aria-label="Search the questions"
                    placeholder="Search the questions"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    className="pl-9"
                  />
                </div>
              </CardHeader>
              <CardContent>
                {faq.length === 0 ? (
                  <p className="text-sm text-neutral-500 dark:text-neutral-400">
                    No question matches "{query}". Try another word, or send the
                    admins a message.
                  </p>
                ) : (
                  <div className="divide-y divide-neutral-200 dark:divide-neutral-800">
                    {faq.map((entry) => (
                      <details key={entry.question} className="group py-3">
                        <summary className="cursor-pointer list-none font-medium text-neutral-900 marker:hidden focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 dark:text-neutral-100">
                          <span className="flex items-center justify-between gap-4">
                            {entry.question}
                            <span
                              aria-hidden="true"
                              className="text-neutral-400 transition-transform group-open:rotate-90"
                            >
                              <ArrowRight className="h-4 w-4" />
                            </span>
                          </span>
                        </summary>
                        <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">
                          {entry.answer}
                        </p>
                      </details>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6">
            <LiveStatus staff={staff} />

            <Card>
              <CardHeader>
                <CardTitle>Message the admins</CardTitle>
                <CardDescription>
                  Every admin gets your message in their notifications, with
                  your name and email so they can reply.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <SupportForm />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Found a bug?</CardTitle>
                <CardDescription>
                  The code is public on GitHub. Report a problem with the
                  project itself there.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button asChild variant="outline">
                  <a href={ISSUES_URL} target="_blank" rel="noreferrer">
                    Open an issue on GitHub
                    <ExternalLink aria-hidden="true" className="ml-2 h-4 w-4" />
                  </a>
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>

        {!guide && <Skeleton className="h-40 w-full" />}
      </div>
    </PageTransition>
  );
}
