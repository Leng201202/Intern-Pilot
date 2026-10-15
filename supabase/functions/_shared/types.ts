export type ApplicationStatus =
  | "interested"
  | "applied"
  | "assessment"
  | "interview"
  | "offer"
  | "accepted"
  | "rejected"
  | "withdrawn";

export type RecruitmentCategory =
  | "application_confirmation"
  | "assessment_invitation"
  | "interview_invitation"
  | "document_request"
  | "application_update"
  | "offer"
  | "rejection"
  | "general_recruitment"
  | "unrelated"
  | "uncertain";

export type CandidateMessage = {
  bodyText: string;
  from: string;
  hasAttachments: boolean;
  headers: Readonly<{
    "list-unsubscribe"?: string;
    precedence?: string;
  }>;
  internalDate: string;
  messageId: string;
  subject: string;
  threadId: string | null;
};

export type MatchableApplication = {
  company_name: string;
  id: string;
  position_title: string;
  status: ApplicationStatus;
};

export type PriorThreadMatch = {
  application_id: string | null;
  gmail_thread_id: string | null;
};

export type MatchResult =
  | { kind: "unique"; applicationId: string }
  | { kind: "ambiguous" }
  | { kind: "none" };

export type PrivacyResult =
  | { outcome: "allowed"; excerpt: string }
  | {
      outcome: "blocked";
      reason: "privacy_blocked" | "sanitization_uncertain";
    };

export type GeminiPayload = {
  locale: "en";
  message_excerpt: string;
};

export type GeminiClassification = {
  action_type:
    | "complete_assessment"
    | "confirm_interview"
    | "provide_documents"
    | "review_offer"
    | "none";
  deadline: string | null;
  email_category: RecruitmentCategory;
  event_date: string | null;
  is_recruitment_related: boolean;
  needs_manual_review: boolean;
  reason_code: string;
  requires_action: boolean;
  suggested_status: ApplicationStatus | null;
};
