import { WebSocketServer, WebSocket } from "ws";
import { IncomingMessage } from "http";
import { startTranscribeStream, synthesizeSpeech } from "@/lib/voice/aws-pipeline";
import { generateChatResponse } from "@/lib/llm/gemini-client";
import type { ChatMessage, WebSocketMessage } from "@/types";

interface ClientState {
  ws: WebSocket;
  audioQueue: Uint8Array[];
  isStreaming: boolean;
  conversationHistory: ChatMessage[];
  audioStreamController: ReadableStreamDefaultController<Uint8Array> | null;
}

export function createWebSocketServer(port: number = 3001): WebSocketServer {
  const wss = new WebSocketServer({ port });

  wss.on("connection", (ws: WebSocket, _req: IncomingMessage) => {
    console.log("Client connected");

    const state: ClientState = {
      ws,
      audioQueue: [],
      isStreaming: false,
      conversationHistory: [],
      audioStreamController: null,
    };

    ws.on("message", async (data: Buffer) => {
      try {
        // Try to parse as JSON first
        const textData = data.toString("utf-8");
        let message: WebSocketMessage;

        try {
          message = JSON.parse(textData);
        } catch {
          // Binary audio data
          handleAudioChunk(state, new Uint8Array(data));
          return;
        }

        switch (message.type) {
          case "start-listening":
            await startAWSListening(state);
            break;
          case "stop-listening":
            stopListening(state);
            break;
          default:
            console.warn("Unknown message type:", message.type);
        }
      } catch (error) {
        console.error("WebSocket message error:", error);
        sendMessage(ws, {
          type: "error",
          data: "Internal server error",
        });
      }
    });

    ws.on("close", () => {
      console.log("Client disconnected");
      stopListening(state);
    });
  });

  console.log(`WebSocket server running on port ${port}`);
  return wss;
}

function handleAudioChunk(state: ClientState, audioData: Uint8Array) {
  if (state.audioStreamController) {
    state.audioStreamController.enqueue(audioData);
  }
}

async function startAWSListening(state: ClientState) {
  if (state.isStreaming) return;
  state.isStreaming = true;

  // Create a readable stream for audio input
  const audioStream = new ReadableStream<Uint8Array>({
    start(controller) {
      state.audioStreamController = controller;
    },
    cancel() {
      state.audioStreamController = null;
    },
  });

  // Convert ReadableStream to AsyncIterable
  async function* streamToAsyncIterable(stream: ReadableStream<Uint8Array>) {
    const reader = stream.getReader();
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        yield value;
      }
    } finally {
      reader.releaseLock();
    }
  }

  try {
    await startTranscribeStream(
      streamToAsyncIterable(audioStream),
      async (text: string, isFinal: boolean) => {
        sendMessage(state.ws, {
          type: "transcription",
          data: { text, isFinal },
        });

        if (isFinal && text.trim()) {
          // Generate AI response
          const userMessage: ChatMessage = {
            id: crypto.randomUUID(),
            role: "user",
            content: text,
            timestamp: Date.now(),
          };
          state.conversationHistory.push(userMessage);

          try {
            const responseText = await generateChatResponse(
              text,
              state.conversationHistory.slice(-20)
            );

            // Extract emotion
            const emotionMatch = responseText.match(/\[emotion:\s*(\w+)\]/);
            const emotion = emotionMatch ? emotionMatch[1] : "neutral";
            const cleanText = responseText.replace(
              /\[emotion:\s*\w+\]\s*/g,
              ""
            );

            sendMessage(state.ws, {
              type: "response-text",
              data: { text: cleanText, emotion },
            });

            sendMessage(state.ws, { type: "emotion", data: emotion });

            const aiMessage: ChatMessage = {
              id: crypto.randomUUID(),
              role: "assistant",
              content: cleanText,
              timestamp: Date.now(),
            };
            state.conversationHistory.push(aiMessage);

            // Synthesize speech
            const audioBuffer = await synthesizeSpeech(cleanText);
            sendMessage(state.ws, {
              type: "response-audio",
              data: audioBuffer.toString("base64"),
            });
          } catch (error) {
            console.error("Response generation error:", error);
            sendMessage(state.ws, {
              type: "error",
              data: "Failed to generate response",
            });
          }
        }
      }
    );
  } catch (error) {
    console.error("Transcribe stream error:", error);
    sendMessage(state.ws, {
      type: "error",
      data: "Speech recognition error",
    });
  }
}

function stopListening(state: ClientState) {
  state.isStreaming = false;
  if (state.audioStreamController) {
    try {
      state.audioStreamController.close();
    } catch {
      // Already closed
    }
    state.audioStreamController = null;
  }
}

function sendMessage(ws: WebSocket, message: WebSocketMessage) {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(message));
  }
}

/**
 * 個別のWebSocket接続に対してAWSパイプラインを設定する
 * 新しいserver.tsからの呼び出し用
 */
export function setupAWSConnection(ws: WebSocket): void {
  const state: ClientState = {
    ws,
    audioQueue: [],
    isStreaming: false,
    conversationHistory: [],
    audioStreamController: null,
  };

  ws.on("message", async (data: Buffer) => {
    try {
      const textData = data.toString("utf-8");
      let message: WebSocketMessage;

      try {
        message = JSON.parse(textData);
      } catch {
        handleAudioChunk(state, new Uint8Array(data));
        return;
      }

      switch (message.type) {
        case "start-listening":
          await startAWSListening(state);
          break;
        case "stop-listening":
          stopListening(state);
          break;
        default:
          console.warn("Unknown message type:", message.type);
      }
    } catch (error) {
      console.error("WebSocket message error:", error);
      sendMessage(ws, {
        type: "error",
        data: "Internal server error",
      });
    }
  });

  ws.on("close", () => {
    console.log("[AWS] クライアント切断");
    stopListening(state);
  });
}
