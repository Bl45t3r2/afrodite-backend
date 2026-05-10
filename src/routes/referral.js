const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const {
  getOrCreateReferralCode,
  getReferralStats,
} = require('../services/referralService');

// GET /referral/code — obtenir ou créer son code
router.get('/code', authenticate, async (req, res) => {
  try {
    const code = await getOrCreateReferralCode(req.user.id);
    res.json({ code, link: `${process.env.CLIENT_URL}/auth/register?ref=${code}` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /referral/stats — statistiques complètes
router.get('/stats', authenticate, async (req, res) => {
  try {
    const stats = await getReferralStats(req.user.id);
    res.json(stats);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
