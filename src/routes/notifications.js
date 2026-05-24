const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { getUserNotifications, markAsRead, getUnreadCount } = require('../services/notificationService');

// GET /notifications — liste des notifs
router.get('/', authenticate, async (req, res) => {
  try {
    const notifs = await getUserNotifications(req.user.id);
    const unreadCount = await getUnreadCount(req.user.id);
    res.json({ notifications: notifs, unreadCount });
  } catch {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// PATCH /notifications/read-all — tout marquer lu
router.patch('/read-all', authenticate, async (req, res) => {
  try {
    await markAsRead(req.user.id);
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// PATCH /notifications/:id/read — marquer une notif lue
router.patch('/:id/read', authenticate, async (req, res) => {
  try {
    await markAsRead(req.user.id, req.params.id);
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

module.exports = router;

// POST /notifications/broadcast — envoyer une notif à tous ou un utilisateur (admin)
const { requireRole } = require('../middleware/auth');
router.post('/broadcast', authenticate, requireRole('ADMIN'), async (req, res) => {
  try {
    const { title, message, type, targetUserId, link } = req.body;
    if (!title || !message) return res.status(400).json({ error: 'title et message requis' });

    const { createNotification } = require('../services/notificationService');
    const { sendPushToUser } = require('../services/pushService');

    if (targetUserId) {
      // Notif à un utilisateur spécifique
      await createNotification({ userId: targetUserId, type: type || 'SYSTEM', title, body: message, link });
      await sendPushToUser(targetUserId, { title, body: message, url: link || '/' }).catch(() => {});
      res.json({ success: true, sent: 1 });
    } else {
      // Notif à tous les utilisateurs
      const users = await prisma.user.findMany({ select: { id: true }, where: { role: { not: 'ADMIN' } } });
      let sent = 0;
      for (const user of users) {
        await createNotification({ userId: user.id, type: type || 'SYSTEM', title, body: message, link });
        await sendPushToUser(user.id, { title, body: message, url: link || '/' }).catch(() => {});
        sent++;
      }
      res.json({ success: true, sent });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
