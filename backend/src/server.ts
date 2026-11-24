/// <reference path="./types/y-websocket.d.ts" />
// Type declaration for 'y-websocket/bin/utils' is provided in src/types/y-websocket.d.ts

// Load environment variables before importing modules that read process.env at module load time.
import 'dotenv/config';

import express from 'express';
import { createServer, IncomingMessage } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { WebSocketServer } from 'ws';
import { setupWSConnection } from 'y-websocket/bin/utils';
import cors from 'cors';
import helmet from 'helmet';
import mongoose from 'mongoose';

// Import routes
import authRoutes from './routes/auth';
import docRoutes from './routes/docs';
import commentRoutes from './routes/comments';
import chatRoutes from './routes/chat';
import aiRoutes from './routes/ai';
import versionRoutes from './routes/versions';

// Import services
import { scheduleVersionCleanup } from './services/versionCleanup';
import { authService } from './services/authService';
import { Document } from './models/Document';

// Import middleware
import { errorMiddleware } from './middleware/auth';

const app = express();
const httpServer = createServer(app);
const allowedOrigins = (process.env.FRONTEND_URL || 'http://localhost:3000')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

const io = new SocketIOServer(httpServer, {
  cors: {
    origin: allowedOrigins,
    credentials: true,
  },
});

type DocumentRole = 'owner' | 'editor' | 'viewer' | null;

function getDocumentRole(doc: any, userId: string): DocumentRole {
  if (doc.ownerId.toString() === userId) return 'owner';
  if (doc.permissions?.editors?.some((id: mongoose.Types.ObjectId) => id.toString() === userId)) return 'editor';
  if (doc.permissions?.viewers?.some((id: mongoose.Types.ObjectId) => id.toString() === userId)) return 'viewer';
  return null;
}

function getTokenFromWebSocketRequest(req: IncomingMessage): string | null {
  const headerToken = authService.extractToken(req.headers.authorization);
  if (headerToken) return headerToken;

  const requestUrl = new URL(req.url || '/', 'ws://localhost');
  const queryToken = requestUrl.searchParams.get('token');
  return queryToken ? queryToken : null;
}

// WebSocket server for Yjs collaboration
const wss = new WebSocketServer({ server: httpServer });
wss.on('connection', async (ws: any, req: IncomingMessage) => {
  try {
    const token = getTokenFromWebSocketRequest(req);
    const payload = token ? authService.verifyToken(token) : null;
    const requestUrl = new URL(req.url || '/', 'ws://localhost');
    const docId = decodeURIComponent(requestUrl.pathname.replace(/^\/+/, '').split('/')[0] || '');

    if (!payload || !docId) {
      ws.close(1008, 'Unauthorized');
      return;
    }

    const doc = await Document.findById(docId);
    const role = doc ? getDocumentRole(doc, payload.userId) : null;

    // y-websocket does not provide a read-only ACL hook. Only users who can edit
    // the document may open the provider connection; viewers use REST content.
    if (!role || role === 'viewer') {
      ws.close(1008, 'Document access denied');
      return;
    }

    (req as IncomingMessage & { userId?: string }).userId = payload.userId;
    setupWSConnection(ws, req);
  } catch (error) {
    console.error('Yjs WebSocket authorization failed:', error);
    ws.close(1008, 'Unauthorized');
  }
});

// Connect to MongoDB
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/synapsribe';
mongoose
  .connect(MONGO_URI)
  .then(() => console.log('✓ MongoDB connected'))
  .catch((err) => console.error('✗ MongoDB connection failed:', err));

// Middleware
app.use(helmet());
app.use(cors({ origin: allowedOrigins, credentials: true }));
// Allow larger documents (e.g., embedded drawings) without triggering 413.
const bodyLimit = process.env.BODY_LIMIT || '25mb';
app.use(express.json({ limit: bodyLimit }));
app.use(express.urlencoded({ extended: true, limit: bodyLimit }));

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/docs', docRoutes);
app.use('/api/comments', commentRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/versions', versionRoutes);

// Socket.io namespace for collaboration
const collabNamespace = io.of('/collab');

collabNamespace.use((socket, next) => {
  const handshakeToken = typeof socket.handshake.auth?.token === 'string'
    ? socket.handshake.auth.token
    : authService.extractToken(socket.handshake.headers.authorization);
  const payload = handshakeToken ? authService.verifyToken(handshakeToken) : null;

  if (!payload) {
    return next(new Error('Unauthorized'));
  }

  socket.data.userId = payload.userId;
  socket.data.email = payload.email;
  next();
});

collabNamespace.on('connection', (socket) => {
  console.log(`User ${socket.id} connected to /collab`);

  // Join room
  socket.on('join_room', async (data, ack) => {
    const docId = typeof data?.docId === 'string' ? data.docId : '';
    const doc = docId ? await Document.findById(docId).catch(() => null) : null;
    const role = doc ? getDocumentRole(doc, socket.data.userId) : null;

    if (!role) {
      if (typeof ack === 'function') ack({ ok: false, error: 'Document access denied' });
      return;
    }

    socket.data.documentRoles ??= new Map<string, DocumentRole>();
    socket.data.documentRoles.set(docId, role);
    socket.join(`doc:${docId}`);
    console.log(`User ${socket.data.userId} joined doc ${docId}`);

    // Broadcast presence
    collabNamespace.to(`doc:${docId}`).emit('user_joined', {
      userId: socket.data.userId,
      socketId: socket.id,
      timestamp: new Date().toISOString(),
    });

    if (typeof ack === 'function') ack({ ok: true, role });
  });

  // Leave room
  socket.on('leave_room', (data) => {
    const docId = typeof data?.docId === 'string' ? data.docId : '';
    const room = `doc:${docId}`;
    if (!socket.rooms.has(room)) return;

    socket.leave(room);
    collabNamespace.to(room).emit('user_left', {
      userId: socket.data.userId,
      timestamp: new Date().toISOString(),
    });
    socket.data.documentRoles?.delete(docId);
  });

  const canRelay = (docId: unknown, write = false) => {
    if (typeof docId !== 'string' || !socket.rooms.has(`doc:${docId}`)) return false;
    const role = socket.data.documentRoles?.get(docId) as DocumentRole | undefined;
    return Boolean(role && (!write || role === 'owner' || role === 'editor'));
  };

  // Yjs sync protocol (placeholder)
  socket.on('sync_step1', (data) => {
    if (canRelay(data?.docId)) socket.to(`doc:${data.docId}`).emit('sync_step1', data);
  });

  socket.on('sync_step2', (data) => {
    if (canRelay(data?.docId)) socket.to(`doc:${data.docId}`).emit('sync_step2', data);
  });

  // Yjs update
  socket.on('update', (data) => {
    if (canRelay(data?.docId, true)) socket.to(`doc:${data.docId}`).emit('update', data);
  });

  // Awareness (presence)
  socket.on('awareness', (data) => {
    if (canRelay(data?.docId)) socket.to(`doc:${data.docId}`).emit('awareness', data);
  });

  socket.on('disconnect', () => {
    for (const room of socket.rooms) {
      if (room.startsWith('doc:')) {
        collabNamespace.to(room).emit('user_left', {
          userId: socket.data.userId,
          timestamp: new Date().toISOString(),
        });
      }
    }
    console.log(`User ${socket.id} disconnected from /collab`);
  });
});

// Error middleware (must be last)
app.use(errorMiddleware);

// Initialize version cleanup service
scheduleVersionCleanup().catch((err) => {
  console.error('✗ Failed to schedule version cleanup:', err);
});

const PORT = process.env.PORT || 3001;
httpServer.listen(PORT, () => {
  console.log(`✓ Server running on port ${PORT}`);
  console.log(`  - Health: http://localhost:${PORT}/health`);
  console.log(`  - WebSocket: ws://localhost:${PORT}/collab`);
});
