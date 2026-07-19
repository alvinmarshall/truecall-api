export interface JwtPayload {
  sub: string;
  iss: string;
  aud: string | string[];
  azp: string;
  resource_access: Record<string, { roles: string[] }>;
  exp: number;
  iat: number;
}
