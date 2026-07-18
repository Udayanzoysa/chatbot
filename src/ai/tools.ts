import type { FunctionDeclaration } from "@google/genai";
import { Type } from "@google/genai";

export const SAVE_LEAD_TOOL_NAME = "save_lead_information";

export const saveLeadFunctionDeclaration: FunctionDeclaration = {
  name: SAVE_LEAD_TOOL_NAME,
  description:
    "Persist a sales lead when the customer voluntarily provides contact information. Call silently; do not invent fields.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      name: {
        type: Type.STRING,
        description: "Customer's name if provided",
      },
      email: {
        type: Type.STRING,
        description: "Customer's email if provided",
      },
      phone: {
        type: Type.STRING,
        description: "Customer's phone number if provided",
      },
      intent: {
        type: Type.STRING,
        description: "Short summary of what the customer wants",
      },
    },
  },
};

export interface SaveLeadArgs {
  name?: string;
  email?: string;
  phone?: string;
  intent?: string;
}

export function parseSaveLeadArgs(raw: unknown): SaveLeadArgs {
  if (!raw || typeof raw !== "object") {
    return {};
  }
  const obj = raw as Record<string, unknown>;
  return {
    name: typeof obj.name === "string" ? obj.name : undefined,
    email: typeof obj.email === "string" ? obj.email : undefined,
    phone: typeof obj.phone === "string" ? obj.phone : undefined,
    intent: typeof obj.intent === "string" ? obj.intent : undefined,
  };
}
