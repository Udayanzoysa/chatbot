import type { Channel, IncomingMessage } from "../types";

interface WhatsAppChangeValue {
  messaging_product?: string;
  metadata?: { phone_number_id?: string };
  contacts?: Array<{ profile?: { name?: string }; wa_id?: string }>;
  messages?: Array<{
    from?: string;
    id?: string;
    timestamp?: string;
    type?: string;
    text?: { body?: string };
    button?: { text?: string };
    interactive?: {
      type?: string;
      button_reply?: { title?: string };
      list_reply?: { title?: string };
    };
  }>;
  statuses?: unknown[];
}

interface MessengerMessagingEvent {
  sender?: { id?: string };
  recipient?: { id?: string };
  timestamp?: number;
  message?: {
    mid?: string;
    text?: string;
    is_echo?: boolean;
    attachments?: unknown[];
  };
  postback?: {
    payload?: string;
    title?: string;
  };
  delivery?: unknown;
  read?: unknown;
}

/**
 * Normalizes WhatsApp Cloud API, Messenger, and Instagram webhook payloads
 * into a shared IncomingMessage list.
 */
export function parseWebhookPayload(body: unknown): IncomingMessage[] {
  if (!body || typeof body !== "object") {
    return [];
  }

  const payload = body as {
    object?: string;
    entry?: unknown[];
  };

  const objectType = payload.object;
  const entries = Array.isArray(payload.entry) ? payload.entry : [];
  const results: IncomingMessage[] = [];

  for (const entry of entries) {
    if (!entry || typeof entry !== "object") continue;
    const e = entry as Record<string, unknown>;

    if (objectType === "whatsapp_business_account") {
      results.push(...parseWhatsAppEntry(e));
      continue;
    }

    // Messenger uses "page"; Instagram Messaging often uses "instagram"
    if (objectType === "page" || objectType === "instagram") {
      const channel: Channel = objectType === "instagram" ? "instagram" : "messenger";
      results.push(...parseMessengerStyleEntry(e, channel));
    }
  }

  return results;
}

function parseWhatsAppEntry(entry: Record<string, unknown>): IncomingMessage[] {
  const changes = Array.isArray(entry.changes) ? entry.changes : [];
  const out: IncomingMessage[] = [];

  for (const change of changes) {
    if (!change || typeof change !== "object") continue;
    const value = (change as { value?: WhatsAppChangeValue }).value;
    if (!value?.messages?.length) continue;

    const profileName = value.contacts?.[0]?.profile?.name;

    for (const msg of value.messages) {
      if (!msg.from) continue;

      const text = extractWhatsAppText(msg);
      if (!text) continue;

      out.push({
        channel: "whatsapp",
        externalId: msg.from,
        text,
        displayName: profileName,
        raw: msg,
      });
    }
  }

  return out;
}

function extractWhatsAppText(msg: NonNullable<WhatsAppChangeValue["messages"]>[number]): string | null {
  if (msg.type === "text" && msg.text?.body) {
    return msg.text.body.trim();
  }
  if (msg.button?.text) {
    return msg.button.text.trim();
  }
  if (msg.interactive?.button_reply?.title) {
    return msg.interactive.button_reply.title.trim();
  }
  if (msg.interactive?.list_reply?.title) {
    return msg.interactive.list_reply.title.trim();
  }
  return null;
}

function parseMessengerStyleEntry(
  entry: Record<string, unknown>,
  defaultChannel: Channel,
): IncomingMessage[] {
  const messaging = Array.isArray(entry.messaging) ? entry.messaging : [];
  const out: IncomingMessage[] = [];

  for (const event of messaging) {
    if (!event || typeof event !== "object") continue;
    const m = event as MessengerMessagingEvent;

    // Ignore delivery/read receipts and echo messages (prevents reply loops)
    if (m.delivery || m.read) continue;
    if (m.message?.is_echo) continue;

    const senderId = m.sender?.id;
    if (!senderId) continue;

    let text: string | null = null;
    if (m.message?.text) {
      text = m.message.text.trim();
    } else if (m.postback?.title || m.postback?.payload) {
      text = (m.postback.title || m.postback.payload || "").trim();
    }

    if (!text) continue;

    // Instagram events may arrive under object=page with an Instagram entry; keep defaultChannel
    // unless the entry explicitly looks like Instagram (has "id" matching IG page patterns).
    // Callers already set channel from payload.object; for page webhooks that mix IG,
    // Meta typically sends separate object=instagram payloads when IG product is configured.
    out.push({
      channel: defaultChannel,
      externalId: senderId,
      text,
      raw: m,
    });
  }

  return out;
}
