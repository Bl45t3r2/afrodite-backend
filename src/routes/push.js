const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { saveSubscription, removeSubscription, getVapidPublicKey } = require('../services/pushService');

// GET /push/vapid-key — clé publique VAPID pour le frontend
router.get('/vapid-key', (req, res) => {
  const key = getVapidPublicKey();
  if (!key) return res.status(503).json({ error: 'Push non configuré' });
  res.json({ publicKey: key });
});

// POST /push/subscribe — enregistrer un abonnement
router.post('/subscribe', authenticate, async (req, res) => {
  try {
    const { subscription } = req.body;
    if (!subscription?.endpoint || !subscription?.keys) {
      return res.status(400).json({ error: 'Abonnement invalide' });
    }
    const userAgent = req.headers['user-agent'] || null;
    await saveSubscription(req.user.id, subscription, userAgent);
    res.json({ success: true });
  } catch (err) {
    console.error('subscribe error:', err.message);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// DELETE /push/unsubscribe — supprimer un abonnement
router.delete('/unsubscribe', authenticate, async (req, res) => {
  try {
    const { endpoint } = req.body;
    if (endpoint) await removeSubscription(endpoint);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

module.exports = router;
