import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
import { createServer } from "http";
import { parse } from "url";
import next from "next";
import { WebSocketServer, WebSocket } from "ws";
import { IncomingMessage } from "http";
import { createVertexLiveProxy } from "./src/lib/voice/vertex-live-proxy";

const dev = process.env.NODE_ENV !== "production";
const app = next({ dev, dir: __dirname });
const handle = app.getRequestHandler();
const PORT = parseInt(process.env.PORT || "3000", 10);

app.prepare().then(() => {
    const server = createServer((req, res) => {
        const parsedUrl = parse(req.url!, true);
        handle(req, res, parsedUrl);
    });

    // WebSocket Servers with noServer option
    const awsWss = new WebSocketServer({ noServer: true });
    const vertexLiveWss = new WebSocketServer({ noServer: true });

    awsWss.on("connection", async (ws: WebSocket, _req: IncomingMessage) => {
        console.log("[AWS] クライアント接続");
        const { setupAWSConnection } = await import("./src/lib/websocket/server");
        setupAWSConnection(ws);
    });

    vertexLiveWss.on("connection", (ws: WebSocket) => {
        console.log("[VertexLive] クライアント接続");
        createVertexLiveProxy(ws);
    });

    server.on("upgrade", (request, socket, head) => {
        const { pathname } = parse(request.url || "/", true);

        if (pathname === "/vertex-live") {
            vertexLiveWss.handleUpgrade(request, socket, head, (ws) => {
                vertexLiveWss.emit("connection", ws, request);
            });
        } else if (pathname === "/" || pathname === "/aws-voice") {
            // AWS音声パイプライン (ルートパスまたは /aws-voice)
            awsWss.handleUpgrade(request, socket, head, (ws) => {
                awsWss.emit("connection", ws, request);
            });
        } else {
            // その他のパスはそのまま閉じるか、Next.jsが使うかも知れないので放置せず閉じる
            // ただしNext.jsのHMR (/_next/webpack-hmr) はdevモードで重要
            if (dev && pathname?.startsWith("/_next/webpack-hmr")) {
                // Next.js handles upgrade automatically? No, createServer doesn't pass upgrade to handle()
                // We can't easily handle Next.js HMR within custom server upgrade event without internal knowledge.
                // But for production (EC2), HMR is not needed.
            } else {
                socket.destroy();
            }
        }
    });

    server.listen(PORT, () => {
        console.log(`> Ready on http://localhost:${PORT}`);
        console.log(`> Vertex Live API: ws://localhost:${PORT}/vertex-live`);
    });
});
