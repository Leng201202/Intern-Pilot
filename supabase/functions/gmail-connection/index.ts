import { authorizeOwner } from "../_shared/auth.ts";
import { decryptSecret } from "../_shared/crypto.ts";
import { requiredEnv } from "../_shared/env.ts";
import {
  jsonResponse,
  optionsResponse,
  safeFunctionError,
} from "../_shared/http.ts";
import { createAdminClient } from "../_shared/supabase.ts";

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return optionsResponse(request);
  try {
    const owner = await authorizeOwner(request);
    if (!owner) return safeFunctionError(request, 401);
    const admin = createAdminClient();
    const { data: connection, error } = await admin
      .from("email_connections")
      .select(
        "id,sync_status,connected_at,last_successful_sync_at,gmail_history_id",
      )
      .eq("user_id", owner.id)
      .maybeSingle();
    if (error) return safeFunctionError(request);

    if (request.method === "GET") {
      return jsonResponse(request, {
        connected: Boolean(connection),
        status: connection?.sync_status ?? "disconnected",
        connected_at: connection?.connected_at ?? null,
        last_successful_sync_at: connection?.last_successful_sync_at ?? null,
        checkpoint_ready: Boolean(connection?.gmail_history_id),
      });
    }
    if (request.method !== "DELETE") return safeFunctionError(request, 405);
    if (!connection) return jsonResponse(request, { disconnected: true });

    const { data: tokenRow } = await admin
      .from("email_connections")
      .select("encrypted_refresh_token")
      .eq("id", connection.id)
      .single();
    if (tokenRow?.encrypted_refresh_token) {
      try {
        const refreshToken = await decryptSecret(
          tokenRow.encrypted_refresh_token,
          requiredEnv("GMAIL_TOKEN_ENCRYPTION_KEY"),
        );
        await fetch("https://oauth2.googleapis.com/revoke", {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({ token: refreshToken }),
          signal: AbortSignal.timeout(10_000),
        });
      } catch {
        // Local credential deletion proceeds even if provider revocation is unavailable.
      }
    }
    const { error: deleteError } = await admin
      .from("email_connections")
      .delete()
      .eq("id", connection.id)
      .eq("user_id", owner.id);
    if (deleteError) return safeFunctionError(request);
    return jsonResponse(request, { disconnected: true });
  } catch {
    return safeFunctionError(request);
  }
});
