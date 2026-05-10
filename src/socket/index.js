const { PrismaClient } = require('@prisma/client');
const { createNotification } = require('../services/notificationService');
const prisma = new PrismaClient();

let _io = null;
exports.getIO = () => _io;

exports.initSocket = (io) => {
  _io = io;

  io.on('connection', (socket) => {

    // ── Auth ──
    socket.on('auth', (userId) => {
      socket.userId = userId;
      socket.join(`user:${userId}`);
      prisma.profile.updateMany({ where: { userId }, data: { isOnline: true } }).catch(() => {});
      io.emit('user:online', userId);
      socket.emit('auth:success', { userId });
    });

    // ── Messagerie ──
    socket.on('join:conversation', (otherId) => {
      const roomId = [socket.userId, otherId].sort().join('-');
      socket.join(roomId);
    });

    socket.on('message:send', async ({ receiverId, content }) => {
      try {
        const message = await prisma.message.create({
          data: { senderId: socket.userId, receiverId, content },
          include: { sender: { include: { profile: { select: { displayName: true, photos: { where: { isMain: true }, take: 1 } } } } } }
        });

        const roomId = [socket.userId, receiverId].sort().join('-');
        io.to(roomId).emit('message:new', message);

        const senderName = message.sender?.profile?.displayName || 'Quelqu\'un';
        await createNotification({
          userId: receiverId,
          type: 'MESSAGE',
          title: `Nouveau message de ${senderName}`,
          body: content.length > 60 ? content.substring(0, 60) + '...' : content,
          link: `/messages?with=${socket.userId}`,
          io,
        });
      } catch (err) {
        socket.emit('message:error', { error: 'Erreur envoi message' });
      }
    });

    socket.on('messages:read', async ({ senderId }) => {
      try {
        await prisma.message.updateMany({
          where: { senderId, receiverId: socket.userId, isRead: false },
          data: { isRead: true }
        });
        const roomId = [socket.userId, senderId].sort().join('-');
        io.to(roomId).emit('messages:read', { readBy: socket.userId });
      } catch (err) {
        console.error('messages:read error:', err.message);
      }
    });

    socket.on('typing:start', ({ receiverId }) => {
      io.to(`user:${receiverId}`).emit('typing:start', { userId: socket.userId });
    });

    socket.on('typing:stop', ({ receiverId }) => {
      io.to(`user:${receiverId}`).emit('typing:stop', { userId: socket.userId });
    });

    // ── WebRTC Signaling ──

    // 1. Initiateur envoie une offre d'appel
    socket.on('call:offer', ({ receiverId, offer, callType }) => {
      const callerId = socket.userId;
      if (!callerId || !receiverId) return;

      io.to(`user:${receiverId}`).emit('call:incoming', {
        callerId,
        offer,
        callType, // 'video' | 'audio'
      });
    });

    // 2. Destinataire accepte et envoie sa réponse
    socket.on('call:answer', ({ callerId, answer }) => {
      io.to(`user:${callerId}`).emit('call:answered', {
        answer,
        answererId: socket.userId,
      });
    });

    // 3. Échange de candidats ICE (pour traversée NAT)
    socket.on('call:ice-candidate', ({ receiverId, candidate }) => {
      io.to(`user:${receiverId}`).emit('call:ice-candidate', {
        candidate,
        senderId: socket.userId,
      });
    });

    // 4. Refus d'appel
    socket.on('call:reject', ({ callerId }) => {
      io.to(`user:${callerId}`).emit('call:rejected', {
        rejecterId: socket.userId,
      });
    });

    // 5. Raccrocher
    socket.on('call:end', ({ receiverId }) => {
      io.to(`user:${receiverId}`).emit('call:ended', {
        enderId: socket.userId,
      });
    });

    // 6. Sonnerie annulée (l'appelant raccroche avant réponse)
    socket.on('call:cancel', ({ receiverId }) => {
      io.to(`user:${receiverId}`).emit('call:cancelled', {
        callerId: socket.userId,
      });
    });

    // ── Déconnexion ──
    socket.on('disconnect', () => {
      if (socket.userId) {
        prisma.profile.updateMany({ where: { userId: socket.userId }, data: { isOnline: false } }).catch(() => {});
        io.emit('user:offline', socket.userId);
      }
    });
  });
};

// Notif externe (depuis controllers)
exports.sendNotification = async ({ userId, type, title, body, link }) => {
  await createNotification({ userId, type, title, body, link, io: _io });
};
