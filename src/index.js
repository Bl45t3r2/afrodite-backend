require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const { createServer } = require('http');
const { Server } = require('socket.io');
const rateLimit = require('express-rate-limit');

const authRoutes = require('./routes/auth');
const profileRoutes = require('./routes/profiles');
const messageRoutes = require('./routes/messages');
const subscriptionRoutes = require('./routes/subscriptions');
const adminRoutes = require('./routes/admin');
const uploadRoutes = require('./routes/upload');
const notificationRoutes = require('./routes/notifications');
const reportRoutes = require('./routes/reports');
const boostRoutes = require('./routes/boosts');
const availabilityRoutes = require('./routes/availability');
const pushRoutes = require('./routes/push');
const verificationRoutes = require('./routes/verification');
const referralRoutes = require('./routes/referral');
const { initSocket } = require('./socket');

const app = express();
const httpServer = createServer(app);

// Socket.io
const ALLOWED_ORIGINS = [
  process.env.CLIENT_URL,
  'http://localhost:3000',
  'http://localhost:3001',
].filter(Boolean);

const corsOptions = {
  origin: (origin, callback) => {
    if (!origin || ALLOWED_ORIGINS.includes(origin)) callback(null, true);
    else callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
};

const io = new Server(httpServer, {
  cors: corsOptions
});
initSocket(io);

// Middleware
app.use(helmet());
app.use(cors(corsOptions));
app.use(express.json());

// Rate limiting
const limiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 100 });
app.use('/api/', limiter);

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/profiles', profileRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/subscriptions', subscriptionRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/boosts', boostRoutes);
app.use('/api/availability', availabilityRoutes);
app.use('/api/push', pushRoutes);
app.use('/api/verification', verificationRoutes);
app.use('/api/referral', referralRoutes);

// Health check
app.get('/health', (req, res) => res.json({ status: 'ok' }));

// Error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({ error: err.message || 'Erreur serveur' });
});

const PORT = process.env.PORT || 4000;
httpServer.listen(PORT, () => {
  console.log(`✅ Serveur démarré sur le port ${PORT}`);
});
