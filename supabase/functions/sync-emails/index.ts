import { authorizeOwner, authorizeScheduler } from "../_shared/auth.ts";
import {
  jsonResponse,
  optionsResponse,
  safeFunctionError,
} from "../_shared/http.ts";
import { createAdminClient } from "../_shared/supabase.ts";
import { runConnectionSync } from "../_shared/sync-engine.ts";

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return optionsResponse(request);
  if (request.method !== "POST") return safeFunctionError(request, 405);
  try {
    const scheduler = authorizeScheduler(request);
    const owner = scheduler ? null : await authorizeOwner(request);
    if (!scheduler && !owner) return safeFunctionError(request, 401);
    const admin = createAdminClient();
    let query = admin
      .from("email_connections")
      .select("*")
      .eq("sync_status", "connected");
    if (owner) query = query.eq("user_id", owner.id);
    const { data: connections, error } = await query;
    if (error) return safeFunctionError(request);
    if (!connections?.length)
      return jsonResponse(request, { status: "not_connected" }, 409);

    const results: Array<Record<string, unknown>> = [];
    for (const connection of connections) {
      if (owner) {
        const oneMinuteAgo = new Date(Date.now() - 60_000).toISOString();
        const { count, error: rateError } = await admin
          .from("sync_runs")
          .select("id", { count: "exact", head: true })
          .eq("user_id", owner.id)
          .gte("started_at", oneMinuteAgo);
        if (rateError) return safeFunctionError(request);
        if ((count ?? 0) > 0)
          return jsonResponse(request, { status: "rate_limited" }, 429);
      }

      const leaseToken = crypto.randomUUID();
      const { data: acquired, error: leaseError } = await admin.rpc(
        "acquire_sync_lease",
        {
          p_email_connection_id: connection.id,
          p_user_id: connection.user_id,
          p_lease_token: leaseToken,
          p_lease_seconds: 600,
        },
      );
      if (leaseError) {
        results.push({ status: "failed", error_code: "sync_unavailable" });
        continue;
      }
      if (!acquired) {
        results.push({ status: "already_running" });
        continue;
      }

      const { data: run, error: runError } = await admin
        .from("sync_runs")
        .insert({
          user_id: connection.user_id,
          email_connection_id: connection.id,
          trigger_source: scheduler ? "scheduled" : "manual",
          status: "running",
        })
        .select("id")
        .single();
      if (runError || !run) {
        await admin.rpc("release_sync_lease", {
          p_email_connection_id: connection.id,
          p_lease_token: leaseToken,
        });
        results.push({ status: "failed", error_code: "sync_unavailable" });
        continue;
      }
      try {
        const outcome = await runConnectionSync(admin, connection);
        const { error: finishError } = await admin
          .from("sync_runs")
          .update({
            status: outcome.status,
            finished_at: new Date().toISOString(),
            fetched_count: outcome.fetched,
            candidate_count: outcome.candidates,
            processed_count: outcome.processed,
            review_count: outcome.reviews,
          })
          .eq("id", run.id);
        if (finishError) throw new Error("sync_run_update_failed");
        results.push(outcome);
      } catch (syncError) {
        const code =
          syncError instanceof Error &&
          syncError.message.startsWith("gmail_token_")
            ? "gmail_reauthorization_required"
            : "sync_failed";
        if (code === "gmail_reauthorization_required") {
          await admin
            .from("email_connections")
            .update({ sync_status: "reauthorization_required" })
            .eq("id", connection.id);
        }
        await admin
          .from("sync_runs")
          .update({
            status: "failed",
            finished_at: new Date().toISOString(),
            error_code: code,
          })
          .eq("id", run.id);
        results.push({ status: "failed", error_code: code });
      } finally {
        await admin.rpc("release_sync_lease", {
          p_email_connection_id: connection.id,
          p_lease_token: leaseToken,
        });
      }
    }
    return jsonResponse(request, { status: "finished", results });
  } catch {
    return safeFunctionError(request);
  }
});
