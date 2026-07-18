import { assertMetaSendConfigured, config } from "../config";
import type { Channel } from "../types";

const GRAPH_API_VERSION = "v21.0";
const GRAPH_BASE = `https://graph.facebook.com/${GRAPH_API_VERSION}`;

export async function sendMetaMessage(
  channel: Channel,
  recipientId: string,
  text: string,
): Promise<void> {
  assertMetaSendConfigured(channel);

  if (channel === "whatsapp") {
    await sendWhatsApp(recipientId, text);
    return;
  }

  // Messenger and Instagram Messaging both use the Page Send API
  await sendMessengerStyle(recipientId, text);
}

async function sendWhatsApp(to: string, text: string): Promise<void> {
  const url = `${GRAPH_BASE}/${config.WHATSAPP_PHONE_NUMBER_ID}/messages`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.WHATSAPP_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to,
      type: "text",
      text: { preview_url: false, body: text },
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`WhatsApp send failed (${res.status}): ${body}`);
  }
}

async function sendMessengerStyle(recipientId: string, text: string): Promise<void> {
  const url = `${GRAPH_BASE}/me/messages`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.META_PAGE_ACCESS_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      recipient: { id: recipientId },
      messaging_type: "RESPONSE",
      message: { text },
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Messenger/Instagram send failed (${res.status}): ${body}`);
  }
}
