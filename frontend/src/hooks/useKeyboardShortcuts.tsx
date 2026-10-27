import { useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAppDispatch } from "@/store";
import { toggleSidebar, setTheme } from "@/store/slices/uiSlice";

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

  const shortcuts: ShortcutAction[] = [
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
      action: () => navigate("/dashboard"),
      description: "Go to Dashboard",
    },
    {
      key: "x",
      ctrlKey: false,
      shiftKey: true,
      action: () => navigate("/payments/history"),
      description: "Go to Payment history",
    },
    {
      key: "n",
      ctrlKey: true,
      shiftKey: true,
      action: () => navigate("/payments/pay"),
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
