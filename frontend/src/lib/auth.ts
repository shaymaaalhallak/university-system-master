import { api } from "@/lib/api";
import Cookies from "js-cookie";

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: "student" | "professor" | "admin";
  departmentId?: string;
}

export interface LoginResponse {
  success: boolean;
  data?: {
    token: string;
    user: User;
  };
  message?: string;
}

export const auth = {
  async login(email: string, password: string): Promise<LoginResponse> {
    try {
      const response = await api.post<LoginResponse>("/auth/login", { email, password });
      if (response.data?.token) {
        Cookies.set("token", response.data.token, { expires: 7 });
        Cookies.set("user", JSON.stringify(response.data.user), { expires: 7 });
      }
      return response;
    } catch (error: any) {
      return (
        error.response?.data || { success: false, message: "Login failed" }
      );
    }
  },

  async register(data: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    role: string;
  }) {
    try {
      const response = await api.post<LoginResponse>("/auth/register", data);
      return response;
    } catch (error: any) {
      return (
        error.response?.data || {
          success: false,
          message: "Registration failed",
        }
      );
    }
  },

  logout() {
    Cookies.remove("token");
    Cookies.remove("user");
    window.location.href = "/login";
  },

  getToken(): string | undefined {
    return Cookies.get("token");
  },

  getUser(): User | null {
    const userStr = Cookies.get("user");
    if (userStr) {
      try {
        return JSON.parse(userStr);
      } catch {
        return null;
      }
    }
    return null;
  },

  isAuthenticated(): boolean {
    return !!this.getToken();
  },
};
