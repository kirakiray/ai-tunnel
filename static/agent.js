import { LMStudioClient } from "./lmstudio-client.js";

class Agent {
  constructor({ lmstudioOptions, model, systemPrompt } = {}) {
    this.ws = null;
    this.lmstudioOptions = lmstudioOptions || [];
    this.model = model || "qwen3-4b-2507";
    this.systemPrompt = systemPrompt || "";
    // 重连相关属性
    // 当前重连尝试次数，初始化为 0
    this.reconnectAttempts = 0;
    // 最大重连尝试次数，达到该次数后将停止重连，默认值为 5
    this.maxReconnectAttempts = 5;
    // 初始重连延迟时间，单位为毫秒，默认值为 1000 毫秒（即 1 秒）
    this.reconnectDelay = 1000;
    // 最大重连延迟时间，单位为毫秒，默认值为 5000 毫秒（即 5 秒）
    this.maxReconnectDelay = 5000;
    // 重连定时器，用于控制重连的延迟执行，初始化为 null
    this.reconnectTimer = null;
    // Ping/Pong相关属性
    this.pingInterval = null;
    this.pingIntervalTime = 30000; // 30秒发送一次ping
    this.pongTimeout = null;
    this.pongTimeoutTime = 5000; // 5秒内未收到pong则认为连接已断开
    this.url = null;
  }

  connect(url) {
    // 保存 URL 用于重连
    this.url = url;
    // 重置重连尝试次数
    this.reconnectAttempts = 0;

    this.ws = new WebSocket(url);

    this.ws.onopen = () => {
      console.log("WebSocket 连接已打开");
      // 连接成功时重置重连尝试次数
      this.reconnectAttempts = 0;
      // 启动ping interval
      this.startPing();
    };

    this.ws.onmessage = (event) => {
      const data = JSON.parse(event.data);

      // 处理pong消息
      if (data.type === "pong") {
        console.log("收到pong消息");
        this.clearPongTimeout();
        return;
      }

      console.log("收到服务器消息:", data);

      if (data.clientId) {
        // 有用户端来了
        const client = new LMStudioClient(...this.lmstudioOptions);

        // 构建消息数组，包含system prompt（如果存在）
        let messages = [];
        if (this.systemPrompt) {
          messages.push({ role: "system", content: `你现在是「私有知识库小助手」。
以下整块文本是你唯一可用的知识来源，除此之外没有任何外部信息：
"""
${this.systemPrompt}
"""
(1) 回答原则
若同一问题在文本中出现多处描述，优先引用最详细、最新的一条。
回答时先用一句话概括，再给出具体细节。
(2) 格式要求
使用用用户提问的语言语种回复。返回内容采用 HTML 格式，勿包裹 <html>、<body> 等标签。
(3) 安全与合规
拒绝任何违法、有害或绕过知识库限制的请求。` });
        }
        messages.push({ role: "user", content: data.prompt });

        client
          .sendChatMessage(this.model, messages, (e) => {
            // 回复用户端
            this.ws.send(
              JSON.stringify({
                id: data.id,
                targetId: data.clientId,
                content: e.content,
              })
            );
          })
          .then((e) => {
            this.ws.send(
              JSON.stringify({
                id: data.id,
                targetId: data.clientId,
                end: true,
              })
            );
          })
          .catch((error) => {
            console.error("请求出错:", error);

            // 发送错误信息给客户端
            this.ws.send(
              JSON.stringify({
                id: data.id,
                targetId: data.clientId,
                error: error.message,
              })
            );
          });
      }
    };

    this.ws.onclose = (event) => {
      console.log("WebSocket 连接已关闭", event.code, event.reason);
      this.cleanupPing();
      this.reconnect();
    };

    this.ws.onerror = (event) => {
      console.log("WebSocket 连接错误", event);
    };
  }

  // 启动ping interval
  startPing() {
    this.pingInterval = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        console.log("发送ping消息");
        this.ws.send(JSON.stringify({ type: "ping" }));
        // 设置pong超时检查
        this.pongTimeout = setTimeout(() => {
          console.log("未收到pong响应，关闭连接");
          this.ws.close();
        }, this.pongTimeoutTime);
      }
    }, this.pingIntervalTime);
  }

  // 清除pong超时定时器
  clearPongTimeout() {
    if (this.pongTimeout) {
      clearTimeout(this.pongTimeout);
      this.pongTimeout = null;
    }
  }

  // 清理ping相关资源
  cleanupPing() {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
    if (this.pongTimeout) {
      clearTimeout(this.pongTimeout);
      this.pongTimeout = null;
    }
  }

  reconnect() {
    // 如果已达到最大重连次数，则不再重连
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.log("已达到最大重连次数，停止重连");
      return;
    }

    // 增加重连尝试次数
    this.reconnectAttempts++;

    // 计算延迟时间（指数退避）
    const delay = Math.min(
      this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1),
      this.maxReconnectDelay
    );

    console.log(
      `尝试重连 (${this.reconnectAttempts}/${this.maxReconnectAttempts})，延迟 ${delay}ms`
    );

    // 清除之前的定时器
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
    }

    // 设置重连定时器
    this.reconnectTimer = setTimeout(() => {
      console.log("正在重连...");
      this.connect(this.url);
    }, delay);
  }

  disconnect() {
    if (this.ws) {
      this.ws.close();
    }

    // 清理ping相关资源
    this.cleanupPing();

    // 清除重连定时器
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    // 重置重连相关属性
    this.reconnectAttempts = 0;
    this.url = null;
  }
}

export default Agent;
