import './config/env.js';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import express from 'express';
import mongoSanitize from 'express-mongo-sanitize';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import morgan from 'morgan';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import adminRoutes from './routes/adminRoutes.js';
import authRoutes from './routes/authRoutes.js';
import chatRoutes from './routes/chatRoutes.js';
import claimRoutes from './routes/claimRoutes.js';
import complaintRoutes from './routes/complaintRoutes.js';
import dashboardRoutes from './routes/dashboardRoutes.js';
import handoverRoutes from './routes/handoverRoutes.js';
import itemRoutes from './routes/itemRoutes.js';
import notificationRoutes from './routes/notificationRoutes.js';
import publicRoutes from './routes/publicRoutes.js';
import { errorHandler, notFound } from './middleware/errorMiddleware.js';
import { connectDatabase } from './config/database.js';

const app = express();
const currentDirectory = path.dirname(fileURLToPath(import.meta.url));
const frontendDist = path.resolve(currentDirectory, '../frontend/dist');
const allowedOrigins = (process.env.CLIENT_URL || 'http://localhost:5173').split(',').map((origin) => origin.trim());

app.set('trust proxy', 1);
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(cors({ origin: allowedOrigins, credentials: true, methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'] }));
app.use(compression());
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));
app.use(cookieParser());
app.use((req, _res, next) => {
  if (req.body) mongoSanitize.sanitize(req.body);
  if (req.params) mongoSanitize.sanitize(req.params);
  next();
});
if (process.env.NODE_ENV !== 'test') app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));
app.use('/api', rateLimit({ windowMs: 15 * 60 * 1000, limit: 500, standardHeaders: 'draft-8', legacyHeaders: false }));

app.get('/', (_req, res) => res.json({
  success: true,
  service: 'FoundBack API',
  api: '/api',
  health: '/api/health',
  website: process.env.CLIENT_URL || 'http://localhost:5173',
}));

if (process.env.NODE_ENV !== 'test') {
  app.use('/api', async (_req, _res, next) => {
    try {
      await connectDatabase();
      next();
    } catch (error) {
      next(error);
    }
  });
}

app.get('/api/health', (_req, res) => res.json({ success: true, service: 'FoundBack API', timestamp: new Date().toISOString() }));
app.get('/api', (_req, res) => res.json({
  success: true,
  service: 'FoundBack API',
  health: '/api/health',
  website: process.env.CLIENT_URL || 'http://localhost:5173',
}));
app.use('/api/public', publicRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/items', itemRoutes);
app.use('/api/claims', claimRoutes);
app.use('/api/chats', chatRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/complaints', complaintRoutes);
app.use('/api/handovers', handoverRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/admin', adminRoutes);

if (fs.existsSync(path.join(frontendDist, 'index.html'))) {
  app.use(express.static(frontendDist, { index: false, maxAge: process.env.NODE_ENV === 'production' ? '1d' : 0 }));
  app.use((req, res, next) => {
    if (req.method === 'GET' && !req.path.startsWith('/api') && req.accepts('html')) {
      return res.sendFile(path.join(frontendDist, 'index.html'));
    }
    return next();
  });
}

app.use(notFound);
app.use(errorHandler);

export default app;
