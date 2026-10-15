import { afterEach, describe, expect, it, vi } from "vitest";

import {
  getCandidateMessage,
  listNewMessageIds,
  refreshGmailAccessToken,
} from "../_shared/gmail.ts";

const originalFetch = globalThis.fetch;

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

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

describe("Gmail provider boundary", () => {
  it("sends refresh credentials only to the token endpoint and handles revocation safely", async () => {
    installDenoEnv({
      GMAIL_OAUTH_CLIENT_ID: "synthetic-client",
      GMAIL_OAUTH_CLIENT_SECRET: "synthetic-secret",
    });
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        jsonResponse({ access_token: "synthetic-access-token" }),
      );
    globalThis.fetch = fetchMock;

    await expect(
      refreshGmailAccessToken("synthetic-refresh-token"),
    ).resolves.toBe("synthetic-access-token");
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("https://oauth2.googleapis.com/token");
    expect(String(init?.body)).toContain("grant_type=refresh_token");
    expect(String(init?.body)).toContain(
      "refresh_token=synthetic-refresh-token",
    );

    globalThis.fetch = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(jsonResponse({ error: "invalid_grant" }, 400));
    await expect(refreshGmailAccessToken("revoked-token")).rejects.toThrow(
      "gmail_token_400",
    );
  });

  it("extracts only inline text and two filtering headers, never attachment bytes", async () => {
    const inlineText = btoa("Interview invitation for Software Intern");
    const attachmentText = btoa("passport attachment content");
    globalThis.fetch = vi.fn<typeof fetch>().mockResolvedValueOnce(
      jsonResponse({
        id: "message-1",
        threadId: "thread-1",
        internalDate: "1792032000000",
        payload: {
          mimeType: "multipart/mixed",
          headers: [
            { name: "From", value: "Recruiter <recruiter@example.test>" },
            { name: "Subject", value: "Interview invitation" },
            { name: "List-Unsubscribe", value: "<https://example.test/out>" },
            { name: "Precedence", value: "bulk" },
            { name: "X-Private", value: "must-not-propagate" },
          ],
          parts: [
            { mimeType: "text/plain", body: { data: inlineText } },
            {
              mimeType: "text/plain",
              filename: "passport.txt",
              body: { data: attachmentText, attachmentId: "attachment-1" },
            },
          ],
        },
      }),
    );

    const message = await getCandidateMessage("synthetic-access", "message-1");
    expect(message.bodyText).toContain("Interview invitation");
    expect(message.bodyText).not.toContain("passport attachment");
    expect(message.hasAttachments).toBe(true);
    expect(message.headers).toEqual({
      "list-unsubscribe": "<https://example.test/out>",
      precedence: "bulk",
    });
    expect(JSON.stringify(message)).not.toContain("X-Private");
  });

  it("advances a Gmail history checkpoint only through the complete bounded record", async () => {
    globalThis.fetch = vi.fn<typeof fetch>().mockResolvedValueOnce(
      jsonResponse({
        historyId: "105",
        history: [
          { id: "101", messagesAdded: [{ message: { id: "a" } }] },
          { id: "102", messagesAdded: [{ message: { id: "b" } }] },
          { id: "103", messagesAdded: [{ message: { id: "c" } }] },
        ],
      }),
    );

    await expect(
      listNewMessageIds("access", "100", "2026-10-15T00:00:00Z", 2, null, null),
    ).resolves.toMatchObject({
      ids: ["a", "b"],
      historyId: "102",
      recovery: false,
    });
  });

  it("preserves an expired-history recovery page and baseline checkpoint", async () => {
    globalThis.fetch = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(jsonResponse({}, 404))
      .mockResolvedValueOnce(
        jsonResponse({ messages: [{ id: "new-1" }], nextPageToken: "page-2" }),
      )
      .mockResolvedValueOnce(jsonResponse({ historyId: "recovery-baseline" }));

    await expect(
      listNewMessageIds(
        "access",
        "expired",
        "2026-10-15T00:00:00Z",
        50,
        null,
        null,
      ),
    ).resolves.toEqual({
      historyId: "expired",
      ids: ["new-1"],
      nextPageToken: "page-2",
      recovery: true,
      recoveryHistoryId: "recovery-baseline",
    });
  });
});
