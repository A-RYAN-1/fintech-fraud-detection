import { apiClient } from "@/lib";
import type {
  ApiResponse,
  User,
  LoginCredentials,
  RegisterCredentials,
} from "@/types";

export const authApi = {
  login: async (credentials: LoginCredentials): Promise<User> => {
    const response = await apiClient.post<ApiResponse<User>>(
      "/auth/login",
      credentials,
    );
    return response.data.data;
  },

  register: async (credentials: RegisterCredentials): Promise<User> => {
    const response = await apiClient.post<ApiResponse<User>>("/auth/register", {
      user: credentials,
    });
    return response.data.data;
  },

  logout: async (): Promise<void> => {
    await apiClient.delete("/auth/logout");
  },

  getMe: async (): Promise<User> => {
    const response = await apiClient.get<ApiResponse<User>>("/auth/me");
    return response.data.data;
  },

  updateProfile: async (name: {
    first_name: string;
    last_name: string;
  }): Promise<User> => {
    const response = await apiClient.patch<ApiResponse<User>>("/auth/me", name);
    return response.data.data;
  },

  changePassword: async (body: {
    current_password: string;
    password: string;
    password_confirmation: string;
  }): Promise<void> => {
    await apiClient.patch("/auth/password", body);
  },

  getActivity: async (): Promise<ActivityEntry[]> => {
    const response =
      await apiClient.get<ApiResponse<{ activity: ActivityEntry[] }>>(
        "/auth/activity",
      );
    return response.data.data.activity;
  },
};

export interface ActivityEntry {
  id: number;
  event_type: string;
  description: string;
  created_at: string;
}
