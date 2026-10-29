import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { PageHeader, PageTransition } from "@/components/common";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui";
import { roleGuides } from "@/config";
import { useAuth } from "@/features/auth/hooks";

export default function HomePage() {
  const { user } = useAuth();
  if (!user) return null;

  const guide = roleGuides[user.role];

  return (
    <PageTransition>
      <div className="mx-auto max-w-6xl space-y-6">
        <PageHeader
          title={`Welcome, ${user.first_name}`}
          description={guide.summary}
        />

        <section aria-labelledby="role-tasks" className="space-y-3">
          <h2
            id="role-tasks"
            className="text-lg font-semibold text-neutral-900 dark:text-neutral-100"
          >
            What you can do as {guide.label.toLowerCase()}
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {guide.tasks.map((task) => (
              <Link
                key={task.href}
                to={task.href}
                className="group rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-neutral-900"
              >
                <Card className="h-full transition-colors group-hover:border-primary-300 dark:group-hover:border-primary-700">
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between text-base">
                      {task.title}
                      <ArrowRight
                        aria-hidden="true"
                        className="h-4 w-4 text-neutral-400 transition-transform group-hover:translate-x-0.5"
                      />
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <CardDescription>{task.body}</CardDescription>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </section>
      </div>
    </PageTransition>
  );
}
