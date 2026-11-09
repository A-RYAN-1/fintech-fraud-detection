import { Outlet } from "react-router-dom";
import { useAppSelector } from "@/store";
import { useGlobalShortcuts } from "@/hooks";
import { useNotificationPolling } from "@/features/notifications";
import { SkipLink } from "@/components/common";
import { cn } from "@/utils";
import { Sidebar, Header, MobileSidebar } from "./components";

export default function MainLayout() {
  const sidebarCollapsed = useAppSelector((state) => state.ui.sidebarCollapsed);

  // Register global keyboard shortcuts
  useGlobalShortcuts();

  // Enable notification polling
  useNotificationPolling(true);

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-950">
      {/* Skip Link for Accessibility */}
      <SkipLink />

      {/* Desktop Sidebar */}
      <div className="hidden lg:block">
        <Sidebar />
      </div>

      {/* Mobile Sidebar */}
      <MobileSidebar />

      {/* Main Content */}
      <div
        className={cn(
          "transition-all duration-300",
          sidebarCollapsed ? "lg:pl-16" : "lg:pl-64",
        )}
      >
        <Header />
        <main
          id="main-content"
          className="ambient-glow min-h-[calc(100vh-4rem)] bg-no-repeat p-4 md:p-6 lg:p-8"
          tabIndex={-1}
        >
          <Outlet />
        </main>
      </div>
    </div>
  );
}
