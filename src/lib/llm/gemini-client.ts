import {
  VertexAI,
  HarmCategory,
  HarmBlockThreshold,
} from "@google-cloud/vertexai";
import { GIRLFRIEND_SYSTEM_PROMPT } from "./prompts";
import type { ChatMessage } from "@/types";

const PROJECT_ID = process.env.GOOGLE_CLOUD_PROJECT || "";
const LOCATION = "us-central1";
const MODEL = "gemini-2.0-flash-001";

let vertexAI: VertexAI | null = null;

function getVertexAI() {
  if (!vertexAI) {
    vertexAI = new VertexAI({ project: PROJECT_ID, location: LOCATION });
  }
  return vertexAI;
}

export async function generateChatResponse(
  message: string,
  history: ChatMessage[]
): Promise<string> {
  const ai = getVertexAI();
  const model = ai.getGenerativeModel({
    model: MODEL,
    safetySettings: [
      {
        category: HarmCategory.HARM_CATEGORY_HARASSMENT,
        threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH,
      },
      {
        category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
        threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH,
      },
    ],
    systemInstruction: {
      role: "system",
      parts: [{ text: GIRLFRIEND_SYSTEM_PROMPT }],
    },
  });

  const chatHistory = history.map((msg) => ({
    role: msg.role === "user" ? "user" : "model",
    parts: [{ text: msg.content }],
  }));

  const chat = model.startChat({
    history: chatHistory,
  });

  const result = await chat.sendMessage(message);
  const response = result.response;
  const text =
    response.candidates?.[0]?.content?.parts?.[0]?.text || "[emotion: neutral] ...";

  return text;
}
