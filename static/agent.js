import { LMStudioClient } from "./lmstudio-client.js";

class Agent {
  constructor({ lmstudioOptions } = {}) {
    this.ws = null;
    this.lmstudioOptions = lmstudioOptions || [];
  }

  connect(url) {
    this.ws = new WebSocket(url);

    this.ws.onopen = () => {
      console.log("WebSocket 连接已打开");
    };

    this.ws.onmessage = (event) => {
      const data = JSON.parse(event.data);

      console.log("收到服务器消息:", data);

      if (data.clientId) {
        // 有用户端来了
        const client = new LMStudioClient(...this.lmstudioOptions);

        client
          .sendChatMessage(
            "qwen3-4b-2507",
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
          });
      }
    };

    this.ws.onclose = (event) => {
      console.log("WebSocket 连接已关闭", event.code, event.reason);
    };

    this.ws.onerror = (event) => {
      console.log("WebSocket 连接错误", event);
    };
  }

  disconnect() {
    if (this.ws) {
      this.ws.close();
    }
  }
}

export default Agent;
