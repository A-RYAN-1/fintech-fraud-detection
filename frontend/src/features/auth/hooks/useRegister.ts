import { useMutation } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useAppDispatch } from "@/store";
import { setUser } from "@/store/slices/authSlice";
import { homePathFor } from "@/config";
import { authApi } from "../api";
import { getErrorMessage } from "@/types";
import type { RegisterCredentials } from "@/types";

export function useRegister() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();

  return useMutation({
    mutationFn: (credentials: RegisterCredentials) =>
      authApi.register(credentials),
    onSuccess: (user) => {
      dispatch(setUser(user));
      toast.success("Account created!", {
        description: "Welcome to Fintech Risk Engine",
      });
      navigate(homePathFor(user.role), { replace: true });
    },
    onError: (error) => {
      toast.error("Registration failed", {
        description: getErrorMessage(error),
      });
    },
  });
}
