import type {
  ApplicationStatus,
  GeminiClassification,
  RecruitmentCategory,
} from "./types.ts";

const CATEGORIES: ReadonlySet<string> = new Set([
  "application_confirmation",
  "assessment_invitation",
  "interview_invitation",
  "document_request",
  "application_update",
  "offer",
  "rejection",
  "general_recruitment",
  "unrelated",
  "uncertain",
]);
const STATUSES: ReadonlySet<string> = new Set([
  "interested",
  "applied",
  "assessment",
  "interview",
  "offer",
  "accepted",
  "rejected",
  "withdrawn",
]);
const ACTIONS: ReadonlySet<string> = new Set([
  "complete_assessment",
  "confirm_interview",
  "provide_documents",
  "review_offer",
  "none",
]);
const EXPECTED_KEYS = [
  "action_type",
  "deadline",
  "email_category",
  "event_date",
  "is_recruitment_related",
  "needs_manual_review",
  "reason_code",
  "requires_action",
  "suggested_status",
].sort();

function isDateOrNull(value: unknown): value is string | null {
  if (value === null) return true;
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value))
    return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return (
    !Number.isNaN(parsed.getTime()) &&
    parsed.toISOString().slice(0, 10) === value
  );
}

export function parseGeminiClassification(raw: string): GeminiClassification {
  const parsed: unknown = JSON.parse(raw);
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed))
    throw new Error("invalid_ai_response");
  const value = parsed as Record<string, unknown>;
  if (
    JSON.stringify(Object.keys(value).sort()) !== JSON.stringify(EXPECTED_KEYS)
  )
    throw new Error("invalid_ai_response");
  if (
    typeof value.is_recruitment_related !== "boolean" ||
    typeof value.requires_action !== "boolean" ||
    typeof value.needs_manual_review !== "boolean" ||
    typeof value.reason_code !== "string" ||
    value.reason_code.length < 1 ||
    value.reason_code.length > 100 ||
    typeof value.email_category !== "string" ||
    !CATEGORIES.has(value.email_category) ||
    typeof value.action_type !== "string" ||
    !ACTIONS.has(value.action_type) ||
    !isDateOrNull(value.event_date) ||
    !isDateOrNull(value.deadline) ||
    !(
      value.suggested_status === null ||
      (typeof value.suggested_status === "string" &&
        STATUSES.has(value.suggested_status))
    )
  )
    throw new Error("invalid_ai_response");

  return {
    action_type: value.action_type as GeminiClassification["action_type"],
    deadline: value.deadline,
    email_category: value.email_category as RecruitmentCategory,
    event_date: value.event_date,
    is_recruitment_related: value.is_recruitment_related,
    needs_manual_review: value.needs_manual_review,
    reason_code: value.reason_code,
    requires_action: value.requires_action,
    suggested_status: value.suggested_status as ApplicationStatus | null,
  };
}

export function classificationIsActionable(
  value: GeminiClassification,
): boolean {
  if (
    !value.is_recruitment_related ||
    value.needs_manual_review ||
    !value.suggested_status
  )
    return false;
  const expected: Partial<
    Record<
      RecruitmentCategory,
      {
        action: GeminiClassification["action_type"];
        requiresAction: boolean;
        status: ApplicationStatus;
      }
    >
  > = {
    application_confirmation: {
      action: "none",
      requiresAction: false,
      status: "applied",
    },
    assessment_invitation: {
      action: "complete_assessment",
      requiresAction: true,
      status: "assessment",
    },
    interview_invitation: {
      action: "confirm_interview",
      requiresAction: true,
      status: "interview",
    },
    offer: { action: "review_offer", requiresAction: true, status: "offer" },
    rejection: { action: "none", requiresAction: false, status: "rejected" },
  };
  const rule = expected[value.email_category];
  if (!rule) return false;
  return (
    rule.status === value.suggested_status &&
    rule.action === value.action_type &&
    rule.requiresAction === value.requires_action
  );
}
