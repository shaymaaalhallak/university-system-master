"use client";

import {
  createContext, useContext, useState, useEffect, ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import Cookies from "js-cookie";
import { jwtDecode } from "jwt-decode";
import { User, LoginCredentials, RegisterData } from "@/types";
import { authApi } from "@/lib/api";

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (credentials: LoginCredentials) => Promise<void>;
  register: (data: RegisterData) => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const init = async () => {
      // FIX 1: single variable, no shadowing
      let savedToken: string | null = Cookies.get("token") || null;
      if (!savedToken && typeof window !== "undefined") {
        savedToken = localStorage.getItem("token");
      }

      if (savedToken) {
        try {
          const decoded = jwtDecode<{ exp: number }>(savedToken);
          if (decoded.exp * 1000 < Date.now()) {
            clearStorage();
          } else {
            setToken(savedToken);
            // Try cache first
            const cached = typeof window !== "undefined"
              ? localStorage.getItem("user") : null;
            if (cached) {
              setUser(JSON.parse(cached));
            } else {
              // FIX 2: api returns response.data — shape is { success, data }
              const res: any = await authApi.getCurrentUser();
              if (res.success && res.data) {
                setUser(res.data);
                localStorage.setItem("user", JSON.stringify(res.data));
              }
            }
          }
        } catch {
          clearStorage();
        }
      }
      setIsLoading(false);
    };
    init();
  }, []);

  const clearStorage = () => {
    Cookies.remove("token");
    if (typeof window !== "undefined") {
      localStorage.removeItem("token");
      localStorage.removeItem("user");
    }
    setToken(null);
    setUser(null);
  };

  const login = async (credentials: LoginCredentials) => {
    // FIX 3: api.post returns response.data which is { success, data: { user, token } }
    const res: any = await authApi.login(credentials.email, credentials.password);

    if (!res.success) {
      throw new Error(res.message || "Login failed");
    }

    const { user: loggedInUser, token: authToken } = res.data;

    Cookies.set("token", authToken, { expires: 7 });
    localStorage.setItem("token", authToken);
    localStorage.setItem("user", JSON.stringify(loggedInUser));

    setToken(authToken);
    setUser(loggedInUser);
    router.push(dashboardRoute(loggedInUser.role));
  };

  const register = async (data: RegisterData) => {
    const res: any = await authApi.register(data);
    if (!res.success) throw new Error(res.message || "Registration failed");

    const { user: newUser, token: authToken } = res.data;
    Cookies.set("token", authToken, { expires: 7 });
    localStorage.setItem("token", authToken);
    localStorage.setItem("user", JSON.stringify(newUser));
    setToken(authToken);
    setUser(newUser);
    router.push(dashboardRoute(newUser.role));
  };

  const logout = () => {
    authApi.logout().catch(() => {});
    clearStorage();
    router.push("/login");
  };

  const refreshUser = async () => {
    try {
      const res: any = await authApi.getCurrentUser();
      if (res.success && res.data) {
        setUser(res.data);
        localStorage.setItem("user", JSON.stringify(res.data));
      }
    } catch {
      logout();
    }
  };

  const dashboardRoute = (role: string) => {
    if (role === "student") return "/student/dashboard";
    if (role === "professor") return "/professor/dashboard";
    return "/admin/dashboard";
  };

  return (
    <AuthContext.Provider value={{
      user, token, isLoading,
      isAuthenticated: !!user,
      login, register, logout, refreshUser,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be inside AuthProvider");
  return ctx;
}
