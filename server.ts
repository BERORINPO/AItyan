/**
 * WebSocketサーバー（AWS音声パイプライン + Vertex AI Live APIプロキシ）
 * Run with: npx tsx server.ts
 */
import dotenv from "dotenv";
// .env.localから環境変数を読み込む（Next.jsはdev時に自動で読むが、tsx単体起動時は必要）
dotenv.config({ path: ".env.local" });
import { createServer } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { IncomingMessage } from "http";
import { createVertexLiveProxy } from "./src/lib/voice/vertex-live-proxy";

// 既存のAWSパイプライン用WebSocketサーバーの作成関数を動的インポート
const PORT = parseInt(process.env.WS_PORT || "3001", 10);

// HTTPサーバーを作成（WebSocketのアップグレード処理に使用）
const httpServer = createServer((_req, res) => {
    res.writeHead(200, { "Content-Type": "text/plain" });
    res.end("WebSocket server running");
});

// パスごとに異なるWebSocketサーバーを作成
const awsWss = new WebSocketServer({ noServer: true });
const vertexLiveWss = new WebSocketServer({ noServer: true });

// AWS WebSocketサーバーの接続処理（既存のロジックを維持）
awsWss.on("connection", async (ws: WebSocket, _req: IncomingMessage) => {
    console.log("[AWS] クライアント接続");
    // 既存のAWSパイプラインサーバーロジックを動的にインポート
    const { setupAWSConnection } = await import("./src/lib/websocket/server");
    setupAWSConnection(ws);
});

// Vertex AI Live APIプロキシの接続処理
vertexLiveWss.on("connection", (ws: WebSocket) => {
    console.log("[VertexLive] クライアント接続");
    createVertexLiveProxy(ws);
});

// HTTPアップグレードリクエストをパスに基づいてルーティング
httpServer.on("upgrade", (request, socket, head) => {
    const pathname = new URL(
        request.url || "/",
        `http://localhost:${PORT}`
    ).pathname;

    if (pathname === "/vertex-live") {
        // Vertex AI Live APIプロキシ
        vertexLiveWss.handleUpgrade(request, socket, head, (ws) => {
            vertexLiveWss.emit("connection", ws, request);
        });
    } else {
        // デフォルト: AWS音声パイプライン
        awsWss.handleUpgrade(request, socket, head, (ws) => {
            awsWss.emit("connection", ws, request);
        });
    }
});

httpServer.listen(PORT, () => {
    console.log(`\n🚀 WebSocketサーバー起動: ポート ${PORT}`);
    console.log(`   AWS音声パイプライン: ws://localhost:${PORT}/`);
    console.log(
        `   Vertex AI Live API:  ws://localhost:${PORT}/vertex-live\n`
    );
});
