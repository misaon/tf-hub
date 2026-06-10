import { z } from "zod";

const firebaseIdTokenClaimsSchema = z.object({
  email: z.string().optional(),
  name: z.string().optional(),
  user_id: z.string().optional(),
  sub: z.string().optional(),
  exp: z.number().optional(),
  firebase: z.object({ tenant: z.string().optional(), sign_in_provider: z.string().optional() }).optional(),
});
export type FirebaseIdTokenClaims = z.infer<typeof firebaseIdTokenClaimsSchema>;

export function decodeJwtClaims(token: string): FirebaseIdTokenClaims {
  const [, payload] = token.split(".");

  if (!payload) {
    throw new Error("Invalid JWT: missing payload segment.");
  }

  return firebaseIdTokenClaimsSchema.parse(JSON.parse(Buffer.from(payload, "base64url").toString("utf8")));
}

export function isTokenExpiringSoon(expiresAtMs: number, safetyWindowMs = 60_000): boolean {
  return expiresAtMs - safetyWindowMs <= Date.now();
}

export function expiryMsFromIdToken(idToken: string): number {
  return (decodeJwtClaims(idToken).exp ?? 0) * 1000;
}
