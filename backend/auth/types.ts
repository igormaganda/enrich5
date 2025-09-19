export interface LoginRequest {
  username: string;
  password: string;
}

export interface LoginResponse {
  success: boolean;
  sessionToken?: string;
  user?: UserInfo;
}

export interface UserInfo {
  id: number;
  username: string;
  email: string;
  role: string;
}

export interface AuthData {
  userID: string;
  username: string;
  email: string;
}
