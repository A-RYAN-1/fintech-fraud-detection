import {
  LayoutDashboard,
  Shield,
  CreditCard,
  ClipboardCheck,
  ShieldCheck,
  Scale,
  Users,
  FileText,
  Settings,
  HelpCircle,
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

export const navigationConfig: NavSection[] = [
  {
    items: [
      {
        title: "Dashboard",
        href: "/dashboard",
        icon: LayoutDashboard,
      },
      {
        title: "Payments",
        href: "/payments",
        icon: CreditCard,
      },
      {
        title: "Review Queue",
        href: "/admin/review",
        icon: ClipboardCheck,
        roles: ["admin", "reviewer", "analyst"],
      },
      {
        title: "Approvals",
        href: "/admin/approvals",
        icon: ShieldCheck,
        roles: ["admin", "reviewer", "analyst"],
      },
      {
        title: "Feedback",
        href: "/admin/feedback",
        icon: Scale,
        roles: ["admin", "reviewer", "analyst"],
      },
      {
        title: "Risk Analysis",
        href: "/risk-analysis",
        icon: Shield,
      },
    ],
  },
  {
    title: "Administration",
    items: [
      {
        title: "Users",
        href: "/admin/users",
        icon: Users,
        roles: ["admin"],
      },
      {
        title: "Audit Logs",
        href: "/admin/audit-logs",
        icon: FileText,
        roles: ["admin"],
      },
    ],
  },
  {
    title: "Settings",
    items: [
      {
        title: "Preferences",
        href: "/settings",
        icon: Settings,
      },
      {
        title: "Help & Support",
        href: "/help",
        icon: HelpCircle,
      },
    ],
  },
];

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
