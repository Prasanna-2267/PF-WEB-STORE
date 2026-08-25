export interface AuthContext {
  userId: string;
  sessionId: string;
  authSessionId: string;
  email: string;
  fullName: string;
  roleKey: string;
  permissions: ReadonlySet<string>;
}

export interface RequestMetadata {
  ipAddress?: string;
  userAgent?: string;
  deviceName?: string;
}

export interface PublicUser {
  id: string;
  email: string;
  fullName: string;
  role: string;
  permissions: string[];
}

export interface AuthResult {
  accessToken: string;
  refreshToken: string;
  tokenType: "Bearer";
  expiresIn: number;
  user: PublicUser;
}
