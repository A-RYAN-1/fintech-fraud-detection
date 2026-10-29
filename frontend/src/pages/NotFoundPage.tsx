import { Link } from "react-router-dom";
import { Home, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui";

export default function NotFoundPage() {
  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="text-center">
        <h1 className="text-9xl font-bold text-neutral-200 dark:text-neutral-800">
          404
        </h1>
        <h2 className="mt-4 text-2xl font-bold text-neutral-900 dark:text-neutral-100">
          Page not found
        </h2>
        <p className="mt-2 text-neutral-600 dark:text-neutral-400">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6 flex items-center justify-center gap-3">
          <Button variant="outline" onClick={() => window.history.back()}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Go back
          </Button>
          <Button asChild>
            <Link to="/home">
              <Home className="h-4 w-4 mr-2" />
              Home
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
