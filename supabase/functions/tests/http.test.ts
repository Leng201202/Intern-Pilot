import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { corsHeaders, optionsResponse } from "../_shared/http.ts";

const originalFrontendUrl = process.env.FRONTEND_URL;

beforeEach(() => {
  vi.stubGlobal("Deno", {
    env: { get: (name: string) => process.env[name] },
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
  if (originalFrontendUrl === undefined) delete process.env.FRONTEND_URL;
  else process.env.FRONTEND_URL = originalFrontendUrl;
});

describe("Edge Function CORS boundary", () => {
  it("allows the Supabase browser client headers only from the configured frontend", () => {
    process.env.FRONTEND_URL = "https://intern-pilot.pages.dev";
    const request = new Request(
      "https://project-ref.supabase.co/functions/v1/gmail-oauth-start",
      {
        method: "OPTIONS",
        headers: {
          Origin: "https://intern-pilot.pages.dev",
          "Access-Control-Request-Headers":
            "authorization, apikey, content-type, x-client-info",
        },
      },
    );

    const headers = new Headers(corsHeaders(request));
    const allowedHeaders = headers
      .get("Access-Control-Allow-Headers")
      ?.split(",")
      .map((header) => header.trim().toLowerCase());

    expect(headers.get("Access-Control-Allow-Origin")).toBe(
      "https://intern-pilot.pages.dev",
    );
    expect(allowedHeaders).toEqual(
      expect.arrayContaining([
        "authorization",
        "apikey",
        "content-type",
        "x-client-info",
      ]),
    );
    expect(optionsResponse(request).status).toBe(204);
  });

  it("does not reflect an unconfigured origin", () => {
    process.env.FRONTEND_URL = "https://intern-pilot.pages.dev";
    const request = new Request(
      "https://project-ref.supabase.co/functions/v1/gmail-oauth-start",
      { headers: { Origin: "https://attacker.example" } },
    );

    const headers = new Headers(corsHeaders(request));
    expect(headers.get("Access-Control-Allow-Origin")).toBe(
      "https://intern-pilot.pages.dev",
    );
  });
});
