import {
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

const STAFF: UserRole[] = ["admin", "reviewer", "analyst"];

const ITEMS = {
  dashboard: {
    title: "Dashboard",
    href: "/dashboard",
    icon: LayoutDashboard,
  },
  payments: { title: "Payments", href: "/payments", icon: CreditCard },
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
  risk: { title: "Risk Analysis", href: "/risk-analysis", icon: Shield },
  users: { title: "Users", href: "/admin/users", icon: Users },
  audit: { title: "Audit Logs", href: "/admin/audit-logs", icon: FileText },
} satisfies Record<string, NavItem>;

/** Where each role lands after login and when a hidden URL is refused. */
export function homePathFor(role: UserRole | undefined): string {
  return role && STAFF.includes(role) ? "/admin/review" : "/payments";
}

/** Sidebar sections for a role. Help lives in the user menu, theme in the header. */
export function navigationFor(role: UserRole | undefined): NavSection[] {
  if (!role) return [];
  if (role === "customer") {
    return [{ items: [ITEMS.dashboard, ITEMS.payments] }];
  }
  const sections: NavSection[] = [
    {
      items: [
        ITEMS.review,
        ITEMS.approvals,
        ITEMS.feedback,
        ITEMS.dashboard,
        ITEMS.risk,
      ],
    },
  ];
  if (role === "admin") {
    sections.push({
      title: "Administration",
      items: [ITEMS.users, ITEMS.audit],
    });
  }
  return sections;
}

export const breadcrumbNameMap: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/payments": "Payments",
  "/payments/pay": "Pay",
  "/payments/history": "History",
  "/admin/review": "Review Queue",
  "/admin/approvals": "Approvals",
  "/admin/feedback": "Feedback",
  "/risk-analysis": "Risk Analysis",
  "/admin": "Administration",
  "/admin/users": "User Management",
  "/admin/audit-logs": "Audit Logs",
  "/settings": "Settings",
  "/help": "Help & Support",
};
