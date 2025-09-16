import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// 获取当前文件的目录路径
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 创建静态文件服务器
const createStaticServer = () => {
  const server = http.createServer((req, res) => {
    // 设置静态文件路径，根目录为static目录
    const staticDir = path.join(__dirname, 'static');
    let filePath = path.join(staticDir, req.url === '/' ? '/index.html' : req.url);
    
    // 获取文件扩展名
    const extname = path.extname(filePath);
    let contentType = 'text/html';
    
    // 根据扩展名设置内容类型
    switch (extname) {
      case '.js':
        contentType = 'text/javascript';
        break;
      case '.css':
        contentType = 'text/css';
        break;
      case '.json':
        contentType = 'application/json';
        break;
      case '.png':
        contentType = 'image/png';
        break;
      case '.jpg':
        contentType = 'image/jpg';
        break;
      case '.wav':
        contentType = 'audio/wav';
        break;
    }
    
    // 读取文件并返回
    fs.readFile(filePath, (err, content) => {
      if (err) {
        if (err.code === 'ENOENT') {
          // 文件未找到
          fs.readFile(path.join(staticDir, '404.html'), (err, content) => {
            res.writeHead(404, { 'Content-Type': 'text/html' });
            res.end(content, 'utf-8');
          });
        } else {
          // 服务器错误
          res.writeHead(500);
          res.end(`Server Error: ${err.code}`);
        }
      } else {
        // 成功返回文件
        res.writeHead(200, { 'Content-Type': contentType });
        res.end(content, 'utf-8');
      }
    });
  });
  
  return server;
};

export default createStaticServer;