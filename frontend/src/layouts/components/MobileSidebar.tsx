import { useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { X } from "lucide-react";
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
import { setSidebarOpen } from "@/store/slices/uiSlice";
import { Button, ScrollArea } from "@/components/ui";

function NavItemComponent({
  item,
  onClose,
}: {
  item: NavItem;
  onClose: () => void;
}) {
  const location = useLocation();
  const isActive =
    location.pathname === item.href ||
    location.pathname.startsWith(item.href + "/");
  const Icon = item.icon;

  return (
    <Link
      to={item.href}
      onClick={onClose}
      className={cn(
        "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all",
        "hover:bg-neutral-100 dark:hover:bg-neutral-800",
        isActive
          ? "bg-primary-50 text-primary-700 dark:bg-primary-950 dark:text-primary-300"
          : "text-neutral-600 dark:text-neutral-400",
      )}
    >
      <Icon
        className={cn(
          "h-5 w-5 shrink-0",
          isActive && "text-primary-600 dark:text-primary-400",
        )}
      />
      <span>{item.title}</span>
      {item.badge && (
        <span className="ml-auto rounded-full bg-primary-100 px-2 py-0.5 text-xs font-medium text-primary-700 dark:bg-primary-900 dark:text-primary-300">
          {item.badge}
        </span>
      )}
    </Link>
  );
}

export default function MobileSidebar() {
  const { user } = useAuth();
  const { isDark } = useTheme();
  const dispatch = useAppDispatch();
  const isOpen = useAppSelector((state) => state.ui.sidebarOpen);
  const location = useLocation();

  // Close sidebar on route change
  useEffect(() => {
    dispatch(setSidebarOpen(false));
  }, [location.pathname, dispatch]);

  // Prevent body scroll when sidebar is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  const filteredNavigation = navigationFor(user?.role);
  const accountNavigation = accountNavigationFor(user?.role);
  const homePath = homePathFor(user?.role);

  const handleClose = () => dispatch(setSidebarOpen(false));

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-50 bg-black/50 lg:hidden"
        onClick={handleClose}
      />

      {/* Sidebar */}
      <aside className="fixed inset-y-0 left-0 z-50 w-72 bg-white dark:bg-neutral-900 lg:hidden animate-slide-up">
        <div className="flex h-full flex-col">
          {/* Header */}
          <div className="flex h-20 items-center justify-between border-b border-neutral-200 dark:border-neutral-800 px-6 py-6">
            <Link
              to={homePath}
              className="flex items-center justify-center gap-2 flex-1"
              onClick={handleClose}
            >
              <img
                src={isDark ? "/logo_dark.png" : "/logo.png"}
                alt="Sentrix"
                className="h-30 rounded-lg object-contain"
              />
            </Link>
            <Button variant="ghost" size="icon" onClick={handleClose}>
              <X className="h-5 w-5" />
            </Button>
          </div>

          {/* Navigation */}
          <ScrollArea className="flex-1 px-3 py-4">
            <nav aria-label="Main" className="space-y-6">
              {filteredNavigation.map((section, index) => (
                <div key={index}>
                  {section.title && (
                    <h3 className="mb-2 px-3 text-xs font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
                      {section.title}
                    </h3>
                  )}
                  <div className="space-y-1">
                    {section.items.map((item) => (
                      <NavItemComponent
                        key={item.href}
                        item={item}
                        onClose={handleClose}
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
              <NavItemComponent
                key={item.href}
                item={item}
                onClose={handleClose}
              />
            ))}
          </nav>
        </div>
      </aside>
    </>
  );
}
