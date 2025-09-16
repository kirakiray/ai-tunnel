import { WebSocketServer } from "ws";

// 创建WebSocket服务器
const createWebSocketServer = (server) => {
  const wss = new WebSocketServer({ server });

  const agents = new Map();

  wss.on("connection", (ws, req) => {
    // 发送欢迎消息
    if (req.url === "/agent") {
      agents.set(ws, {
        used: 0, // 已经使用的量
      });
      ws.send(
        JSON.stringify({
          type: "welcome",
          message: "Connected to Agent WebSocket server",
        })
      );
    } else if (req.url === "/chat") {
      ws.send(
        JSON.stringify({
          type: "welcome",
          message: "Connected to Chat WebSocket server",
        })
      );
    } else {
      // 立刻关闭连接，添加错误状态码1008表示策略违规
      ws.close(1008, "Unsupported path");
      return;
    }

    // 发送欢迎消息
    ws.send(
      JSON.stringify({
        type: "welcome",
        message: "Connected to WebSocket server",
      })
    );

    // 监听客户端消息
    ws.on("message", (data) => {
      console.log("Received message:", data.toString());

      // 回显消息
      ws.send(
        JSON.stringify({ type: "echo", message: `Echo: ${data.toString()}` })
      );
    });

    // 监听连接关闭
    ws.on("close", () => {
      // 从agents中移除连接
      agents.delete(ws);
      console.log("Client disconnected");
    });
  });

  return wss;
};

export default createWebSocketServer;
