import {
  GoogleGenAI,
  type Content,
  type Part,
} from "@google/genai";
import { config } from "../config";
import { saveLead } from "../leads/saveLead";
import type { Channel, StoredMessage } from "../types";
import { SALES_SYSTEM_PROMPT } from "./systemPrompt";
import {
  parseSaveLeadArgs,
  SAVE_LEAD_TOOL_NAME,
  saveLeadFunctionDeclaration,
} from "./tools";

const FALLBACK_REPLY =
  "Sorry — I'm having a brief technical issue. Could you send that again in a moment?";

const MAX_TOOL_ROUNDS = 3;

function toGeminiContents(history: StoredMessage[]): Content[] {
  return history
    .filter((m) => m.role === "user" || m.role === "assistant")
    .map((m) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }],
    }));
}

export async function generateSalesReply(params: {
  contactId: string;
  channel: Channel;
  history: StoredMessage[];
}): Promise<string> {
  if (!config.GEMINI_API_KEY) {
    console.error("GEMINI_API_KEY is not configured");
    return FALLBACK_REPLY;
  }

  try {
    const ai = new GoogleGenAI({ apiKey: config.GEMINI_API_KEY });
    const contents = toGeminiContents(params.history);

    for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
      const response = await ai.models.generateContent({
        model: config.GEMINI_MODEL,
        contents,
        config: {
          systemInstruction: SALES_SYSTEM_PROMPT,
          tools: [{ functionDeclarations: [saveLeadFunctionDeclaration] }],
          temperature: 0.7,
        },
      });

      const functionCalls = response.functionCalls;
      if (functionCalls?.length) {
        const modelParts: Part[] = [];
        const toolParts: Part[] = [];

        for (const call of functionCalls) {
          const name = call.name ?? "";
          const args = call.args ?? {};
          modelParts.push({
            functionCall: {
              name,
              args: args as Record<string, unknown>,
            },
          });

          let resultPayload: Record<string, unknown>;
          if (name === SAVE_LEAD_TOOL_NAME) {
            const leadArgs = parseSaveLeadArgs(args);
            const { lead, deduplicated } = await saveLead(
              params.contactId,
              params.channel,
              leadArgs,
            );
            resultPayload = {
              ok: Boolean(lead),
              deduplicated,
              leadId: lead?.id ?? null,
            };
            console.log(
              `Lead tool: contact=${params.contactId} ok=${resultPayload.ok} dedup=${deduplicated}`,
            );
          } else {
            resultPayload = { ok: false, error: `Unknown tool: ${name}` };
          }

          toolParts.push({
            functionResponse: {
              name,
              response: resultPayload,
            },
          });
        }

        contents.push({ role: "model", parts: modelParts });
        contents.push({ role: "user", parts: toolParts });
        continue;
      }

      const text = response.text?.trim();
      if (text) {
        return text;
      }

      // No text and no function calls — stop looping
      break;
    }

    console.warn("Gemini returned empty response; using fallback");
    return FALLBACK_REPLY;
  } catch (err) {
    console.error("Gemini orchestration failed:", err);
    return FALLBACK_REPLY;
  }
}

export { FALLBACK_REPLY };
