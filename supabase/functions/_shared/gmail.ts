import type { CandidateMessage } from "./types.ts";

const GMAIL_BASE = "https://gmail.googleapis.com/gmail/v1/users/me";

type GmailPart = {
  body?: { attachmentId?: string; data?: string };
  filename?: string;
  mimeType?: string;
  parts?: GmailPart[];
};

type GmailMessage = {
  id: string;
  internalDate?: string;
  payload?: GmailPart & {
    headers?: Array<{ name?: string; value?: string }>;
  };
  threadId?: string;
};

function retryable(status: number): boolean {
  return status === 429 || status >= 500;
}

async function waitForRetry(attempt: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 250 * 2 ** attempt));
}

async function gmailFetch<T>(accessToken: string, path: string): Promise<T> {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const response = await fetch(`${GMAIL_BASE}${path}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      signal: AbortSignal.timeout(15_000),
    });
    if (response.ok) return (await response.json()) as T;
    if (retryable(response.status) && attempt < 2) {
      await waitForRetry(attempt);
      continue;
    }
    const error = new Error(`gmail_http_${response.status}`);
    (error as Error & { status?: number }).status = response.status;
    throw error;
  }
  throw new Error("gmail_http_failed");
}

function decodeBody(value: string): string {
  const normalized = value.replaceAll("-", "+").replaceAll("_", "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
  const bytes = Uint8Array.from(atob(padded), (character) =>
    character.charCodeAt(0),
  );
  return new TextDecoder().decode(bytes);
}

function collectInlineText(part: GmailPart | undefined): {
  hasAttachments: boolean;
  text: string;
} {
  if (!part) return { hasAttachments: false, text: "" };
  let hasAttachments = Boolean(part.filename || part.body?.attachmentId);
  const texts: string[] = [];
  if (
    !part.filename &&
    !part.body?.attachmentId &&
    part.body?.data &&
    (part.mimeType === "text/plain" || part.mimeType === "text/html")
  ) {
    texts.push(decodeBody(part.body.data));
  }
  for (const child of part.parts ?? []) {
    const result = collectInlineText(child);
    hasAttachments ||= result.hasAttachments;
    if (result.text) texts.push(result.text);
  }
  return { hasAttachments, text: texts.join("\n") };
}

export async function refreshGmailAccessToken(
  refreshToken: string,
): Promise<string> {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const response = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: Deno.env.get("GMAIL_OAUTH_CLIENT_ID") ?? "",
        client_secret: Deno.env.get("GMAIL_OAUTH_CLIENT_SECRET") ?? "",
        grant_type: "refresh_token",
        refresh_token: refreshToken,
      }),
      signal: AbortSignal.timeout(15_000),
    });
    if (response.ok) {
      const data = (await response.json()) as { access_token?: unknown };
      if (typeof data.access_token !== "string")
        throw new Error("gmail_token_invalid");
      return data.access_token;
    }
    if (retryable(response.status) && attempt < 2) {
      await waitForRetry(attempt);
      continue;
    }
    throw new Error(`gmail_token_${response.status}`);
  }
  throw new Error("gmail_token_failed");
}

export async function listNewMessageIds(
  accessToken: string,
  historyId: string | null,
  syncAfter: string,
  maxResults: number,
  recoveryPageToken: string | null,
  recoveryHistoryId: string | null,
): Promise<{
  historyId: string | null;
  ids: string[];
  nextPageToken: string | null;
  recovery: boolean;
  recoveryHistoryId: string | null;
}> {
  if (historyId && !recoveryPageToken) {
    try {
      const ids = new Set<string>();
      let checkpoint = historyId;
      let pageToken: string | null = null;
      let finalHistoryId = historyId;
      for (let page = 0; page < 20; page += 1) {
        const data = await gmailFetch<{
          history?: Array<{
            id?: string;
            messagesAdded?: Array<{ message?: { id?: string } }>;
          }>;
          historyId?: string;
          nextPageToken?: string;
        }>(
          accessToken,
          `/history?startHistoryId=${encodeURIComponent(historyId)}&historyTypes=messageAdded&maxResults=100${pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : ""}`,
        );
        finalHistoryId = data.historyId ?? finalHistoryId;
        for (const item of data.history ?? []) {
          const recordIds = [
            ...new Set(
              (item.messagesAdded ?? []).flatMap((added) =>
                added.message?.id ? [added.message.id] : [],
              ),
            ),
          ];
          const additional = recordIds.filter((id) => !ids.has(id));
          if (ids.size > 0 && ids.size + additional.length > maxResults) {
            return {
              ids: [...ids],
              historyId: checkpoint,
              nextPageToken: null,
              recovery: false,
              recoveryHistoryId: null,
            };
          }
          additional.forEach((id) => ids.add(id));
          checkpoint = item.id ?? checkpoint;
          if (ids.size >= maxResults) {
            return {
              ids: [...ids],
              historyId: checkpoint,
              nextPageToken: null,
              recovery: false,
              recoveryHistoryId: null,
            };
          }
        }
        pageToken = data.nextPageToken ?? null;
        if (!pageToken) {
          checkpoint = finalHistoryId;
          break;
        }
      }
      return {
        ids: [...ids],
        historyId: checkpoint,
        nextPageToken: null,
        recovery: false,
        recoveryHistoryId: null,
      };
    } catch (error) {
      if ((error as Error & { status?: number }).status !== 404) throw error;
    }
  }

  const after = Math.floor(new Date(syncAfter).getTime() / 1_000);
  const data = await gmailFetch<{
    messages?: Array<{ id?: string }>;
    nextPageToken?: string;
    resultSizeEstimate?: number;
  }>(
    accessToken,
    `/messages?q=${encodeURIComponent(`after:${after}`)}&maxResults=${maxResults}${recoveryPageToken ? `&pageToken=${encodeURIComponent(recoveryPageToken)}` : ""}`,
  );
  return {
    ids: (data.messages ?? []).flatMap((message) =>
      message.id ? [message.id] : [],
    ),
    historyId,
    nextPageToken: data.nextPageToken ?? null,
    recovery: true,
    recoveryHistoryId:
      recoveryHistoryId ?? (await getCurrentHistoryId(accessToken)),
  };
}

export async function getCandidateMessage(
  accessToken: string,
  messageId: string,
): Promise<CandidateMessage> {
  const data = await gmailFetch<GmailMessage>(
    accessToken,
    `/messages/${encodeURIComponent(messageId)}?format=full`,
  );
  const headers = Object.fromEntries(
    (data.payload?.headers ?? []).flatMap((header) =>
      header.name && header.value
        ? [[header.name.toLocaleLowerCase(), header.value]]
        : [],
    ),
  );
  const inline = collectInlineText(data.payload);
  return {
    bodyText: inline.text,
    from: headers.from ?? "",
    hasAttachments: inline.hasAttachments,
    headers: {
      ...(headers["list-unsubscribe"]
        ? { "list-unsubscribe": headers["list-unsubscribe"] }
        : {}),
      ...(headers.precedence ? { precedence: headers.precedence } : {}),
    },
    internalDate: data.internalDate
      ? new Date(Number(data.internalDate)).toISOString()
      : new Date().toISOString(),
    messageId: data.id,
    subject: headers.subject ?? "",
    threadId: data.threadId ?? null,
  };
}

export async function getCurrentHistoryId(
  accessToken: string,
): Promise<string | null> {
  const data = await gmailFetch<{ historyId?: string }>(
    accessToken,
    "/profile",
  );
  return data.historyId ?? null;
}
