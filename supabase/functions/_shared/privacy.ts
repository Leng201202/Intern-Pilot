import type { GeminiPayload, PrivacyResult } from "./types.ts";

const HIGH_RISK_PATTERNS: ReadonlyArray<RegExp> = [
  /\b(?:password|passcode|one[- ]?time password|otp|api key|secret key)\b/i,
  /\b(?:passport|national id|social security|bank account|routing number|credit card)\b/i,
  /\b(?:confidential|strictly private|medical record|health information)\b/i,
  /\b(?:salary|compensation|pay rate|hourly rate|annual pay)\b/i,
  /\b(?:cvv|pin)\s*[:#-]?\s*\d{3,8}\b/i,
];

const RESIDUAL_IDENTIFIER_PATTERNS: ReadonlyArray<RegExp> = [
  /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i,
  /(?:\+?\d[\d\s().-]{7,}\d)/,
  /\b(?:student|candidate|account)\s*(?:id|number|no\.?)[\s:#-]*[a-z0-9-]{4,}\b/i,
  /\b\d{1,5}\s+[A-Za-z][A-Za-z .'-]{2,}\s(?:street|st|road|rd|avenue|ave|lane|ln|drive|dr)\b/i,
  /\b[A-Z0-9._%+-]+\s*(?:\[at\]|\(at\))\s*[A-Z0-9.-]+\s*(?:\[dot\]|\(dot\))\s*[A-Z]{2,}\b/i,
];

function decodeEntities(value: string): string {
  return value
    .replaceAll("&nbsp;", " ")
    .replaceAll("&amp;", "&")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"')
    .replaceAll("&commat;", "@")
    .replaceAll("&period;", ".")
    .replace(/&#x([0-9a-f]+);/gi, (_, code: string) =>
      String.fromCodePoint(Number.parseInt(code, 16)),
    )
    .replace(/&#(\d+);/g, (_, code: string) =>
      String.fromCodePoint(Number.parseInt(code, 10)),
    );
}

function stripQuotedAndSignature(value: string): string {
  return value
    .split(/\r?\n/)
    .filter((line) => !/^\s*>/.test(line))
    .join("\n")
    .split(/\n(?:On .+ wrote:|From:\s|-----Original Message-----)/i)[0]!
    .split(
      /\n(?:--\s*$|Best regards[,!]?$|Kind regards[,!]?$|Sincerely[,]?$)/im,
    )[0]!;
}

export function inspectAndSanitize(
  rawText: string,
  companyNames: ReadonlyArray<string>,
): PrivacyResult {
  if (!rawText || rawText.length > 100_000)
    return { outcome: "blocked", reason: "sanitization_uncertain" };
  if (HIGH_RISK_PATTERNS.some((pattern) => pattern.test(rawText)))
    return { outcome: "blocked", reason: "privacy_blocked" };

  let sanitized = decodeEntities(rawText)
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<\/?(?:span|b|i|strong|em)\b[^>]*>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/https?:\/\/[^\s<>"]+/gi, "[LINK]");
  sanitized = stripQuotedAndSignature(sanitized)
    .replace(/\b\d{4}-\d{2}-\d{2}\b/g, "[DATE]")
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, "[EMAIL]")
    .replace(/(?:\+?\d[\d\s().-]{7,}\d)/g, "[PHONE]")
    .replace(
      /\b(?:student|candidate|account)\s*(?:id|number|no\.?)[\s:#-]*[a-z0-9-]{4,}\b/gi,
      "[IDENTIFIER]",
    )
    .replace(
      /\b\d{1,5}\s+[A-Za-z][A-Za-z .'-]{2,}\s(?:street|st|road|rd|avenue|ave|lane|ln|drive|dr)\b/gi,
      "[ADDRESS]",
    )
    .replace(
      /\b(?:Dear|Hello|Hi)\s+[A-Z][A-Za-z'-]+(?:\s+[A-Z][A-Za-z'-]+)?[,!]?/g,
      "Hello [PERSON],",
    );

  for (const company of companyNames) {
    const escaped = company.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    if (escaped.length >= 2)
      sanitized = sanitized.replace(
        new RegExp(`(?<![A-Za-z0-9])${escaped}(?![A-Za-z0-9])`, "gi"),
        "[COMPANY]",
      );
  }

  sanitized = sanitized
    .replace(
      /\b(?:interviewer|recruiter|hiring manager|contact|candidate name|name)\s*[:\-]\s*[A-Z][A-Za-z'-]+(?:\s+[A-Z][A-Za-z'-]+){0,2}/g,
      (value) => `${value.split(/[:\-]/, 1)[0]}: [PERSON]`,
    )
    .replace(
      /\b[A-Z][a-z]{2,}(?:[-'][A-Z]?[a-z]+)?\s+[A-Z][a-z]{2,}(?:[-'][A-Z]?[a-z]+)?\b/g,
      "[PERSON]",
    );

  sanitized = sanitized.replace(/\s+/g, " ").trim().slice(0, 1_200);
  if (sanitized.length < 20)
    return { outcome: "blocked", reason: "sanitization_uncertain" };
  if (HIGH_RISK_PATTERNS.some((pattern) => pattern.test(sanitized)))
    return { outcome: "blocked", reason: "privacy_blocked" };
  if (RESIDUAL_IDENTIFIER_PATTERNS.some((pattern) => pattern.test(sanitized)))
    return { outcome: "blocked", reason: "sanitization_uncertain" };

  return { outcome: "allowed", excerpt: sanitized };
}

export function buildGeminiPayload(input: unknown): GeminiPayload {
  if (typeof input !== "object" || input === null || Array.isArray(input))
    throw new Error("invalid_payload");
  const record = input as Record<string, unknown>;
  const keys = Object.keys(record).sort();
  if (
    keys.length !== 2 ||
    keys[0] !== "locale" ||
    keys[1] !== "message_excerpt"
  )
    throw new Error("invalid_payload");
  if (record.locale !== "en") throw new Error("invalid_payload");
  if (
    typeof record.message_excerpt !== "string" ||
    record.message_excerpt.length < 20 ||
    record.message_excerpt.length > 1_200 ||
    HIGH_RISK_PATTERNS.some((pattern) =>
      pattern.test(record.message_excerpt),
    ) ||
    RESIDUAL_IDENTIFIER_PATTERNS.some((pattern) =>
      pattern.test(record.message_excerpt as string),
    )
  )
    throw new Error("invalid_payload");
  return { locale: "en", message_excerpt: record.message_excerpt };
}
