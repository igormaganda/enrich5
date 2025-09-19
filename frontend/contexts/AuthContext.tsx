import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from "react";
import backend from "~backend/client";
import type { UserInfo } from "~backend/auth/types";

interface AuthContextType {
  user: UserInfo | null;
  login: (username: string, password: string) => Promise<boolean>;
  logout: () => Promise<void>;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<UserInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    validateSession();
  }, []);

  const validateSession = async () => {
    try {
      const sessionToken = localStorage.getItem("sessionToken");
      if (!sessionToken) {
        setIsLoading(false);
        return;
      }

      const userInfo = await backend.auth.validateSession({ sessionToken });
      setUser(userInfo);
    } catch (error) {
      localStorage.removeItem("sessionToken");
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (
    username: string,
    password: string
  ): Promise<boolean> => {
    try {
      console.log("Attempting login with:", { username, password });
      const response = await backend.auth.login({ username, password });
      console.log("Login response:", response);

      if (response.success && response.sessionToken && response.user) {
        localStorage.setItem("sessionToken", response.sessionToken);
        setUser(response.user);
        return true;
      }

      return false;
    } catch (error) {
      console.error("Login failed:", error);
      return false;
    }
  };

  const logout = async () => {
    try {
      const sessionToken = localStorage.getItem("sessionToken");
      if (sessionToken) {
        await backend.auth.logout({ sessionToken });
      }
    } catch (error) {
      console.error("Logout error:", error);
    } finally {
      localStorage.removeItem("sessionToken");
      setUser(null);
    }
  };

  const value = {
    user,
    login,
    logout,
    isLoading,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
