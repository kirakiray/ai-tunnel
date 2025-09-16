import { LMStudioClient } from "./lmstudio-client.js";

class Agent {
  constructor({ lmstudioOptions, model } = {}) {
    this.ws = null;
    this.lmstudioOptions = lmstudioOptions || [];
    this.model = model || "qwen3-4b-2507";
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
    };

    this.ws.onmessage = (event) => {
      const data = JSON.parse(event.data);

      console.log("收到服务器消息:", data);

      if (data.clientId) {
        // 有用户端来了
        const client = new LMStudioClient(...this.lmstudioOptions);

        client
          .sendChatMessage(
            this.model,
            [{ role: "user", content: data.prompt }],
            (e) => {
              // 回复用户端
              this.ws.send(
                JSON.stringify({
                  id: data.id,
                  targetId: data.clientId,
                  content: e.content,
                })
              );
            }
          )
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
      this.reconnect();
    };

    this.ws.onerror = (event) => {
      console.log("WebSocket 连接错误", event);
    };
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
