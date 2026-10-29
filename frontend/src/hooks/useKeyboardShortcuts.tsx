import { useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAppDispatch } from "@/store";
import { toggleSidebar, setTheme } from "@/store/slices/uiSlice";
import { useAuth } from "@/features/auth/hooks";

interface ShortcutAction {
  key: string;
  ctrlKey?: boolean;
  metaKey?: boolean;
  shiftKey?: boolean;
  action: () => void;
  description: string;
}

export function useKeyboardShortcuts() {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const { user } = useAuth();
  const isCustomer = user?.role === "customer";

  const all: (ShortcutAction | false)[] = [
    {
      key: "b",
      ctrlKey: true,
      action: () => dispatch(toggleSidebar()),
      description: "Toggle sidebar",
    },
    {
      key: "d",
      ctrlKey: true,
      shiftKey: true,
      action: () => navigate("/home"),
      description: "Go to Home",
    },
    isCustomer && {
      key: "x",
      ctrlKey: false,
      shiftKey: true,
      action: () => navigate("/history"),
      description: "Go to History",
    },
    isCustomer && {
      key: "n",
      ctrlKey: true,
      shiftKey: true,
      action: () => navigate("/pay"),
      description: "New payment",
    },
    {
      key: "l",
      ctrlKey: true,
      shiftKey: true,
      action: () => {
        const root = document.documentElement;
        const isDark = root.classList.contains("dark");
        dispatch(setTheme(isDark ? "light" : "dark"));
      },
      description: "Toggle theme",
    },
  ];
  const shortcuts = all.filter((s): s is ShortcutAction => Boolean(s));

  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      // Don't trigger shortcuts when typing in inputs
      const target = event.target as HTMLElement;
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable
      ) {
        return;
      }

      for (const shortcut of shortcuts) {
        const ctrlMatch = shortcut.ctrlKey
          ? event.ctrlKey || event.metaKey
          : true;
        const shiftMatch = shortcut.shiftKey ? event.shiftKey : !event.shiftKey;
        const keyMatch = event.key.toLowerCase() === shortcut.key.toLowerCase();

        if (ctrlMatch && shiftMatch && keyMatch) {
          event.preventDefault();
          shortcut.action();
          return;
        }
      }
    },
    [shortcuts],
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  return { shortcuts };
}

export function useGlobalShortcuts() {
  useKeyboardShortcuts();
}
