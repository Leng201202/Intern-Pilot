import type { SupabaseClient } from "npm:@supabase/supabase-js@2.117.3";

import { classificationIsActionable } from "./ai-response.ts";
import { createRequestBudget } from "./budget.ts";
import { decryptSecret } from "./crypto.ts";
import { booleanEnv, integerEnv, requiredEnv } from "./env.ts";
import { classifyRelevance } from "./filter.ts";
import { classifyWithGemini } from "./gemini.ts";
import {
  getCandidateMessage,
  listNewMessageIds,
  refreshGmailAccessToken,
} from "./gmail.ts";
import { matchApplication } from "./matcher.ts";
import { buildGeminiPayload, inspectAndSanitize } from "./privacy.ts";
import type {
  CandidateMessage,
  MatchableApplication,
  PriorThreadMatch,
} from "./types.ts";

type Connection = {
  encrypted_refresh_token: string;
  gmail_history_id: string | null;
  id: string;
  recovery_history_id: string | null;
  recovery_page_token: string | null;
  sync_after_at: string;
  user_id: string;
};

type SyncOutcome = {
  candidates: number;
  fetched: number;
  processed: number;
  reviews: number;
  status: "completed" | "partial";
};

function assertDatabaseSuccess(error: unknown): void {
  if (error) throw new Error("database_operation_failed");
}

function nextRetryAt(previousRetryCount: number): string {
  const delayMinutes = Math.min(60, 5 * 2 ** previousRetryCount);
  return new Date(Date.now() + delayMinutes * 60_000).toISOString();
}

async function setEventReview(
  admin: SupabaseClient,
  eventId: string,
  privacyOutcome: "allowed" | "blocked",
  applicationId: string | null,
  reasonCode: string,
  userId: string,
  suggestedStatus: string | null = null,
  suggestedDeadline: string | null = null,
  processingSource: "local_rule" | "gemini" = "local_rule",
): Promise<void> {
  const { data, error } = await admin.rpc("queue_review_item", {
    p_email_event_id: eventId,
    p_user_id: userId,
    p_privacy_outcome: privacyOutcome,
    p_application_id: applicationId,
    p_reason_code: reasonCode,
    p_processing_source: processingSource,
    p_suggested_status: suggestedStatus,
    p_suggested_deadline: suggestedDeadline,
  });
  if (error || !data?.queued) throw new Error("database_operation_failed");
}

async function processCandidate(
  admin: SupabaseClient,
  connection: Connection,
  message: CandidateMessage,
  applications: ReadonlyArray<MatchableApplication>,
  priorThreads: ReadonlyArray<PriorThreadMatch>,
  aiAllowed: boolean,
  claimAiRequest: () => boolean,
): Promise<"ignored" | "processed" | "review" | "retry"> {
  const { data: existing, error: existingError } = await admin
    .from("email_events")
    .select("id,processing_status,retry_count,next_retry_at")
    .eq("email_connection_id", connection.id)
    .eq("gmail_message_id", message.messageId)
    .maybeSingle();
  assertDatabaseSuccess(existingError);
  if (existing && !["retry", "pending"].includes(existing.processing_status))
    return "ignored";
  if (
    existing?.processing_status === "retry" &&
    existing.next_retry_at &&
    new Date(existing.next_retry_at).getTime() > Date.now()
  )
    return "retry";

  let eventId = existing?.id as string | undefined;
  let matchedApplicationId: string | null = null;
  if (!eventId) {
    const { data: inserted, error } = await admin
      .from("email_events")
      .insert({
        user_id: connection.user_id,
        email_connection_id: connection.id,
        gmail_message_id: message.messageId,
        gmail_thread_id: message.threadId,
        received_at: message.internalDate,
        processing_status: "pending",
        privacy_outcome: "not_evaluated",
      })
      .select("id")
      .single();
    if (error || !inserted)
      return error?.code === "23505" ? "ignored" : "retry";
    eventId = inserted.id;
  }

  try {
    const relevance = classifyRelevance(message);
    if (relevance === "irrelevant") {
      const { error } = await admin
        .from("email_events")
        .update({
          email_category: "unrelated",
          processing_status: "ignored",
          processing_source: "local_rule",
          privacy_outcome: "not_required",
          processed_at: new Date().toISOString(),
        })
        .eq("id", eventId);
      assertDatabaseSuccess(error);
      return "ignored";
    }

    const match = matchApplication(message, applications, priorThreads);
    if (match.kind !== "unique") {
      if (relevance === "uncertain" && match.kind === "none") {
        const { error } = await admin
          .from("email_events")
          .update({
            email_category: "unrelated",
            processing_status: "ignored",
            processing_source: "local_rule",
            privacy_outcome: "not_required",
            processed_at: new Date().toISOString(),
          })
          .eq("id", eventId);
        assertDatabaseSuccess(error);
        return "ignored";
      }
      await setEventReview(
        admin,
        eventId,
        "blocked",
        null,
        match.kind === "ambiguous"
          ? "ambiguous_match"
          : "unmatched_application",
        connection.user_id,
      );
      return "review";
    }
    matchedApplicationId = match.applicationId;

    const privacy = inspectAndSanitize(
      `${message.subject}\n${message.bodyText}`,
      applications.map((application) => application.company_name),
    );
    if (privacy.outcome === "blocked") {
      await setEventReview(
        admin,
        eventId,
        "blocked",
        match.applicationId,
        privacy.reason,
        connection.user_id,
      );
      return "review";
    }

    const { error: privacyUpdateError } = await admin
      .from("email_events")
      .update({
        application_id: match.applicationId,
        privacy_outcome: "allowed",
      })
      .eq("id", eventId);
    assertDatabaseSuccess(privacyUpdateError);

    if (!aiAllowed) {
      await setEventReview(
        admin,
        eventId,
        "allowed",
        match.applicationId,
        "ai_disabled",
        connection.user_id,
      );
      return "review";
    }

    if (!claimAiRequest()) {
      const { error } = await admin
        .from("email_events")
        .update({
          processing_status: "retry",
          retry_count: (existing?.retry_count ?? 0) + 1,
          next_retry_at: nextRetryAt(existing?.retry_count ?? 0),
        })
        .eq("id", eventId);
      assertDatabaseSuccess(error);
      return "retry";
    }

    const payload = buildGeminiPayload({
      message_excerpt: privacy.excerpt,
      locale: "en",
    });
    const classification = await classifyWithGemini(payload);
    const storedCategory =
      classification.email_category === "uncertain"
        ? "unknown"
        : classification.email_category;
    const { error: categoryError } = await admin
      .from("email_events")
      .update({ email_category: storedCategory })
      .eq("id", eventId);
    assertDatabaseSuccess(categoryError);

    if (!classificationIsActionable(classification)) {
      if (
        !classification.is_recruitment_related &&
        classification.email_category === "unrelated"
      ) {
        const { error } = await admin
          .from("email_events")
          .update({
            processing_status: "ignored",
            processing_source: "gemini",
            processed_at: new Date().toISOString(),
          })
          .eq("id", eventId);
        assertDatabaseSuccess(error);
        return "ignored";
      }
      await setEventReview(
        admin,
        eventId,
        "allowed",
        match.applicationId,
        "unknown_outcome",
        connection.user_id,
        classification.suggested_status,
        classification.deadline,
        "gemini",
      );
      return "review";
    }

    const { data: result, error } = await admin.rpc("apply_ai_email_event", {
      p_email_event_id: eventId,
      p_application_id: match.applicationId,
      p_new_status: classification.suggested_status,
      p_deadline: classification.deadline,
    });
    assertDatabaseSuccess(error);
    if (!result?.applied) {
      const reason = ["stale_event", "invalid_deadline"].includes(
        String(result?.reason),
      )
        ? result?.reason === "stale_event"
          ? "stale_event"
          : "unknown_outcome"
        : "conflicting_status";
      await setEventReview(
        admin,
        eventId,
        "allowed",
        match.applicationId,
        reason,
        connection.user_id,
        classification.suggested_status,
        classification.deadline,
        "gemini",
      );
      return "review";
    }

    if (classification.requires_action && classification.deadline) {
      const { error } = await admin.from("follow_ups").upsert(
        {
          user_id: connection.user_id,
          application_id: match.applicationId,
          kind: "action_deadline",
          due_at: `${classification.deadline}T00:00:00Z`,
          source_activity_at: message.internalDate,
        },
        {
          onConflict: "application_id,kind,source_activity_at",
          ignoreDuplicates: true,
        },
      );
      assertDatabaseSuccess(error);
    }
    return "processed";
  } catch (error) {
    const reason = error instanceof Error ? error.message : "processing_failed";
    if (reason === "database_operation_failed") throw error;
    if (reason === "invalid_ai_response") {
      await setEventReview(
        admin,
        eventId,
        "allowed",
        matchedApplicationId,
        "invalid_ai_response",
        connection.user_id,
        null,
        null,
        "gemini",
      );
      return "review";
    }
    const retryCount = (existing?.retry_count ?? 0) + 1;
    if (retryCount >= 3) {
      await setEventReview(
        admin,
        eventId,
        "allowed",
        matchedApplicationId,
        "provider_unavailable",
        connection.user_id,
        null,
        null,
        "gemini",
      );
      return "review";
    }
    const { error: retryError } = await admin
      .from("email_events")
      .update({
        processing_status: "retry",
        retry_count: retryCount,
        next_retry_at: nextRetryAt(existing?.retry_count ?? 0),
      })
      .eq("id", eventId);
    assertDatabaseSuccess(retryError);
    return "retry";
  }
}

export async function runConnectionSync(
  admin: SupabaseClient,
  connection: Connection,
): Promise<SyncOutcome> {
  const refreshToken = await decryptSecret(
    connection.encrypted_refresh_token,
    requiredEnv("GMAIL_TOKEN_ENCRYPTION_KEY"),
  );
  const accessToken = await refreshGmailAccessToken(refreshToken);
  const maxMessages = integerEnv("GMAIL_MAX_MESSAGES_PER_SYNC", 50, 1, 100);
  const listing = await listNewMessageIds(
    accessToken,
    connection.gmail_history_id,
    connection.sync_after_at,
    maxMessages,
    connection.recovery_page_token,
    connection.recovery_history_id,
  );
  const messages: CandidateMessage[] = [];
  for (const id of listing.ids)
    messages.push(await getCandidateMessage(accessToken, id));
  messages.sort((left, right) =>
    left.internalDate.localeCompare(right.internalDate),
  );

  const [applicationsResult, priorThreadsResult, profileResult] =
    await Promise.all([
      admin
        .from("applications")
        .select("id,company_name,position_title,status")
        .eq("user_id", connection.user_id),
      admin
        .from("email_events")
        .select("gmail_thread_id,application_id")
        .eq("user_id", connection.user_id)
        .not("application_id", "is", null),
      admin
        .from("profiles")
        .select("ai_risk_acknowledged_at")
        .eq("user_id", connection.user_id)
        .maybeSingle(),
    ]);
  assertDatabaseSuccess(applicationsResult.error);
  assertDatabaseSuccess(priorThreadsResult.error);
  assertDatabaseSuccess(profileResult.error);
  const applications = applicationsResult.data;
  const priorThreads = priorThreadsResult.data;
  const profile = profileResult.data;
  const aiAllowed =
    booleanEnv("AI_EMAIL_ANALYSIS_ENABLED", false) &&
    booleanEnv("AI_REAL_EMAIL_RISK_ACCEPTED", false) &&
    Boolean(profile?.ai_risk_acknowledged_at);
  const claimAiRequest = createRequestBudget(
    integerEnv("AI_MAX_REQUESTS_PER_SYNC", 20, 1, 50),
  );

  let processed = 0;
  let reviews = 0;
  let candidates = 0;
  let retry = false;
  for (const message of messages) {
    const outcome = await processCandidate(
      admin,
      connection,
      message,
      (applications ?? []) as MatchableApplication[],
      (priorThreads ?? []) as PriorThreadMatch[],
      aiAllowed,
      claimAiRequest,
    );
    if (outcome !== "ignored") candidates += 1;
    if (outcome === "processed") processed += 1;
    if (outcome === "review") reviews += 1;
    if (outcome === "retry") retry = true;
  }

  if (!retry && listing.recovery && listing.nextPageToken) {
    const { error } = await admin
      .from("email_connections")
      .update({
        recovery_page_token: listing.nextPageToken,
        recovery_history_id: listing.recoveryHistoryId,
        last_successful_sync_at: new Date().toISOString(),
        sync_status: "connected",
      })
      .eq("id", connection.id);
    assertDatabaseSuccess(error);
    return {
      candidates,
      fetched: messages.length,
      processed,
      reviews,
      status: "partial",
    };
  }

  if (!retry) {
    const nextHistoryId = listing.recovery
      ? listing.recoveryHistoryId
      : listing.historyId;
    const { error } = await admin
      .from("email_connections")
      .update({
        gmail_history_id: nextHistoryId,
        recovery_page_token: null,
        recovery_history_id: null,
        last_successful_sync_at: new Date().toISOString(),
        sync_status: "connected",
      })
      .eq("id", connection.id);
    assertDatabaseSuccess(error);
  }
  return {
    candidates,
    fetched: messages.length,
    processed,
    reviews,
    status: retry ? "partial" : "completed",
  };
}
