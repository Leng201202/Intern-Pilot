# Provider Policy Review — Gmail and Gemini

**Reviewed:** 16 October 2026

**Decision:** eligible for paid-service, synthetic-only Gemini staging after informed consent; real Gmail-to-Gemini processing remains separately gated

## Gmail OAuth

`https://www.googleapis.com/auth/gmail.readonly` is currently classified by Google as a restricted scope. Depending on the OAuth audience and whether restricted-scope data is stored or transmitted through servers, Google verification and an annual security assessment may apply. A personal testing deployment should keep the consent screen in testing and allow only the intended owner until obligations are resolved.

For an external Google app in Testing status, a refresh token that includes Gmail scopes normally expires after seven days. Testing mode is appropriate for synthetic staging but is not a stable long-running production connection. A production release also needs the required public disclosures, consent immediately before data access, data-deletion instructions, and an affirmative Google Limited Use statement.

The implementation requests only Gmail read-only plus OpenID identity scopes, uses state and PKCE, encrypts refresh tokens, starts from a new-only checkpoint, and supports revocation/disconnect. These controls reduce risk but do not change Google's scope classification.

References:

- [Gmail API scopes](https://developers.google.com/workspace/gmail/api/auth/scopes)
- [OAuth app verification](https://support.google.com/cloud/answer/13464325?hl=en)
- [Restricted-scope security assessment](https://support.google.com/cloud/answer/13464321?hl=en)
- [OAuth 2.0 best practices](https://developers.google.com/identity/protocols/oauth2/resources/best-practices)
- [OAuth 2.0 authorization and testing-token lifetime](https://developers.google.com/identity/protocols/oauth2)
- [Google Workspace user-data policy](https://developers.google.com/workspace/workspace-api-user-data-developer-policy)

## Gemini data use

Current Gemini API terms distinguish unpaid and paid services. Unpaid-service submissions may be used to improve Google products and may be reviewed by humans; the terms warn against submitting sensitive, confidential, or personal information. Paid services state that prompts and responses are not used to improve products, but prompts and responses may still be logged for a limited period for abuse monitoring and required legal or regulatory disclosures. Guaranteed zero data retention is a separate capability with eligibility and model restrictions.

Google's current Workspace policy lists productivity enhancements and user-benefiting reporting or monitoring based on Gmail data as approved use cases. It permits a transfer needed to provide a visible user-facing feature only with the user's consent, and it prohibits using Workspace data to train or improve a general AI model. The paid Gemini terms and InternPilot's single-purpose classification flow appear compatible with those conditions, but this is a documented engineering assessment rather than legal advice or a provider approval. The disclosure and consent must remain accurate, prominent, and revocable.

For the 16 October 2026 staging review, `gemini-3.8-flash` is Google's current stable Flash endpoint and supports structured output. Model availability, billing status, region, retention, and terms must still be checked in the actual Cloud project before installing the key.

Google AI Studio now creates authorization keys bound to a service account, and Google's migration schedule rejects legacy standard keys after September 2026. Create a new dedicated Gemini authorization key in AI Studio; do not reuse the Gmail OAuth client, a browser key, or an older unrestricted standard key.

Recruitment correspondence can contain personal and confidential data. Therefore:

- Never enable this workflow on unpaid Gemini services.
- Use a paid project only after confirming the selected model, region, retention, and account terms.
- Keep the transfer limited to the disclosed, user-facing classification feature and preserve affirmative, revocable consent. If the actual account terms or qualified review do not permit this exact use, keep Gemini disabled.
- Never claim that sanitization anonymizes perfectly or that provider retention is zero unless the configured service contract explicitly guarantees it.

References:

- [Gemini API additional terms](https://ai.google.dev/gemini-api/terms)
- [Gemini API zero data retention](https://ai.google.dev/gemini-api/docs/zdr)
- [Gemini API models](https://ai.google.dev/gemini-api/docs/models)
- [Gemini structured output](https://ai.google.dev/gemini-api/docs/structured-output)
- [Gemini API keys](https://ai.google.dev/gemini-api/docs/api-key)

## Release decision record

The backend requires all three independent gates:

1. `AI_EMAIL_ANALYSIS_ENABLED=true`
2. `AI_REAL_EMAIL_RISK_ACCEPTED=true`
3. `profiles.ai_risk_acknowledged_at` is set by the owner

The first two are server-side secrets/configuration. The third is an informed acknowledgement, not a privacy override. Any failed filter, ambiguous application match, uncertain sanitization, high-risk content, invalid model response, stale event, or conflicting transition still fails closed to manual review.

Automated redaction cannot guarantee complete privacy. Keep both server-side AI gates `false` until the paid account and model are verified, synthetic staging is ready, and the operator explicitly accepts the remaining risk in the application. Limited real-email testing requires a separate explicit authorization after staging passes.
