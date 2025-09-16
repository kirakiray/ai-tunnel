import { WebSocketServer } from "ws";
import url from "url";

// 创建WebSocket服务器
const createWebSocketServer = (server, options = {}) => {
  const wss = new WebSocketServer({ server });

  // 默认路径配置
  const agentPath = options.agentPath || "/agent";
  const chatPath = options.chatPath || "/chat";
  const allowList = options.allow || [];

  const agents = new Map();
  const clients = new Map();

  wss.on("connection", (ws, req) => {
    // 检查来源域名是否在允许列表中（仅对chat路径进行检查）
    if (req.url === chatPath && allowList.length > 0) {
      // 从请求头获取来源
      const origin = req.headers.origin;
      if (origin) {
        try {
          const originUrl = new URL(origin);
          const originHost = originUrl.host;

          // 检查是否在允许列表中
          const isAllowed = allowList.some((allowedOrigin) => {
            // 支持通配符匹配
            if (allowedOrigin === "*") return true;

            // 精确匹配
            if (allowedOrigin === originHost) return true;

            // 通配符匹配（例如 "*.example.com"）
            if (allowedOrigin.startsWith("*.")) {
              const domain = allowedOrigin.substring(2);
              return originHost.endsWith("." + domain) || originHost === domain;
            }

            return false;
          });

          if (!isAllowed) {
            // 来源不在允许列表中，关闭连接
            ws.close(1008, "Origin not allowed");
            return;
          }
        } catch (e) {
          // 无效的来源URL，关闭连接
          ws.close(1008, "Invalid origin");
          return;
        }
      } else {
        // 没有来源头，关闭连接
        ws.close(1008, "Missing origin header");
        return;
      }
    }

    // 发送欢迎消息
    if (req.url === agentPath) {
      agents.set(ws, {
        used: 0, // 已经使用的量
      });

      ws._is_agent = true;

      ws.send(
        JSON.stringify({
          type: "welcome",
          message: "Connected to Agent WebSocket server",
        })
      );
    } else if (req.url === chatPath) {
      ws._client_id = Math.random().toString(16).slice(2);
      clients.set(ws._client_id, ws);

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

    // 监听客户端消息
    ws.on("message", (data) => {
      // console.log("Received message:", data.toString());
      let respData;
      try {
        respData = JSON.parse(data);
      } catch (err) {
        return;
      }

      if (req.url === chatPath) {
        // 转发到agent
        for (let [agent, agentInfo] of Array.from(agents)) {
          agent.send(
            JSON.stringify({
              clientId: ws._client_id,
              ...respData,
            })
          );
        }
      } else if (ws._is_agent) {
        // 转发到目标用户
        const targetWs = clients.get(respData.targetId);

        if (targetWs) {
          targetWs.send(
            JSON.stringify({
              ...respData,
              targetId: undefined,
            })
          );
        }
      }
    });

    // 监听连接关闭
    ws.on("close", () => {
      if (ws._client_id) {
        clients.delete(ws._client_id);
      } else {
        // 从agents中移除连接
        agents.delete(ws);
      }
      console.log("Client disconnected");
    });
  });

  return wss;
};

export default createWebSocketServer;
