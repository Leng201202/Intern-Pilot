import { requiredEnv } from "./env.ts";

export function corsHeaders(request: Request): HeadersInit {
  const configuredOrigin = requiredEnv("FRONTEND_URL");
  const requestOrigin = request.headers.get("origin");
  return {
    "Access-Control-Allow-Headers": "authorization, apikey, content-type",
    "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
    "Access-Control-Allow-Origin":
      requestOrigin === configuredOrigin ? requestOrigin : configuredOrigin,
    Vary: "Origin",
  };
}

export function jsonResponse(
  request: Request,
  body: Readonly<Record<string, unknown>>,
  status = 200,
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders(request),
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    },
  });
}

export function optionsResponse(request: Request): Response {
  return new Response(null, { status: 204, headers: corsHeaders(request) });
}

export function safeFunctionError(request: Request, status = 500): Response {
  return jsonResponse(
    request,
    { error: status === 500 ? "operation_failed" : "request_rejected" },
    status,
  );
}
