import { authorizeScheduler } from "../_shared/auth.ts";
import { jsonResponse, safeFunctionError } from "../_shared/http.ts";
import { createAdminClient } from "../_shared/supabase.ts";

Deno.serve(async (request) => {
  if (request.method !== "POST") return safeFunctionError(request, 405);
  try {
    if (!authorizeScheduler(request)) return safeFunctionError(request, 401);
    const admin = createAdminClient();
    const [
      { data: retention, error: retentionError },
      { data: reminders, error: reminderError },
    ] = await Promise.all([
      admin.rpc("run_retention_cleanup"),
      admin.rpc("generate_follow_ups"),
    ]);
    if (retentionError || reminderError) return safeFunctionError(request);
    return jsonResponse(request, {
      status: "completed",
      retention,
      reminders,
    });
  } catch {
    return safeFunctionError(request);
  }
});
