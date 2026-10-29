import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { AlertCircle, CheckCircle2, Info, XCircle } from 'lucide-react';
import { cn } from '@/utils';

const alertVariants = cva(
  'relative w-full rounded-lg border p-4 flex items-start gap-3 [&>svg]:shrink-0',
  {
    variants: {
      variant: {
        default: 'bg-neutral-50 border-neutral-200 text-neutral-900 dark:bg-neutral-900 dark:border-neutral-800 dark:text-neutral-100',
        info: 'bg-primary-50 border-primary-200 text-primary-900 dark:bg-primary-950/50 dark:border-primary-900 dark:text-primary-100',
        success: 'bg-success-50 border-success-200 text-success-900 dark:bg-success-950/50 dark:border-success-900 dark:text-success-100',
        warning: 'bg-warning-50 border-warning-200 text-warning-900 dark:bg-warning-950/50 dark:border-warning-900 dark:text-warning-100',
        destructive: 'bg-danger-50 border-danger-200 text-danger-900 dark:bg-danger-950/50 dark:border-danger-900 dark:text-danger-100',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
);

const iconMap = {
  default: Info,
  info: Info,
  success: CheckCircle2,
  warning: AlertCircle,
  destructive: XCircle,
};

interface AlertProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof alertVariants> {
  title?: string;
}

const Alert = React.forwardRef<HTMLDivElement, AlertProps>(
  ({ className, variant = 'default', title, children, ...props }, ref) => {
    const Icon = iconMap[variant || 'default'];

    return (
      <div ref={ref} role="alert" className={cn(alertVariants({ variant }), className)} {...props}>
        <Icon className="h-5 w-5" />
        <div className="flex-1">
          {title && <p className="font-medium mb-1">{title}</p>}
          <div className="text-sm opacity-90">{children}</div>
        </div>
      </div>
    );
  }
);
Alert.displayName = 'Alert';

export { Alert, alertVariants };