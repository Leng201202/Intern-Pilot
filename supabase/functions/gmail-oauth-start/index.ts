import { authorizeOwner } from "../_shared/auth.ts";
import {
  encryptSecret,
  randomUrlSafe,
  sha256Hex,
  sha256UrlSafe,
} from "../_shared/crypto.ts";
import { requiredEnv } from "../_shared/env.ts";
import {
  jsonResponse,
  optionsResponse,
  safeFunctionError,
} from "../_shared/http.ts";
import { createAdminClient } from "../_shared/supabase.ts";

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return optionsResponse(request);
  if (request.method !== "POST") return safeFunctionError(request, 405);

  try {
    const owner = await authorizeOwner(request);
    if (!owner) return safeFunctionError(request, 401);

    const state = randomUrlSafe(32);
    const verifier = randomUrlSafe(48);
    const callbackUrl = requiredEnv("GMAIL_OAUTH_CALLBACK_URL");
    const { error } = await createAdminClient()
      .from("gmail_oauth_states")
      .insert({
        user_id: owner.id,
        state_hash: await sha256Hex(state),
        encrypted_code_verifier: await encryptSecret(
          verifier,
          requiredEnv("GMAIL_TOKEN_ENCRYPTION_KEY"),
        ),
        redirect_uri: callbackUrl,
        expires_at: new Date(Date.now() + 10 * 60_000).toISOString(),
      });
    if (error) return safeFunctionError(request);

    const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    url.search = new URLSearchParams({
      access_type: "offline",
      client_id: requiredEnv("GMAIL_OAUTH_CLIENT_ID"),
      code_challenge: await sha256UrlSafe(verifier),
      code_challenge_method: "S256",
      include_granted_scopes: "true",
      prompt: "consent",
      redirect_uri: callbackUrl,
      response_type: "code",
      scope: "openid email https://www.googleapis.com/auth/gmail.readonly",
      state,
    }).toString();
    return jsonResponse(request, { authorization_url: url.toString() });
  } catch {
    return safeFunctionError(request);
  }
});
