export interface AuthTokenResponse {
  user_id: number;
  username: string;
  access_token: string;
  refresh_token: string;
  token_type: string;
}

export interface LoginResponse {
  requires_two_factor: boolean;
  user_id?: number | null;
  username?: string | null;
  access_token?: string | null;
  refresh_token?: string | null;
  trusted_device_token?: string | null;
  login_challenge_token?: string | null;
  token_type: string;
}

export interface LoginRequest {
  username: string;
  password: string;
  trusted_device_token?: string | null;
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

export interface TwoFactorSetupResponse {
  secret: string;
  otpauth_uri: string;
}

export interface TwoFactorEnableRequest {
  code: string;
}

export interface TwoFactorEnableResponse {
  message: string;
  backup_codes: string[];
}

export interface TwoFactorDisableRequest {
  password?: string | null;
  code?: string | null;
}

export interface TwoFactorLoginVerifyRequest {
  login_challenge_token: string;
  code: string;
  remember_device: boolean;
}

export interface TwoFactorVerifyResponse extends AuthTokenResponse {
  trusted_device_token?: string | null;
}
