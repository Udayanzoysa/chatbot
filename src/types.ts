export type Channel = "whatsapp" | "messenger" | "instagram";

export type MessageRole = "user" | "assistant" | "system";

export interface IncomingMessage {
  channel: Channel;
  externalId: string;
  text: string;
  displayName?: string;
  raw: unknown;
}

export interface Contact {
  id: string;
  channel: Channel;
  external_id: string;
  display_name: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface StoredMessage {
  id: string;
  contact_id: string;
  role: MessageRole;
  content: string;
  raw_payload: unknown | null;
  created_at: Date;
}

export interface LeadInput {
  name?: string;
  email?: string;
  phone?: string;
  intent?: string;
}

export interface LeadRecord extends LeadInput {
  id: string;
  contact_id: string;
  source_channel: Channel;
  created_at: Date;
}
