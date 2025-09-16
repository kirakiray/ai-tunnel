import { WebSocketServer } from 'ws';

// 创建WebSocket服务器
const createWebSocketServer = (server) => {
  const wss = new WebSocketServer({ server });

  wss.on('connection', (ws) => {
    console.log('New client connected');
    
    // 发送欢迎消息
    ws.send(JSON.stringify({ type: 'welcome', message: 'Connected to WebSocket server' }));
    
    // 监听客户端消息
    ws.on('message', (data) => {
      console.log('Received message:', data.toString());
      
      // 回显消息
      ws.send(JSON.stringify({ type: 'echo', message: `Echo: ${data.toString()}` }));
    });
    
    // 监听连接关闭
    ws.on('close', () => {
      console.log('Client disconnected');
    });
  });
  
  return wss;
};

export default createWebSocketServer;