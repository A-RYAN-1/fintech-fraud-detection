import {
  Home,
  History,
  HelpCircle,
  LayoutDashboard,
  Shield,
  CreditCard,
  ClipboardCheck,
  ShieldCheck,
  Scale,
  Users,
  FileText,
  type LucideIcon,
} from "lucide-react";
import type { UserRole } from "@/types";

export interface NavItem {
  title: string;
  href: string;
  icon: LucideIcon;
  badge?: string;
  roles?: UserRole[];
  children?: NavItem[];
}

export interface NavSection {
  title?: string;
  items: NavItem[];
}

const ITEMS = {
  home: { title: "Home", href: "/home", icon: Home },
  pay: { title: "Pay", href: "/pay", icon: CreditCard },
  history: { title: "History", href: "/history", icon: History },
  spending: {
    title: "My Spending",
    href: "/dashboard",
    icon: LayoutDashboard,
  },
  review: {
    title: "Review Queue",
    href: "/admin/review",
    icon: ClipboardCheck,
  },
  approvals: {
    title: "Approvals",
    href: "/admin/approvals",
    icon: ShieldCheck,
  },
  feedback: { title: "Feedback", href: "/admin/feedback", icon: Scale },
  dashboard: {
    title: "Dashboard",
    href: "/dashboard",
    icon: LayoutDashboard,
  },
  risk: { title: "Risk Analysis", href: "/risk-analysis", icon: Shield },
  users: { title: "Users", href: "/admin/users", icon: Users },
  audit: { title: "Audit Log", href: "/admin/audit-logs", icon: FileText },
  help: { title: "Help", href: "/help", icon: HelpCircle },
} satisfies Record<string, NavItem>;

/** Every role lands on Home after login and when a hidden URL is refused. */
export function homePathFor(role: UserRole | undefined): string {
  return role ? "/home" : "/login";
}

/** The work group of the sidebar, in the order each role uses it. */
export function navigationFor(role: UserRole | undefined): NavSection[] {
  switch (role) {
    case "customer":
      return [{ items: [ITEMS.home, ITEMS.pay, ITEMS.history, ITEMS.spending] }];
    case "analyst":
      return [
        {
          items: [
            ITEMS.home,
            ITEMS.review,
            ITEMS.feedback,
            ITEMS.dashboard,
            ITEMS.risk,
          ],
        },
      ];
    case "reviewer":
      return [
        {
          items: [
            ITEMS.home,
            ITEMS.review,
            ITEMS.approvals,
            ITEMS.feedback,
            ITEMS.dashboard,
            ITEMS.risk,
          ],
        },
      ];
    case "admin":
      return [
        {
          items: [
            ITEMS.home,
            ITEMS.review,
            ITEMS.approvals,
            ITEMS.feedback,
            ITEMS.dashboard,
            ITEMS.risk,
          ],
        },
        { title: "Administration", items: [ITEMS.users, ITEMS.audit] },
      ];
    default:
      return [];
  }
}

/** The shared bottom group of the sidebar, the same for every role. */
export function accountNavigationFor(role: UserRole | undefined): NavItem[] {
  return role ? [ITEMS.help] : [];
}

export const breadcrumbNameMap: Record<string, string> = {
  "/home": "Home",
  "/pay": "Pay",
  "/history": "History",
  "/dashboard": "Dashboard",
  "/admin/review": "Review Queue",
  "/admin/approvals": "Approvals",
  "/admin/feedback": "Feedback",
  "/risk-analysis": "Risk Analysis",
  "/admin": "Administration",
  "/admin/users": "Users",
  "/admin/audit-logs": "Audit Log",
  "/help": "Help",
};

/** The name of a page for this role: the sidebar title first, then the shared map. */
export function pageTitleFor(
  path: string,
  role: UserRole | undefined,
): string | undefined {
  const items = [
    ...navigationFor(role).flatMap((section) => section.items),
    ...accountNavigationFor(role),
  ];
  return items.find((item) => item.href === path)?.title ?? breadcrumbNameMap[path];
}
