import { Router, type Request, type Response } from "express";
import { generateSalesReply } from "../ai/gemini";
import { inboundRateLimiter } from "../middleware/rateLimit";
import { parseWebhookPayload } from "../meta/parseWebhook";
import { sendMetaMessage } from "../meta/sendMessage";
import { verifyMetaSignature } from "../meta/signature";
import { handleWebhookVerification } from "../meta/verifyWebhook";
import { appendMessage, getRecentMessages, upsertContact } from "../session/history";
import type { IncomingMessage } from "../types";

export const webhookRouter = Router();

webhookRouter.get("/", (req: Request, res: Response) => {
  const challenge = handleWebhookVerification({
    "hub.mode": typeof req.query["hub.mode"] === "string" ? req.query["hub.mode"] : undefined,
    "hub.verify_token":
      typeof req.query["hub.verify_token"] === "string" ? req.query["hub.verify_token"] : undefined,
    "hub.challenge":
      typeof req.query["hub.challenge"] === "string" ? req.query["hub.challenge"] : undefined,
  });

  if (challenge) {
    console.log("Meta webhook verified successfully");
    res.status(200).send(challenge);
    return;
  }

  res.sendStatus(403);
});

webhookRouter.post("/", (req: Request, res: Response) => {
  const rawBody = (req as Request & { rawBody?: Buffer }).rawBody;
  const signature = req.get("x-hub-signature-256") ?? undefined;

  if (!rawBody || !verifyMetaSignature(rawBody, signature)) {
    console.warn("Rejected webhook: invalid signature");
    res.sendStatus(403);
    return;
  }

  // Acknowledge immediately — Meta retries on slow responses
  res.sendStatus(200);

  const messages = parseWebhookPayload(req.body);
  if (!messages.length) {
    return;
  }

  void processIncomingMessages(messages).catch((err) => {
    console.error("Failed processing webhook messages:", err);
  });
});

async function processIncomingMessages(messages: IncomingMessage[]): Promise<void> {
  for (const msg of messages) {
    const rateKey = `${msg.channel}:${msg.externalId}`;
    if (!inboundRateLimiter.allow(rateKey)) {
      console.warn(`Rate limited ${rateKey}`);
      continue;
    }

    try {
      await handleOneMessage(msg);
    } catch (err) {
      console.error(`Error handling message from ${rateKey}:`, err);
    }
  }
}

async function handleOneMessage(msg: IncomingMessage): Promise<void> {
  const contact = await upsertContact(msg);
  await appendMessage(contact.id, "user", msg.text, msg.raw);

  const history = await getRecentMessages(contact.id);
  const reply = await generateSalesReply({
    contactId: contact.id,
    channel: msg.channel,
    history,
  });

  await appendMessage(contact.id, "assistant", reply);
  await sendMetaMessage(msg.channel, msg.externalId, reply);

  console.log(
    `Replied on ${msg.channel} to ${redactId(msg.externalId)} (${reply.length} chars)`,
  );
}

function redactId(id: string): string {
  if (id.length <= 4) return "****";
  return `${id.slice(0, 2)}…${id.slice(-2)}`;
}
