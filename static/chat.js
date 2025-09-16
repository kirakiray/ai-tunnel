export const chat = async ({ prompt, onMessage, url = "ws://localhost:3000/chat" }) => {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(url);

    const chatId = Math.random().toString(32).slice(2);

    ws.onopen = () => {
      ws.send(
        JSON.stringify({
          id: chatId,
          prompt: prompt,
        })
      );
    };

    let content = "";

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);

      if (data.id === chatId) {
        if (data.content) {
          content += data.content;
        }

        if (onMessage) {
          onMessage({
            content,
            chunk: data.content,
          });
        }

        if (data.end) {
          resolve(content);
        }
      }
    };

    ws.onerror = (error) => {
      reject(error);
    };

    ws.onclose = () => {
      // 连接关闭
    };
  });
};
