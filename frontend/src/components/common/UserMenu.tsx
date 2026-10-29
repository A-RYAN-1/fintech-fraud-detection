import { LogOut } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Avatar,
  AvatarFallback,
} from "@/components/ui";
import { useAuth } from "@/features/auth/hooks";

export default function UserMenu() {
  const { user, logout } = useAuth();

  if (!user) return null;

  const initials = `${user.first_name[0]}${user.last_name[0]}`.toUpperCase();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="flex items-center gap-2 rounded-lg p-1.5 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 dark:focus:ring-offset-neutral-900">
          <Avatar className="h-8 w-8">
            <AvatarFallback className="bg-primary-100 text-primary-700 dark:bg-primary-900 dark:text-primary-300 text-sm">
              {initials}
            </AvatarFallback>
          </Avatar>
          <div className="hidden md:block text-left">
            <p className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
              {user.first_name} {user.last_name}
            </p>
            <p className="text-xs text-neutral-500 dark:text-neutral-400 capitalize">
              {user.role}
            </p>
          </div>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>
          <div className="flex flex-col">
            <span>
              {user.first_name} {user.last_name}
            </span>
            <span className="text-xs font-normal text-neutral-500 dark:text-neutral-400">
              {user.email}
            </span>
            <span className="mt-1 text-xs font-normal capitalize text-neutral-500 dark:text-neutral-400">
              Role: {user.role}
            </span>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={logout}
          className="cursor-pointer text-danger-600 dark:text-danger-400 focus:text-danger-600 dark:focus:text-danger-400"
        >
          <LogOut className="mr-2 h-4 w-4" />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
