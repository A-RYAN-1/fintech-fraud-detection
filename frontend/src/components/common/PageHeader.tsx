import type { ReactNode } from "react";

interface PageHeaderProps {
  title: string;
  description?: string;
  actions?: ReactNode;
}

/** The one header style every page in the app shell uses. */
export default function PageHeader({
  title,
  description,
  actions,
}: PageHeaderProps) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-neutral-900 sm:text-[1.75rem] dark:text-neutral-50">
          {title}
        </h1>
        {description && (
          <p className="mt-1.5 max-w-2xl text-[15px] leading-relaxed text-neutral-600 dark:text-neutral-400">
            {description}
          </p>
        )}
      </div>
      {actions && <div className="flex shrink-0 gap-2">{actions}</div>}
    </div>
  );
}
