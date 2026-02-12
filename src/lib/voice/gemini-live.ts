/**
 * Gemini Live APIクライアント
 *
 * WebSocketプロキシサーバー経由でVertex AI Live APIに接続し、
 * リアルタイム音声会話を行うクライアント
 */

// プロキシサーバーのWebSocket URL
// プロキシサーバーのWebSocket URL
const getProxyUrl = () => {
  let wsUrl = process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:3001";

  if (process.env.NODE_ENV === "production" && typeof window !== "undefined") {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    wsUrl = `${protocol}//${window.location.host}`;
  }

  return `${wsUrl}/vertex-live`;
};

type GeminiLiveConfig = {
  onAudioChunk: (audioData: ArrayBuffer) => void;
  onTranscription: (text: string) => void;
  onError: (error: Error) => void;
  onClose: () => void;
};

export class GeminiLiveSession {
  private ws: WebSocket | null = null;
  private config: GeminiLiveConfig;

  constructor(config: GeminiLiveConfig) {
    this.config = config;
  }

  /**
   * プロキシサーバー経由でVertex AI Live APIに接続する
   * サーバー側でセットアップメッセージの送信と認証を行う
   */
  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      const url = getProxyUrl();
      console.log("[GeminiLive] プロキシに接続中...", url);

      this.ws = new WebSocket(url);

      this.ws.onopen = () => {
        console.log("[GeminiLive] プロキシに接続完了、セットアップ待機中...");
      };

      this.ws.onmessage = (event: MessageEvent) => {
        if (typeof event.data === "string") {
          try {
            const msg = JSON.parse(event.data);

            // セットアップ完了メッセージ
            if (msg.setupComplete) {
              console.log("[GeminiLive] セットアップ完了！");
              resolve();
              return;
            }

            this.handleMessage(msg);
          } catch (e) {
            console.error("[GeminiLive] メッセージ解析エラー:", e);
          }
        }
      };

      this.ws.onerror = (event) => {
        console.error("[GeminiLive] WebSocketエラー:", event);
        const error = new Error("Gemini Live WebSocket接続エラー");
        this.config.onError(error);
        reject(error);
      };

      this.ws.onclose = (event) => {
        console.log(
          `[GeminiLive] WebSocket切断: ${event.code} - ${event.reason}`
        );
        this.config.onClose();
      };

      // 15秒でタイムアウト（プロキシ経由なので少し長めに）
      setTimeout(() => {
        if (this.ws?.readyState !== WebSocket.OPEN) {
          reject(new Error("Gemini Live接続タイムアウト"));
        }
      }, 15000);
    });
  }

  /**
   * サーバーからのメッセージを処理する
   */
  private handleMessage(msg: Record<string, unknown>) {
    if (msg.serverContent) {
      const content = msg.serverContent as Record<string, unknown>;

      if (content.modelTurn) {
        const modelTurn = content.modelTurn as {
          parts?: Array<{
            text?: string;
            inlineData?: { data: string; mimeType: string };
          }>;
        };

        if (modelTurn.parts) {
          for (const part of modelTurn.parts) {
            // テキスト応答
            if (part.text) {
              this.config.onTranscription(part.text);
            }
            // 音声応答（Base64エンコードPCMデータ）
            if (part.inlineData?.data) {
              const binaryStr = atob(part.inlineData.data);
              const bytes = new Uint8Array(binaryStr.length);
              for (let i = 0; i < binaryStr.length; i++) {
                bytes[i] = binaryStr.charCodeAt(i);
              }
              this.config.onAudioChunk(bytes.buffer);
            }
          }
        }
      }
    }
  }

  /**
   * マイクからの音声データをサーバーに送信する
   */
  sendAudio(audioData: ArrayBuffer): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;

    // PCMデータをBase64エンコードして送信
    const bytes = new Uint8Array(audioData);
    let binary = "";
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    const base64 = btoa(binary);

    this.sendJSON({
      realtimeInput: {
        mediaChunks: [
          {
            mimeType: "audio/pcm;rate=16000",
            data: base64,
          },
        ],
      },
    });
  }

  /**
   * JSONデータをサーバーに送信する
   */
  private sendJSON(data: unknown): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    }
  }

  /**
   * セッションを切断する
   */
  disconnect(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }
}
