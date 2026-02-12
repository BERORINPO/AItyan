/**
 * Vertex AI Live API WebSocketプロキシ
 *
 * サービスアカウント認証を行い、クライアントとVertex AI Gemini Live API間の
 * WebSocket通信を双方向にプロキシする
 */
import WebSocket from "ws";
import { GoogleAuth } from "google-auth-library";
import { GEMINI_LIVE_SYSTEM_PROMPT } from "@/lib/llm/prompts";

// Vertex AI Live APIのWebSocketエンドポイント
const LOCATION = "us-central1";
const MODEL = "gemini-live-2.5-flash-native-audio";

const getVertexLiveUrl = () =>
    `wss://${LOCATION}-aiplatform.googleapis.com/ws/google.cloud.aiplatform.v1beta1.LlmBidiService/BidiGenerateContent`;

/**
 * OAuth2アクセストークンを取得する
 */
async function getAccessToken(): Promise<string> {
    const auth = new GoogleAuth({
        scopes: ["https://www.googleapis.com/auth/cloud-platform"],
    });
    const client = await auth.getClient();
    const tokenResponse = await client.getAccessToken();
    if (!tokenResponse.token) {
        throw new Error("アクセストークンの取得に失敗しました");
    }
    return tokenResponse.token;
}

/**
 * セットアップメッセージを生成する
 */
function createSetupMessage() {
    const projectId = process.env.GOOGLE_CLOUD_PROJECT || "";
    console.log("[VertexLive] Project ID check:", projectId); // Debug

    return {
        setup: {
            model: `projects/${projectId}/locations/${LOCATION}/publishers/google/models/${MODEL}`,
            generationConfig: {
                responseModalities: ["AUDIO"],
                speechConfig: {
                    voiceConfig: {
                        prebuiltVoiceConfig: {
                            voiceName: "Aoede",
                        },
                    },
                },
            },
            systemInstruction: {
                parts: [{ text: GEMINI_LIVE_SYSTEM_PROMPT }],
            },
        },
    };
}

/**
 * クライアントWebSocketとVertex AI Live APIの間にプロキシを確立する
 */
export async function createVertexLiveProxy(
    clientWs: WebSocket
): Promise<void> {
    console.log("[VertexLive] プロキシ接続を開始...");

    // アクセストークンを取得
    let accessToken: string;
    try {
        accessToken = await getAccessToken();
        console.log("[VertexLive] アクセストークン取得成功");
    } catch (error) {
        console.error("[VertexLive] アクセストークン取得失敗:", error);
        clientWs.close(1008, "認証に失敗しました");
        return;
    }

    // Vertex AI Live APIに接続
    const serviceUrl = getVertexLiveUrl();
    console.log("[VertexLive] Vertex AI Live APIに接続中...");

    const serverWs = new WebSocket(serviceUrl, {
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
        },
    });

    // サーバー接続が開いたらセットアップメッセージを送信
    serverWs.on("open", () => {
        console.log("[VertexLive] Vertex AI Live APIに接続完了");
        const setupMsg = createSetupMessage();
        console.log("[VertexLive] セットアップメッセージ送信中:", JSON.stringify(setupMsg, null, 2));
        serverWs.send(JSON.stringify(setupMsg));
    });

    // サーバー→クライアントのメッセージ転送
    serverWs.on("message", (data: WebSocket.Data) => {
        try {
            const message = data.toString();
            if (clientWs.readyState === WebSocket.OPEN) {
                clientWs.send(message);
            }

            // デバッグ用ログ（最初の200文字のみ）
            const parsed = JSON.parse(message);
            if (parsed.setupComplete) {
                console.log("[VertexLive] セットアップ完了！");
            } else {
                console.log(
                    "[VertexLive] サーバー→クライアント:",
                    message.substring(0, 200)
                );
            }
        } catch (error) {
            console.error("[VertexLive] サーバーメッセージ処理エラー:", error);
        }
    });

    // サーバー接続エラー
    serverWs.on("error", (error) => {
        console.error("[VertexLive] サーバー接続エラー:", error);
        if (clientWs.readyState === WebSocket.OPEN) {
            clientWs.close(1011, "Vertex AI接続エラー");
        }
    });

    // サーバー接続クローズ
    serverWs.on("close", (code, reason) => {
        console.log(
            `[VertexLive] サーバー接続クローズ: ${code} - ${reason.toString()}`
        );
        if (clientWs.readyState === WebSocket.OPEN) {
            clientWs.close(code, reason.toString());
        }
    });

    // クライアント→サーバーのメッセージ転送
    clientWs.on("message", (data: WebSocket.Data) => {
        try {
            if (serverWs.readyState === WebSocket.OPEN) {
                serverWs.send(data.toString());
            }
        } catch (error) {
            console.error("[VertexLive] クライアントメッセージ転送エラー:", error);
        }
    });

    // クライアント接続クローズ時にサーバー接続も閉じる
    clientWs.on("close", () => {
        console.log("[VertexLive] クライアント切断、サーバー接続を閉じます");
        if (serverWs.readyState === WebSocket.OPEN) {
            serverWs.close();
        }
    });

    // クライアント接続エラー
    clientWs.on("error", (error) => {
        console.error("[VertexLive] クライアント接続エラー:", error);
        if (serverWs.readyState === WebSocket.OPEN) {
            serverWs.close();
        }
    });
}
