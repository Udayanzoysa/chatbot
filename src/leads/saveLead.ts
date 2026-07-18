import { pool } from "../db/pool";
import type { Channel, LeadInput, LeadRecord } from "../types";

/**
 * Saves a lead. Skips insert if the same contact already has a lead with the
 * same email or phone within the last 24 hours.
 */
export async function saveLead(
  contactId: string,
  sourceChannel: Channel,
  input: LeadInput,
): Promise<{ lead: LeadRecord | null; deduplicated: boolean }> {
  const email = input.email?.trim() || null;
  const phone = input.phone?.trim() || null;
  const name = input.name?.trim() || null;
  const intent = input.intent?.trim() || null;

  if (!email && !phone && !name) {
    return { lead: null, deduplicated: false };
  }

  if (email || phone) {
    const existing = await pool.query<LeadRecord>(
      `
      SELECT *
      FROM leads
      WHERE contact_id = $1
        AND created_at > NOW() - INTERVAL '24 hours'
        AND (
          ($2::text IS NOT NULL AND lower(email) = lower($2))
          OR ($3::text IS NOT NULL AND phone = $3)
        )
      ORDER BY created_at DESC
      LIMIT 1
      `,
      [contactId, email, phone],
    );

    if (existing.rows[0]) {
      return { lead: existing.rows[0], deduplicated: true };
    }
  }

  const inserted = await pool.query<LeadRecord>(
    `
    INSERT INTO leads (contact_id, name, email, phone, intent, source_channel)
    VALUES ($1, $2, $3, $4, $5, $6)
    RETURNING *
    `,
    [contactId, name, email, phone, intent, sourceChannel],
  );

  return { lead: inserted.rows[0], deduplicated: false };
}
