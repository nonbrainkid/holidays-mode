import { createServer } from 'node:http';
import handler from '../api/game.ts';
import wallet from '../api/wallet.ts';
process.env.VERCEL = '';
process.env.VERCEL_ENV = 'development';
createServer(async (req, res) => {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 12000) {
      res.writeHead(413).end();
      return;
    }
    chunks.push(chunk);
  }
  try {
    req.body = chunks.length
      ? JSON.parse(Buffer.concat(chunks).toString())
      : undefined;
  } catch {
    res.writeHead(400).end();
    return;
  }
  if (req.url?.split('?')[0] === '/api/game') await handler(req, res);
  else if (req.url?.split('?')[0] === '/api/wallet') await wallet(req, res);
  else res.writeHead(404).end();
}).listen(3001, '127.0.0.1', () =>
  console.log('Holidays Mode game API: http://127.0.0.1:3001'),
);
