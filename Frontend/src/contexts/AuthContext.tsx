import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";

export type UserRole = "admin" | "business_user";

interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  status: string;
  dept: string;
}

interface AuthContextType {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; role?: string; error?: string }>;
  register: (name: string, email: string, password: string, dept: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Load user from localStorage if token exists
  useEffect(() => {
    const token = localStorage.getItem("token");
    const storedUser = localStorage.getItem("user");
    if (token && storedUser) {
      setUser(JSON.parse(storedUser));
    }
    setIsLoading(false);
  }, []);

  const login = async (email: string, password: string) => {
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      let data: any;
      try {
        data = await res.json();
      } catch {
        return { success: false, error: "Cannot connect to server. Please ensure the backend is running." };
      }

      if (!res.ok) {
        return { success: false, error: data.error || "Login failed" };
      }

      // Store token and user in localStorage
      localStorage.setItem("token", data.token);
      localStorage.setItem("user", JSON.stringify(data.user));
      setUser(data.user);

      return { success: true, role: data.user?.role };
    } catch (err: any) {
      console.error("Login error:", err);
      const msg = err?.message || "";
      if (msg.includes("Failed to fetch") || msg.includes("NetworkError") || msg.includes("net::ERR_")) {
        return { success: false, error: "Cannot connect to server. Please ensure the backend is running." };
      }
      return { success: false, error: err.message || "Login failed" };
    }
  };

  const register = async (name: string, email: string, password: string, dept: string) => {
    if (!email.toLowerCase().endsWith('@cbe.com.et')) {
      return { success: false, error: 'Only @cbe.com.et email addresses are allowed to register.' };
    }
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password, dept }),
      });
      const data = await res.json();

      if (!res.ok) {
        return { success: false, error: data.error || "Registration failed" };
      }

      return { success: true };
    } catch (err: any) {
      console.error("Registration error:", err);
      return { success: false, error: err.message || "Registration failed" };
    }
  };

  const logout = async () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    setUser(null);
  };

  const refreshUser = async () => {
    const token = localStorage.getItem("token");
    if (!token) return;
    try {
      const res = await fetch("/api/auth/me", {
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        localStorage.setItem("user", JSON.stringify(data.user));
        setUser(data.user);
      }
    } catch (err) {
      console.error("Refresh user error:", err);
    }
  };
  
  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isLoading,
        login,
        register,
        logout,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}