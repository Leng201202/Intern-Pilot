import { decryptSecret, encryptSecret, sha256Hex } from "../_shared/crypto.ts";
import { requiredEnv } from "../_shared/env.ts";
import { createAdminClient } from "../_shared/supabase.ts";

function redirect(outcome: "success" | "error"): Response {
  const url = new URL("/settings", requiredEnv("FRONTEND_URL"));
  url.searchParams.set("gmail", outcome);
  return Response.redirect(url.toString(), 303);
}

async function revokeBestEffort(token: string): Promise<void> {
  try {
    await fetch("https://oauth2.googleapis.com/revoke", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ token }),
      signal: AbortSignal.timeout(10_000),
    });
  } catch {
    // The callback still fails closed; the user can revoke the grant at Google.
  }
}

Deno.serve(async (request) => {
  if (request.method !== "GET") return new Response(null, { status: 405 });
  try {
    if ((Deno.env.get("GMAIL_INITIAL_SYNC_MODE") ?? "new_only") !== "new_only")
      return redirect("error");
    const url = new URL(request.url);
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");
    if (!code || !state || url.searchParams.has("error"))
      return redirect("error");

    const admin = createAdminClient();
    const stateHash = await sha256Hex(state);
    const { data: oauthState, error: stateError } = await admin
      .from("gmail_oauth_states")
      .select("*")
      .eq("state_hash", stateHash)
      .is("used_at", null)
      .gt("expires_at", new Date().toISOString())
      .single();
    if (stateError || !oauthState) return redirect("error");

    const { data: consumedState, error: consumeError } = await admin
      .from("gmail_oauth_states")
      .update({ used_at: new Date().toISOString() })
      .eq("id", oauthState.id)
      .is("used_at", null)
      .select("id")
      .single();
    if (consumeError || !consumedState) return redirect("error");

    const encryptionKey = requiredEnv("GMAIL_TOKEN_ENCRYPTION_KEY");
    const verifier = await decryptSecret(
      oauthState.encrypted_code_verifier,
      encryptionKey,
    );
    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: requiredEnv("GMAIL_OAUTH_CLIENT_ID"),
        client_secret: requiredEnv("GMAIL_OAUTH_CLIENT_SECRET"),
        code,
        code_verifier: verifier,
        grant_type: "authorization_code",
        redirect_uri: oauthState.redirect_uri,
      }),
      signal: AbortSignal.timeout(15_000),
    });
    if (!tokenResponse.ok) return redirect("error");
    const token = (await tokenResponse.json()) as {
      access_token?: unknown;
      refresh_token?: unknown;
      scope?: unknown;
    };
    if (
      typeof token.access_token !== "string" ||
      typeof token.refresh_token !== "string" ||
      typeof token.scope !== "string"
    )
      return redirect("error");
    const scopes = token.scope.split(" ").filter(Boolean);
    if (!scopes.includes("https://www.googleapis.com/auth/gmail.readonly"))
      return redirect("error");

    const [identityResponse, profileResponse] = await Promise.all([
      fetch("https://openidconnect.googleapis.com/v1/userinfo", {
        headers: { Authorization: `Bearer ${token.access_token}` },
        signal: AbortSignal.timeout(15_000),
      }),
      fetch("https://gmail.googleapis.com/gmail/v1/users/me/profile", {
        headers: { Authorization: `Bearer ${token.access_token}` },
        signal: AbortSignal.timeout(15_000),
      }),
    ]);
    if (!identityResponse.ok || !profileResponse.ok) {
      await revokeBestEffort(token.refresh_token);
      return redirect("error");
    }
    const identity = (await identityResponse.json()) as { sub?: unknown };
    const profile = (await profileResponse.json()) as { historyId?: unknown };
    if (typeof identity.sub !== "string") {
      await revokeBestEffort(token.refresh_token);
      return redirect("error");
    }

    const { error: connectionError } = await admin
      .from("email_connections")
      .upsert(
        {
          user_id: oauthState.user_id,
          google_account_subject: identity.sub,
          encrypted_refresh_token: await encryptSecret(
            token.refresh_token,
            encryptionKey,
          ),
          token_key_version: Number.parseInt(
            requiredEnv("GMAIL_TOKEN_KEY_VERSION"),
            10,
          ),
          granted_scopes: scopes,
          connected_at: new Date().toISOString(),
          gmail_history_id:
            typeof profile.historyId === "string" ? profile.historyId : null,
          recovery_page_token: null,
          recovery_history_id: null,
          sync_after_at: new Date().toISOString(),
          sync_status: "connected",
        },
        { onConflict: "user_id" },
      );
    if (connectionError) {
      await revokeBestEffort(token.refresh_token);
      return redirect("error");
    }
    return redirect("success");
  } catch {
    return redirect("error");
  }
});
