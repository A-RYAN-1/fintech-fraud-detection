import {
  LayoutDashboard,
  ArrowLeftRight,
  Shield,
  CreditCard,
  ClipboardCheck,
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
        title: "Transactions",
        href: "/transactions",
        icon: ArrowLeftRight,
      },
      {
        title: "Checkout",
        href: "/checkout",
        icon: CreditCard,
      },
      {
        title: "Review Queue",
        href: "/admin/review",
        icon: ClipboardCheck,
        roles: ["admin", "manager"],
      },
      {
        title: "Risk Analysis",
        href: "/risk-analysis",
        icon: Shield,
      },
    ],
  },
  // {
  //   title: "Administration",
  //   items: [
  //     {
  //       title: "Users",
  //       href: "/admin/users",
  //       icon: Users,
  //       // roles: ["admin", "manager"],
  //     },
  //     {
  //       title: "Audit Logs",
  //       href: "/admin/audit-logs",
  //       icon: FileText,
  //       // roles: ["admin"],
  //     },
  //   ],
  // },
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
  "/transactions": "Transactions",
  "/transactions/new": "New Transaction",
  "/checkout": "Checkout",
  "/admin/review": "Review Queue",
  "/risk-analysis": "Risk Analysis",
  "/admin": "Administration",
  "/admin/users": "User Management",
  "/admin/audit-logs": "Audit Logs",
  "/settings": "Settings",
  "/help": "Help & Support",
};
