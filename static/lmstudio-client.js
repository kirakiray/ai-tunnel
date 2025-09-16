/**
 * LMStudio Client - 封装与 LMStudio API 交互的逻辑
 */

export class LMStudioClient {
  constructor(baseUrl = "http://localhost:1234") {
    this.baseUrl = baseUrl;
    this.apiEndpoint = "/v1/chat/completions";
  }

  /**
   * 获取模型列表
   * @returns {Promise} - 返回模型列表的 Promise
   */
  async models() {
    return fetch(this.baseUrl + "/v1/models", {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    }).then((response) => response.json());
  }

  /**
   * 发送聊天消息到 LMStudio API
   * @param {string} model - 使用的模型名称
   * @param {Array} messages - 消息历史数组
   * @param {Function} onChunkReceived - 接收到每个数据块时的回调函数
   * @returns {Promise} - 返回处理流式响应的 Promise
   */
  sendChatMessage(model, messages, onChunkReceived) {
    return fetch(this.baseUrl + this.apiEndpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: model,
        messages: messages,
        stream: true, // 启用流式响应
      }),
    })
      .then((response) => {
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const reader = response.body.getReader();
        const decoder = new TextDecoder();

        return new ReadableStream({
          start(controller) {
            function push() {
              return reader.read().then(({ done, value }) => {
                if (done) {
                  controller.close();
                  return;
                }
                const chunk = decoder.decode(value);
                controller.enqueue(chunk);
                return push();
              });
            }
            return push();
          },
        });
      })
      .then((stream) => {
        const reader = stream.getReader();
        function readChunk() {
          return reader.read().then(({ done, value }) => {
            if (done) {
              return;
            }
            // 处理每个分块的数据
            const lines = value
              .split("\n")
              .filter((line) => line.trim() !== "");
            lines.forEach((line) => {
              if (line.startsWith("data:")) {
                const dataStr = line.slice("data:".length).trim();
                if (dataStr === "[DONE]") {
                  return;
                }
                try {
                  const data = JSON.parse(dataStr);
                  // 检查 data 对象中是否存在 choices 属性，且该属性数组是否有元素，以及元素中是否有 delta 和 content 属性
                  if (
                    data.choices &&
                    data.choices[0] &&
                    data.choices[0].delta &&
                    data.choices[0].delta.content
                  ) {
                    // 调用回调函数处理接收到的内容
                    if (onChunkReceived) {
                      onChunkReceived({
                        data,
                        content: data.choices[0].delta.content,
                      });
                    }
                  }
                } catch (e) {
                  console.error("解析流式数据出错:", e);
                }
              }
            });
            return readChunk();
          });
        }
        return readChunk();
      })
      .catch((error) => {
        console.error("请求出错:", error);
        throw error;
      });
  }
}
