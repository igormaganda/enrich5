import { api, APIError } from "encore.dev/api";
import type { LoginRequest, LoginResponse, UserInfo } from "./types";

// Simple login without database for testing
export const login = api(
  { expose: true, method: "POST", path: "/login" },
  async (req: LoginRequest): Promise<LoginResponse> => {
    console.log('Login attempt:', { username: req.username });
    
    // Simple hardcoded authentication for testing
    if (req.username === "admin" && req.password === "admin123") {
      return {
        success: true,
        sessionToken: "test-session-token",
        user: {
          id: 1,
          username: "admin",
          email: "admin@example.com",
          role: "admin"
        }
      };
    }
    
    throw APIError.unauthenticated("Invalid credentials");
  }
);

// Logs out user (simple implementation)
export const logout = api(
  { expose: true, method: "POST", path: "/logout" },
  async (req: {sessionToken: string}): Promise<{success: boolean}> => {
    // For now, just return success
    return { success: true };
  }
);

// Validates session token (simple implementation)
export const validateSession = api(
  { expose: true, method: "GET", path: "/validate" },
  async (req: {sessionToken: string}): Promise<UserInfo> => {
    // For testing, accept any session token
    if (req.sessionToken) {
      return {
        id: 1,
        username: "admin",
        email: "admin@example.com",
        role: "admin"
      };
    }
    
    throw APIError.unauthenticated("Invalid or expired session");
  }
);
