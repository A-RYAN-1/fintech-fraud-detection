import { Menu } from "lucide-react";
import { useAppDispatch } from "@/store";
import { setSidebarOpen } from "@/store/slices/uiSlice";
import { Button } from "@/components/ui";
import Breadcrumbs from "@/components/common/Breadcrumbs";
import ThemeToggle from "@/components/common/ThemeToggle";
import UserMenu from "@/components/common/UserMenu";
import { NotificationCenter } from "@/features/notifications";

export default function Header() {
  const dispatch = useAppDispatch();

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-neutral-200/80 bg-white/70 px-4 backdrop-blur-xl backdrop-saturate-150 dark:border-white/[0.06] dark:bg-neutral-950/60">
      <div className="flex min-w-0 items-center gap-4">
        {/* Mobile menu button */}
        <Button
          variant="ghost"
          size="icon"
          className="lg:hidden"
          onClick={() => dispatch(setSidebarOpen(true))}
        >
          <Menu className="h-5 w-5" />
          <span className="sr-only">Open menu</span>
        </Button>

        {/* Breadcrumbs */}
        <div className="hidden min-w-0 sm:block">
          <Breadcrumbs />
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        {/* Notifications */}
        <NotificationCenter />

        {/* Theme Toggle */}
        <ThemeToggle />

        {/* User Menu */}
        <UserMenu />
      </div>
    </header>
  );
}
