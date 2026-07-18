import { pool } from "../db/pool";
import type { Channel, Contact, IncomingMessage, MessageRole, StoredMessage } from "../types";

const HISTORY_LIMIT = 15;

export async function upsertContact(msg: IncomingMessage): Promise<Contact> {
  const result = await pool.query<Contact>(
    `
    INSERT INTO contacts (channel, external_id, display_name)
    VALUES ($1, $2, $3)
    ON CONFLICT (channel, external_id)
    DO UPDATE SET
      display_name = COALESCE(EXCLUDED.display_name, contacts.display_name),
      updated_at = NOW()
    RETURNING *
    `,
    [msg.channel, msg.externalId, msg.displayName ?? null],
  );
  return result.rows[0];
}

export async function appendMessage(
  contactId: string,
  role: MessageRole,
  content: string,
  rawPayload?: unknown,
): Promise<StoredMessage> {
  const result = await pool.query<StoredMessage>(
    `
    INSERT INTO messages (contact_id, role, content, raw_payload)
    VALUES ($1, $2, $3, $4)
    RETURNING *
    `,
    [contactId, role, content, rawPayload ? JSON.stringify(rawPayload) : null],
  );
  return result.rows[0];
}

export async function getRecentMessages(contactId: string, limit = HISTORY_LIMIT): Promise<StoredMessage[]> {
  const result = await pool.query<StoredMessage>(
    `
    SELECT * FROM (
      SELECT id, contact_id, role, content, raw_payload, created_at
      FROM messages
      WHERE contact_id = $1
      ORDER BY created_at DESC
      LIMIT $2
    ) recent
    ORDER BY created_at ASC
    `,
    [contactId, limit],
  );
  return result.rows;
}

export async function getContactById(id: string): Promise<Contact | null> {
  const result = await pool.query<Contact>(`SELECT * FROM contacts WHERE id = $1`, [id]);
  return result.rows[0] ?? null;
}

export type { Channel };
