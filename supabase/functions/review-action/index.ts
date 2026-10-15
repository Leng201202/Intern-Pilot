import { authorizeOwner } from "../_shared/auth.ts";
import {
  jsonResponse,
  optionsResponse,
  safeFunctionError,
} from "../_shared/http.ts";
import { createAdminClient } from "../_shared/supabase.ts";

const STATUSES = new Set([
  "interested",
  "applied",
  "assessment",
  "interview",
  "offer",
  "accepted",
  "rejected",
  "withdrawn",
]);

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return (
    !Number.isNaN(parsed.getTime()) &&
    parsed.toISOString().slice(0, 10) === value
  );
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return optionsResponse(request);
  if (request.method !== "POST") return safeFunctionError(request, 405);
  try {
    const owner = await authorizeOwner(request);
    if (!owner) return safeFunctionError(request, 401);
    const text = await request.text();
    if (text.length > 4_096) return safeFunctionError(request, 413);
    let body: unknown;
    try {
      body = JSON.parse(text);
    } catch {
      return safeFunctionError(request, 400);
    }
    if (typeof body !== "object" || body === null || Array.isArray(body))
      return safeFunctionError(request, 400);
    const value = body as Record<string, unknown>;
    const allowedKeys = new Set([
      "action",
      "application_id",
      "deadline",
      "review_item_id",
      "status",
    ]);
    if (Object.keys(value).some((key) => !allowedKeys.has(key)))
      return safeFunctionError(request, 400);
    if (
      typeof value.review_item_id !== "string" ||
      !UUID_PATTERN.test(value.review_item_id) ||
      !["confirm", "dismiss", "resolve"].includes(String(value.action)) ||
      (value.application_id !== null &&
        value.application_id !== undefined &&
        (typeof value.application_id !== "string" ||
          !UUID_PATTERN.test(value.application_id))) ||
      (value.status !== null &&
        value.status !== undefined &&
        (typeof value.status !== "string" || !STATUSES.has(value.status))) ||
      (value.deadline !== null &&
        value.deadline !== undefined &&
        (typeof value.deadline !== "string" || !isDate(value.deadline))) ||
      (value.action === "confirm" &&
        (typeof value.application_id !== "string" ||
          typeof value.status !== "string"))
    )
      return safeFunctionError(request, 400);

    const { data, error } = await createAdminClient().rpc(
      "resolve_review_item",
      {
        p_review_item_id: value.review_item_id,
        p_user_id: owner.id,
        p_action: value.action,
        p_application_id: value.application_id ?? null,
        p_status: value.status ?? null,
        p_deadline: value.deadline ?? null,
      },
    );
    if (error || !data?.resolved) return safeFunctionError(request, 409);
    return jsonResponse(request, { resolved: true });
  } catch {
    return safeFunctionError(request);
  }
});
