import { useMutation } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useAppDispatch } from "@/store";
import { setUser } from "@/store/slices/authSlice";
import { homePathFor } from "@/config";
import { authApi } from "../api";
import { getErrorMessage } from "@/types";
import type { LoginCredentials } from "@/types";

export function useLogin() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();

  return useMutation({
    mutationFn: (credentials: LoginCredentials) => authApi.login(credentials),
    onSuccess: (user) => {
      dispatch(setUser(user));
      toast.success("Welcome back!", {
        description: `Logged in as ${user.email}`,
      });
      navigate(homePathFor(user.role), { replace: true });
    },
    onError: (error) => {
      toast.error("Login failed", {
        description: getErrorMessage(error),
      });
    },
  });
}
