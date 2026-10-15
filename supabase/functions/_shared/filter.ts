import type { CandidateMessage } from "./types.ts";

const RECRUITMENT_TERMS = [
  "application",
  "assessment",
  "candidate",
  "interview",
  "intern",
  "offer",
  "recruit",
  "selection process",
] as const;

const EVENT_TERMS = [
  "assessment",
  "interview",
  "offer",
  "rejection",
  "shortlisted",
  "next step",
  "thank you for applying",
] as const;

const PROMOTIONAL_TERMS = [
  "job alert",
  "jobs you may be interested in",
  "recommended jobs",
  "weekly digest",
  "newsletter",
  "unsubscribe",
  "sponsored",
] as const;

function containsAny(value: string, terms: ReadonlyArray<string>): boolean {
  return terms.some((term) => value.includes(term));
}

export type Relevance = "candidate" | "irrelevant" | "uncertain";

export function classifyRelevance(message: CandidateMessage): Relevance {
  const subject = message.subject.toLocaleLowerCase();
  const body = message.bodyText.slice(0, 4_000).toLocaleLowerCase();
  const combined = `${subject}\n${body}`;
  const listHeader = message.headers["list-unsubscribe"] ?? "";
  const precedence = (message.headers.precedence ?? "").toLocaleLowerCase();
  const hasRecruitmentEvent = containsAny(combined, EVENT_TERMS);
  const hasRecruitmentSignal = containsAny(combined, RECRUITMENT_TERMS);
  const looksBulk =
    Boolean(listHeader) || ["bulk", "list", "junk"].includes(precedence);
  const looksPromotional = containsAny(combined, PROMOTIONAL_TERMS);

  // Event language wins over platform/bulk signals so genuine recruiter
  // correspondence delivered through an ATS is not blanket-blocked.
  if (hasRecruitmentEvent) return "candidate";
  if ((looksBulk || looksPromotional) && !hasRecruitmentSignal)
    return "irrelevant";
  if (looksPromotional && !hasRecruitmentEvent) return "irrelevant";
  if (hasRecruitmentSignal) return "candidate";
  return "uncertain";
}
