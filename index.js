import createStaticServer from "./src/static-server.js";
import createWebSocketServer from "./src/websocket-server.js";

// 获取当前文件的目录路径

// 创建静态服务器
const server = createStaticServer();

// 创建WebSocket服务器
const wss = createWebSocketServer(server);

// 启动服务器
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`WebSocket server is running`);
});
