import { config } from "../config";

export interface WebhookChallengeQuery {
  "hub.mode"?: string;
  "hub.verify_token"?: string;
  "hub.challenge"?: string;
}

/**
 * Handles Meta's GET webhook verification handshake.
 * Returns the challenge string on success, or null on failure.
 */
export function handleWebhookVerification(query: WebhookChallengeQuery): string | null {
  const mode = query["hub.mode"];
  const token = query["hub.verify_token"];
  const challenge = query["hub.challenge"];

  if (mode === "subscribe" && token === config.META_VERIFY_TOKEN && challenge) {
    return challenge;
  }

  return null;
}
