import { afterEach, describe, expect, it, vi } from "vitest";

import { classifyWithGemini } from "../_shared/gemini.ts";

const originalFetch = globalThis.fetch;

function installDenoEnv(values: Readonly<Record<string, string>>): void {
  (
    globalThis as unknown as {
      Deno: { env: { get(name: string): string | undefined } };
    }
  ).Deno = {
    env: { get: (name) => values[name] },
  };
}

afterEach(() => {
  globalThis.fetch = originalFetch;
  vi.restoreAllMocks();
});

describe("Gemini provider boundary", () => {
  it("keeps the API key out of the URL and sends only the allowlisted payload", async () => {
    installDenoEnv({
      GEMINI_API_KEY: "synthetic-api-key",
      GEMINI_MODEL: "synthetic-model",
    });
    const classification = {
      action_type: "confirm_interview",
      deadline: null,
      email_category: "interview_invitation",
      event_date: "2026-10-20",
      is_recruitment_related: true,
      needs_manual_review: false,
      reason_code: "clear_interview_invitation",
      requires_action: true,
      suggested_status: "interview",
    };
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          candidates: [
            { content: { parts: [{ text: JSON.stringify(classification) }] } },
          ],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );
    globalThis.fetch = fetchMock;

    await expect(
      classifyWithGemini({
        locale: "en",
        message_excerpt:
          "A sanitized interview invitation for the internship role.",
      }),
    ).resolves.toEqual(classification);

    const [url, init] = fetchMock.mock.calls[0]!;
    expect(String(url)).not.toContain("synthetic-api-key");
    expect(new Headers(init?.headers).get("x-goog-api-key")).toBe(
      "synthetic-api-key",
    );
    const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
    expect(JSON.stringify(body)).toContain("message_excerpt");
    expect(JSON.stringify(body)).not.toContain("gmail_message_id");
    expect(JSON.stringify(body)).not.toContain("application_id");
  });

  it("fails closed on malformed provider output", async () => {
    installDenoEnv({
      GEMINI_API_KEY: "synthetic-api-key",
      GEMINI_MODEL: "synthetic-model",
    });
    globalThis.fetch = vi.fn<typeof fetch>().mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          candidates: [{ content: { parts: [{ text: "not-json" }] } }],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );

    await expect(
      classifyWithGemini({
        locale: "en",
        message_excerpt: "A sufficiently long sanitized recruitment update.",
      }),
    ).rejects.toThrow();
  });

  it("surfaces a bounded provider error category for rate limiting", async () => {
    installDenoEnv({
      GEMINI_API_KEY: "synthetic-api-key",
      GEMINI_MODEL: "synthetic-model",
    });
    globalThis.fetch = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(new Response(null, { status: 429 }));

    await expect(
      classifyWithGemini({
        locale: "en",
        message_excerpt: "A sufficiently long sanitized recruitment update.",
      }),
    ).rejects.toThrow("gemini_http_429");
  });
});
