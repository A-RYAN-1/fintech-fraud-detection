import { Link, useLocation } from "react-router-dom";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/utils";
import {
  navigationFor,
  accountNavigationFor,
  homePathFor,
  type NavItem,
} from "@/config";
import { useAuth } from "@/features/auth/hooks";
import { useTheme } from "@/hooks";
import { useAppDispatch, useAppSelector } from "@/store";
import { toggleSidebarCollapsed } from "@/store/slices/uiSlice";
import {
  Button,
  ScrollArea,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui";

function NavItemComponent({
  item,
  collapsed,
}: {
  item: NavItem;
  collapsed: boolean;
}) {
  const location = useLocation();
  const isActive =
    location.pathname === item.href ||
    location.pathname.startsWith(item.href + "/");
  const Icon = item.icon;

  const linkContent = (
    <Link
      to={item.href}
      className={cn(
        "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all",
        "hover:bg-neutral-100 dark:hover:bg-neutral-800",
        isActive
          ? "bg-primary-50 text-primary-700 dark:bg-primary-950 dark:text-primary-300"
          : "text-neutral-600 dark:text-neutral-400",
        collapsed && "justify-center px-2",
      )}
    >
      <Icon
        className={cn(
          "h-5 w-5 shrink-0",
          isActive && "text-primary-600 dark:text-primary-400",
        )}
      />
      {!collapsed && <span className="truncate">{item.title}</span>}
      {!collapsed && item.badge && (
        <span className="ml-auto rounded-full bg-primary-100 px-2 py-0.5 text-xs font-medium text-primary-700 dark:bg-primary-900 dark:text-primary-300">
          {item.badge}
        </span>
      )}
    </Link>
  );

  if (collapsed) {
    return (
      <Tooltip delayDuration={0}>
        <TooltipTrigger asChild>{linkContent}</TooltipTrigger>
        <TooltipContent side="right">
          <p>{item.title}</p>
        </TooltipContent>
      </Tooltip>
    );
  }

  return linkContent;
}

export default function Sidebar() {
  const { user } = useAuth();
  const { isDark } = useTheme();
  const dispatch = useAppDispatch();
  const collapsed = useAppSelector((state) => state.ui.sidebarCollapsed);

  const filteredNavigation = navigationFor(user?.role);
  const accountNavigation = accountNavigationFor(user?.role);
  const homePath = homePathFor(user?.role);

  return (
    <aside
      className={cn(
        "fixed left-0 top-0 z-40 h-screen border-r border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900 transition-all duration-300",
        collapsed ? "w-16" : "w-64",
      )}
    >
      <div className="flex h-full flex-col">
        {/* Logo */}
        <div
          className={cn(
            "flex h-16 items-center border-b border-neutral-200 dark:border-neutral-800 px-8 py-8",
            collapsed && "justify-center px-2",
          )}
        >
          <Link
            to={homePath}
            className="flex items-center justify-center w-full"
          >
            {collapsed ? (
              <img
                src={isDark ? "/logo_s_dark.png" : "/logo_s.png"}
                alt="Sentrix"
                className="h-20 rounded-lg object-contain"
              />
            ) : (
              <img
                src={isDark ? "/logo_dark.png" : "/logo.png"}
                alt="Sentrix"
                className="h-30 rounded-lg object-contain"
              />
            )}
          </Link>
        </div>

        {/* Navigation */}
        <ScrollArea className="flex-1 px-3 py-4">
          <nav aria-label="Main" className="space-y-6">
            {filteredNavigation.map((section, index) => (
              <div key={index}>
                {section.title && !collapsed && (
                  <h3 className="mb-2 px-3 text-xs font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
                    {section.title}
                  </h3>
                )}
                <div className="space-y-1">
                  {section.items.map((item) => (
                    <NavItemComponent
                      key={item.href}
                      item={item}
                      collapsed={collapsed}
                    />
                  ))}
                </div>
              </div>
            ))}
          </nav>
        </ScrollArea>

        {/* Shared group: the same for every role */}
        <nav
          aria-label="Account"
          className="space-y-1 border-t border-neutral-200 px-3 py-3 dark:border-neutral-800"
        >
          {accountNavigation.map((item) => (
            <NavItemComponent key={item.href} item={item} collapsed={collapsed} />
          ))}
        </nav>

        {/* Collapse Toggle */}
        <div className="border-t border-neutral-200 dark:border-neutral-800 p-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => dispatch(toggleSidebarCollapsed())}
            className={cn("w-full", collapsed && "px-2")}
          >
            {collapsed ? (
              <ChevronRight className="h-4 w-4" />
            ) : (
              <>
                <ChevronLeft className="h-4 w-4 mr-2" />
                Collapse
              </>
            )}
          </Button>
        </div>
      </div>
    </aside>
  );
}
