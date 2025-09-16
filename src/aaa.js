import { WebSocketServer } from 'ws';

// 创建WebSocket服务器
const createWebSocketServer = (server) => {
  const wss = new WebSocketServer({ server });

  // 存储不同路径的WebSocket连接
  const connections = new Map();

  wss.on('connection', (ws, req) => {
    console.log('New client connected to path:', req.url);
    
    // 根据路径存储不同的连接
    connections.set(req.url, ws);
    
    // 发送欢迎消息
    if (req.url === '/agent') {
      ws.send(JSON.stringify({ type: 'welcome', message: 'Connected to Agent WebSocket server' }));
    } else if (req.url === '/chat') {
      ws.send(JSON.stringify({ type: 'welcome', message: 'Connected to Chat WebSocket server' }));
    } else {
      ws.send(JSON.stringify({ type: 'welcome', message: 'Connected to WebSocket server' }));
    }
    
    // 监听客户端消息
    ws.on('message', async (data) => {
      try {
        const message = JSON.parse(data.toString());
        console.log('Received message:', message);
        
        if (req.url === '/agent') {
          // Agent连接处理 - 这里应该连接到LMStudio API
          ws.send(JSON.stringify({ 
            type: 'agent-response', 
            id: message.id,
            message: `Agent received: ${message.prompt || message.content}` 
          }));
        } else if (req.url === '/chat') {
          // Chat连接处理 - 转发到Agent
          const agentConnection = connections.get('/agent');
          if (agentConnection && agentConnection.readyState === WebSocket.OPEN) {
            // 转发消息到Agent
            agentConnection.send(JSON.stringify({
              id: message.id,
              prompt: message.prompt,
              type: 'chat-to-agent'
            }));
            
            // 回复客户端消息已转发
            ws.send(JSON.stringify({
              type: 'forwarded', 
              id: message.id,
              message: 'Message forwarded to agent' 
            }));
          } else {
            // 如果没有Agent连接，返回错误
            ws.send(JSON.stringify({ 
              type: 'error', 
              id: message.id,
              message: 'Agent is not connected' 
            }));
          }
        } else {
          // 默认回显消息
          ws.send(JSON.stringify({ type: 'echo', message: `Echo: ${data.toString()}` }));
        }
      } catch (error) {
        console.error('Error processing message:', error);
        ws.send(JSON.stringify({ type: 'error', message: 'Failed to process message' }));
      }
    });
    
    // 监听连接关闭
    ws.on('close', () => {
      console.log('Client disconnected from path:', req.url);
      // 从连接映射中移除
      connections.delete(req.url);
    });
  });
  
  return wss;
};

export default createWebSocketServer;