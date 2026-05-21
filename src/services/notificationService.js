const { sendPushToUser } = require('./pushService');
const prisma = require('../lib/prisma');

/**
 * Crée une notification en base et l'envoie via Socket.io en temps réel
 */
exports.createNotification = async ({ userId, type, title, body, link = null, io = null }) => {
  try {
    const notif = await prisma.notification.create({
      data: { userId, type, title, body, link }
    });

    // Envoi temps réel si socket disponible
    if (io) {
      io.to(`user:${userId}`).emit('notification:new', notif);
    }

    // Envoi push (même si l'onglet est fermé)
    sendPushToUser(userId, {
      title,
      body,
      url: link || '/',
    }).catch(() => {}); // non bloquant

    return notif;
  } catch (err) {
    console.error('Notification error:', err.message);
  }
};

exports.getUserNotifications = async (userId, limit = 20) => {
  return prisma.notification.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: limit,
  });
};

exports.markAsRead = async (userId, notifId = null) => {
  if (notifId) {
    return prisma.notification.updateMany({
      where: { id: notifId, userId },
      data: { read: true }
    });
  }
  // Marquer toutes comme lues
  return prisma.notification.updateMany({
    where: { userId },
    data: { read: true }
  });
};

exports.getUnreadCount = async (userId) => {
  return prisma.notification.count({ where: { userId, read: false } });
};
