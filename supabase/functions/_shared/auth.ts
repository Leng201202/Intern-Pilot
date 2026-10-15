import { createPublicClient } from "./supabase.ts";
import { requiredEnv } from "./env.ts";

export type AuthorizedOwner = { email: string | null; id: string };

function bearerToken(request: Request): string | null {
  const authorization = request.headers.get("authorization");
  if (!authorization?.startsWith("Bearer ")) return null;
  return authorization.slice(7).trim() || null;
}

export async function authorizeOwner(
  request: Request,
): Promise<AuthorizedOwner | null> {
  const token = bearerToken(request);
  if (!token) return null;
  const { data, error } = await createPublicClient().auth.getClaims(token);
  if (error || !data?.claims) return null;
  const claims = data.claims as Record<string, unknown>;
  const metadata =
    typeof claims.app_metadata === "object" && claims.app_metadata !== null
      ? (claims.app_metadata as Record<string, unknown>)
      : null;
  if (metadata?.internpilot_owner !== true || typeof claims.sub !== "string")
    return null;
  return {
    id: claims.sub,
    email: typeof claims.email === "string" ? claims.email : null,
  };
}

function constantTimeEqual(left: string, right: string): boolean {
  const encoder = new TextEncoder();
  const leftBytes = encoder.encode(left);
  const rightBytes = encoder.encode(right);
  let difference = leftBytes.length ^ rightBytes.length;
  const length = Math.max(leftBytes.length, rightBytes.length);
  for (let index = 0; index < length; index += 1) {
    difference |= (leftBytes[index] ?? 0) ^ (rightBytes[index] ?? 0);
  }
  return difference === 0;
}

export function authorizeScheduler(request: Request): boolean {
  const supplied = request.headers.get("x-internpilot-scheduler-secret") ?? "";
  return constantTimeEqual(supplied, requiredEnv("SCHEDULER_SECRET"));
}
