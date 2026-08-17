import './config/env.js';
import http from 'node:http';
import { Server } from 'socket.io';
import app from './app.js';
import { connectDatabase } from './config/database.js';
import { startExpiryJob } from './jobs/expiryJob.js';
import { configureSockets } from './sockets/index.js';
import dns from 'node:dns';

if (!process.env.VERCEL) {
  dns.setServers(['8.8.8.8', '1.1.1.1']);

  const required = ['MONGODB_URI', 'JWT_SECRET'];
  const missing = required.filter((key) => !process.env[key]);
  if (missing.length) {
    console.error(`Missing required environment variables: ${missing.join(', ')}`);
    process.exit(1);
  }

  const server = http.createServer(app);
  const origins = (process.env.CLIENT_URL || 'http://localhost:5173').split(',').map((origin) => origin.trim());
  const io = new Server(server, { cors: { origin: origins, credentials: true } });
  app.set('io', io);
  configureSockets(io);

  const port = Number(process.env.PORT || 8080);

  try {
    await connectDatabase();
    startExpiryJob();
    server.listen(port, () => console.log(`FoundBack API listening on http://localhost:${port}`));
  } catch (error) {
    console.error('Failed to start FoundBack:', error.message);
    process.exit(1);
  }

  function shutdown() {
    server.close(() => process.exit(0));
  }
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

export default app;
