const express = require('express');
const cors = require('cors');
const path = require('path');

const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);

// Helper to handle CORS origins flexibly (with/without trailing slashes)
const getAllowedOrigins = () => {
  const origins = ['http://localhost:5173'];
  const devUrl = 'http://localhost:4173';
  if (process.env.FRONTEND_URL) {
    const raw = process.env.FRONTEND_URL.replace(/\/$/, ""); // remove trailing slash
    origins.push(raw);
    origins.push(`${raw}/`); // allow with trailing slash too just in case
  }
  origins.push(devUrl);
  return origins;
};

// Initialize Socket.io
const io = new Server(server, {
  cors: {
    origin: (origin, callback) => {
      const allowed = getAllowedOrigins();
      if (!origin || allowed.includes(origin) || allowed.includes(origin.replace(/\/$/, ""))) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    }, credentials: true
  }
});

const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET || 'splito_secret_key_2026';

// Authenticate socket connections
io.use((socket, next) => {
  const token = socket.handshake.auth.token;
  if (!token) return next(new Error('Authentication error'));
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    socket.userId = payload.userId;
    next();
  } catch (err) {
    next(new Error('Authentication error'));
  }
});

io.on('connection', (socket) => {
  console.log('🔗 User connected via socket:', socket.userId);
  // User joins their own personal room to receive targeted events
  socket.join(`user_${socket.userId}`);

  socket.on('join_group', (groupId) => {
    socket.join(`group_${groupId}`);
  });

  socket.on('typing', ({ groupId, userName }) => {
    socket.to(`group_${groupId}`).emit('user_typing', { userName });
  });

  socket.on('stop_typing', ({ groupId }) => {
    socket.to(`group_${groupId}`).emit('user_stop_typing');
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.userId);
  });
});

// Middleware to inject `io` into `req`
app.use((req, res, next) => {
  req.io = io;
  next();
});

// ─── Middleware ───────────────────────────────────────────────────────────────
app.use(cors({
  origin: true,
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ─── Routes ───────────────────────────────────────────────────────────────────
app.use('/api/auth', require('./routes/auth'));
app.use('/api/groups', require('./routes/groups'));
app.use('/api/expenses', require('./routes/expenses'));
app.use('/api/settlements', require('./routes/settlements'));
app.use('/api/insights', require('./routes/insights'));
app.use('/api/ai', require('./routes/ai'));
app.use('/api/notifications', require('./routes/notifications'));
app.use('/api/profile', require('./routes/profile'));
app.use('/api/receipts', require('./routes/receipts'));
app.use('/api/settings', require('./routes/settings'));

// ─── Health check ─────────────────────────────────────────────────────────────
app.get('/api/health', (req, res) => res.json({ status: 'ok', time: new Date().toISOString() }));

// ─── 404 ─────────────────────────────────────────────────────────────────────
app.use((req, res) => res.status(404).json({ error: `Route ${req.path} not found` }));

// ─── Global error handler ─────────────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error('❌', err);
  res.status(500).json({ error: err.message || 'Internal server error' });
});

// ─── Start ────────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`🚀 Splito backend (w/ Socket.IO) running on http://localhost:${PORT}`);
  console.log(`📚 API docs:  http://localhost:${PORT}/api/health`);
});
