import type {
  CandidateMessage,
  MatchResult,
  MatchableApplication,
  PriorThreadMatch,
} from "./types.ts";

function normalized(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[^a-zA-Z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLocaleLowerCase();
}

function includesMeaningful(haystack: string, needle: string): boolean {
  const words = normalized(needle)
    .split(" ")
    .filter((word) => word.length >= 3);
  return words.length > 0 && words.every((word) => haystack.includes(word));
}

export function matchApplication(
  message: CandidateMessage,
  applications: ReadonlyArray<MatchableApplication>,
  priorThreads: ReadonlyArray<PriorThreadMatch>,
): MatchResult {
  if (message.threadId) {
    const established = new Set(
      priorThreads
        .filter((item) => item.gmail_thread_id === message.threadId)
        .flatMap((item) => (item.application_id ? [item.application_id] : [])),
    );
    if (established.size === 1)
      return { kind: "unique", applicationId: [...established][0]! };
    if (established.size > 1) return { kind: "ambiguous" };
  }

  const searchable = normalized(
    `${message.from} ${message.subject} ${message.bodyText.slice(0, 6_000)}`,
  );
  const scored = applications
    .map((application) => {
      const company = includesMeaningful(searchable, application.company_name);
      const position = includesMeaningful(
        searchable,
        application.position_title,
      );
      return { application, score: Number(company) + Number(position) * 2 };
    })
    .filter((item) => item.score >= 2)
    .sort((a, b) => b.score - a.score);

  if (scored.length === 0) return { kind: "none" };
  if (scored.length > 1 && scored[0]!.score === scored[1]!.score)
    return { kind: "ambiguous" };
  return { kind: "unique", applicationId: scored[0]!.application.id };
}
