const prisma = require('../lib/prisma');

// Limites par rôle
const LIMITS = {
  USER:    { daily: 5,  perConv: 3  }, // 5 msg/jour, 3 par conversation
  PREMIUM: { daily: -1, perConv: -1 }, // illimité
  ADMIN:   { daily: -1, perConv: -1 }, // illimité
};

async function checkLimits(userId, role, receiverId) {
  const limit = LIMITS[role] || LIMITS.USER;
  if (limit.daily === -1) return { allowed: true, quota: { unlimited: true } };

  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  // Limite journalière globale
  const dailyUsed = await prisma.message.count({
    where: { senderId: userId, createdAt: { gte: startOfDay } }
  });

  if (dailyUsed >= limit.daily) {
    return {
      allowed: false,
      reason: 'daily_limit_reached',
      quota: { unlimited: false, used: dailyUsed, limit: limit.daily, remaining: 0 }
    };
  }

  // Limite par conversation (premiers messages seulement — encourage le contact naturel)
  if (limit.perConv > 0) {
    const convCount = await prisma.message.count({
      where: { senderId: userId, receiverId, createdAt: { gte: startOfDay } }
    });
    if (convCount >= limit.perConv) {
      return {
        allowed: false,
        reason: 'conv_limit_reached',
        quota: {
          unlimited: false,
          used: dailyUsed,
          limit: limit.daily,
          remaining: Math.max(0, limit.daily - dailyUsed),
          convUsed: convCount,
          convLimit: limit.perConv,
        }
      };
    }
  }

  return {
    allowed: true,
    quota: {
      unlimited: false,
      used: dailyUsed,
      limit: limit.daily,
      remaining: Math.max(0, limit.daily - dailyUsed - 1),
    }
  };
}

exports.getConversations = async (req, res) => {
  const userId = req.user.id;

  const messages = await prisma.message.findMany({
    where: { OR: [{ senderId: userId }, { receiverId: userId }] },
    orderBy: { createdAt: 'desc' },
    include: {
      sender: { select: { id: true, profile: { select: { displayName: true, isOnline: true, photos: { where: { isMain: true }, take: 1 } } } } },
      receiver: { select: { id: true, profile: { select: { displayName: true, isOnline: true, photos: { where: { isMain: true }, take: 1 } } } } }
    }
  });

  const seen = new Set();
  const conversations = [];
  for (const msg of messages) {
    const otherId = msg.senderId === userId ? msg.receiverId : msg.senderId;
    if (!seen.has(otherId)) {
      seen.add(otherId);
      const other = msg.senderId === userId ? msg.receiver : msg.sender;
      const unread = await prisma.message.count({
        where: { senderId: otherId, receiverId: userId, isRead: false }
      });
      conversations.push({ other, lastMessage: msg, unread });
    }
  }

  res.json(conversations);
};

exports.getMessages = async (req, res) => {
  const userId = req.user.id;
  const { otherId } = req.params;
  const { page = 1, limit = 30 } = req.query;

  const messages = await prisma.message.findMany({
    where: {
      OR: [
        { senderId: userId, receiverId: otherId },
        { senderId: otherId, receiverId: userId }
      ]
    },
    orderBy: { createdAt: 'desc' },
    skip: (parseInt(page) - 1) * parseInt(limit),
    take: parseInt(limit)
  });

  await prisma.message.updateMany({
    where: { senderId: otherId, receiverId: userId, isRead: false },
    data: { isRead: true }
  });

  res.json(messages.reverse());
};

exports.sendMessage = async (req, res) => {
  try {
    const { receiverId, content } = req.body;
    if (!content?.trim()) return res.status(400).json({ error: 'Message vide' });
    if (!receiverId) return res.status(400).json({ error: 'Destinataire manquant' });

    // Vérifier les limites
    const { allowed, reason, quota } = await checkLimits(req.user.id, req.user.role, receiverId);

    if (!allowed) {
      const msg = reason === 'daily_limit_reached'
        ? `Limite de ${quota.limit} messages/jour atteinte. Passez Premium pour des messages illimités.`
        : `Limite de ${quota.convLimit} messages par conversation atteinte aujourd'hui.`;
      return res.status(403).json({ error: reason, message: msg, quota });
    }

    const message = await prisma.message.create({
      data: { senderId: req.user.id, receiverId, content: content.trim() },
      include: {
        sender: { select: { id: true, profile: { select: { displayName: true, photos: { where: { isMain: true }, take: 1 } } } } }
      }
    });

    res.json({ ...message, quota });
  } catch (err) {
    console.error('sendMessage error:', err.message);
    res.status(500).json({ error: 'Erreur serveur' });
  }
};

exports.deleteMessage = async (req, res) => {
  const msg = await prisma.message.findUnique({ where: { id: req.params.id } });
  if (!msg || msg.senderId !== req.user.id) return res.status(403).json({ error: 'Non autorisé' });
  await prisma.message.delete({ where: { id: req.params.id } });
  res.json({ success: true });
};

exports.markAsRead = async (req, res) => {
  try {
    const { otherId } = req.params;
    await prisma.message.updateMany({
      where: { senderId: otherId, receiverId: req.user.id, isRead: false },
      data: { isRead: true }
    });
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: 'Erreur serveur' });
  }
};

exports.getMessageQuota = async (req, res) => {
  try {
    const role = req.user.role;
    const limit = LIMITS[role] || LIMITS.USER;

    if (limit.daily === -1) return res.json({ unlimited: true, used: 0, limit: 0, remaining: 0 });

    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const used = await prisma.message.count({
      where: { senderId: req.user.id, createdAt: { gte: startOfDay } }
    });

    res.json({
      unlimited: false,
      used,
      limit: limit.daily,
      perConvLimit: limit.perConv,
      remaining: Math.max(0, limit.daily - used),
    });
  } catch {
    res.status(500).json({ error: 'Erreur serveur' });
  }
};
