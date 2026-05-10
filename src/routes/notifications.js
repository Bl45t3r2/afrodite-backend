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
