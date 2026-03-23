export interface AuthTokenResponse {
  user_id: number;
  username: string;
  access_token: string;
  refresh_token: string;
  token_type: string;
}

export interface LoginRequest {
  username: string;
  password: string;
}

export interface RegisterRequest {
  username: string;
  password: string;
  confirm_password: string;
}

export interface ForgotPasswordRequest {
  username: string;
}

export interface ForgotPasswordResponse {
  message: string;
  reset_token?: string | null;
}

export interface ResetPasswordRequest {
  token: string;
  password: string;
  confirm_password: string;
}

export interface ChangePasswordRequest {
  old_password: string;
  new_password: string;
  confirm_new_password: string;
}

export interface MessageResponse {
  message: string;
}
