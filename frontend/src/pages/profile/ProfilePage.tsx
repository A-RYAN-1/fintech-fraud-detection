import { useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { PageHeader, PageTransition } from "@/components/common";
import {
  Alert,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
  Label,
  Skeleton,
} from "@/components/ui";
import { authApi, useAuth } from "@/features/auth";
import { useAppDispatch } from "@/store";
import { setUser } from "@/store/slices/authSlice";
import { getErrorMessage, type User } from "@/types";
import { formatDateTime } from "@/utils";
import { formatMoney } from "@/utils/money";

function limitText(user: User): string {
  if (user.role === "admin") return "No limit";
  if (user.role === "reviewer" && user.decision_limit != null)
    return formatMoney(user.decision_limit);
  if (user.role === "analyst") return "Analysts advise; they do not decide";
  return "Customers do not decide payments";
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
        {label}
      </dt>
      <dd className="mt-1 text-sm text-neutral-900 dark:text-neutral-100">
        {value}
      </dd>
    </div>
  );
}

function NameForm({ user, locked }: { user: User; locked: boolean }) {
  const dispatch = useAppDispatch();
  const [firstName, setFirstName] = useState(user.first_name);
  const [lastName, setLastName] = useState(user.last_name);
  const save = useMutation({
    mutationFn: () =>
      authApi.updateProfile({ first_name: firstName, last_name: lastName }),
    onSuccess: (updated) => {
      dispatch(setUser(updated));
      toast.success("Name saved");
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  const unchanged =
    firstName.trim() === user.first_name && lastName.trim() === user.last_name;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    save.mutate();
  };

  return (
    <form onSubmit={submit} aria-label="Your name">
      <fieldset disabled={locked || save.isPending} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="first_name">First name</Label>
            <Input
              id="first_name"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="last_name">Last name</Label>
            <Input
              id="last_name"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              required
            />
          </div>
        </div>
        <Button type="submit" disabled={unchanged}>
          {save.isPending ? "Saving..." : "Save name"}
        </Button>
      </fieldset>
    </form>
  );
}

function PasswordForm({ locked }: { locked: boolean }) {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const mismatch = confirm.length > 0 && next !== confirm;
  const change = useMutation({
    mutationFn: () =>
      authApi.changePassword({
        current_password: current,
        password: next,
        password_confirmation: confirm,
      }),
    onSuccess: () => {
      setCurrent("");
      setNext("");
      setConfirm("");
      toast.success("Password changed");
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    change.mutate();
  };

  return (
    <form onSubmit={submit} aria-label="Change password">
      <fieldset disabled={locked || change.isPending} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="current_password">Current password</Label>
          <Input
            id="current_password"
            type="password"
            autoComplete="current-password"
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
            required
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="new_password">New password</Label>
            <Input
              id="new_password"
              type="password"
              autoComplete="new-password"
              minLength={8}
              value={next}
              onChange={(e) => setNext(e.target.value)}
              required
            />
            <p className="text-xs text-neutral-500 dark:text-neutral-400">
              At least 8 characters.
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirm_password">Repeat new password</Label>
            <Input
              id="confirm_password"
              type="password"
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              aria-invalid={mismatch}
              aria-describedby={mismatch ? "confirm_hint" : undefined}
              required
            />
            {mismatch && (
              <p
                id="confirm_hint"
                className="text-xs text-danger-600 dark:text-danger-400"
              >
                The two new passwords differ.
              </p>
            )}
          </div>
        </div>
        <Button type="submit" disabled={mismatch || next.length < 8}>
          {change.isPending ? "Changing..." : "Change password"}
        </Button>
      </fieldset>
    </form>
  );
}

function RecentActivity() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["auth", "activity"],
    queryFn: authApi.getActivity,
  });

  if (isLoading) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-5 w-full" />
        <Skeleton className="h-5 w-4/5" />
        <Skeleton className="h-5 w-3/5" />
      </div>
    );
  }
  if (isError) {
    return (
      <p className="text-sm text-danger-600 dark:text-danger-400">
        Your activity could not be loaded. Reload the page to try again.
      </p>
    );
  }
  if (!data || data.length === 0) {
    return (
      <p className="text-sm text-neutral-500 dark:text-neutral-400">
        Nothing yet. Decisions, notes, requests and account changes you make
        show up here.
      </p>
    );
  }
  return (
    <ol className="divide-y divide-neutral-200 dark:divide-neutral-800">
      {data.map((entry) => (
        <li
          key={entry.id}
          className="flex flex-col gap-1 py-2 sm:flex-row sm:justify-between sm:gap-4"
        >
          <span className="text-sm text-neutral-800 dark:text-neutral-200">
            {entry.description}
          </span>
          <time
            dateTime={entry.created_at}
            className="shrink-0 text-xs text-neutral-500 dark:text-neutral-400"
          >
            {formatDateTime(entry.created_at)}
          </time>
        </li>
      ))}
    </ol>
  );
}

export default function ProfilePage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  if (!user) return null;

  const locked = Boolean(user.demo_account);

  return (
    <PageTransition>
      <div className="mx-auto max-w-4xl space-y-6">
        <PageHeader
          title="Profile"
          description="Your account, your decision limit and what you did lately."
        />

        {locked && (
          <Alert variant="info" title="Shared demo account">
            Everyone who tries Sentrix signs in with this account, so its name
            and password cannot be changed. Register your own account to try
            these forms.
          </Alert>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Account</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <Field
                label="Name"
                value={`${user.first_name} ${user.last_name}`}
              />
              <Field label="Email" value={user.email} />
              <Field
                label="Role"
                value={user.role.charAt(0).toUpperCase() + user.role.slice(1)}
              />
              <Field label="Decision limit" value={limitText(user)} />
              {user.created_at && (
                <Field
                  label="Member since"
                  value={formatDateTime(user.created_at)}
                />
              )}
            </dl>
          </CardContent>
        </Card>

        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Your name</CardTitle>
              <CardDescription>
                Shown to staff on your payments and in the audit log.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <NameForm
                key={`${user.first_name} ${user.last_name}`}
                user={user}
                locked={locked}
              />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Password</CardTitle>
              <CardDescription>
                The current password is checked before the change.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <PasswordForm locked={locked} />
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle>Your recent activity</CardTitle>
              <CardDescription>
                The last 10 entries in the audit log made by you.
              </CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                queryClient.invalidateQueries({
                  queryKey: ["auth", "activity"],
                })
              }
            >
              Refresh
            </Button>
          </CardHeader>
          <CardContent>
            <RecentActivity />
          </CardContent>
        </Card>
      </div>
    </PageTransition>
  );
}
