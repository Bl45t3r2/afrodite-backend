const express = require('express');
const router = express.Router();
const prisma = require('../lib/prisma');
const { authenticate, requireRole } = require('../middleware/auth');
const { getOrCreateReferralCode, getReferralStats } = require('../services/referralService');

// GET /referral/code
router.get('/code', authenticate, async (req, res) => {
  try {
    const code = await getOrCreateReferralCode(req.user.id);
    res.json({ code, link: `${process.env.CLIENT_URL}/auth/register?ref=${code}` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /referral/stats
router.get('/stats', authenticate, async (req, res) => {
  try {
    const stats = await getReferralStats(req.user.id);
    res.json(stats);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /referral/partners — liste tous les codes partenaires (admin)
router.get('/partners', authenticate, requireRole('ADMIN'), async (req, res) => {
  try {
    const partners = await prisma.user.findMany({
      where: { referralCode: { not: null } },
      select: {
        id: true, email: true, referralCode: true, createdAt: true,
        profile: { select: { displayName: true } },
        _count: { select: { referrals: true } },
        referrals: { select: { subscription: { select: { status: true } } } }
      },
      orderBy: { createdAt: 'desc' }
    });
    res.json(partners.map(p => ({
      id: p.id, email: p.email,
      displayName: p.profile?.displayName,
      code: p.referralCode,
      link: `${process.env.CLIENT_URL}/auth/register?ref=${p.referralCode}`,
      totalReferrals: p._count.referrals,
      converted: p.referrals.filter(r => r.subscription?.status === 'ACTIVE').length,
      createdAt: p.createdAt,
    })));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /referral/partner — créer un code partenaire (admin)
router.post('/partner', authenticate, requireRole('ADMIN'), async (req, res) => {
  try {
    const { code, email, displayName } = req.body;
    if (!code || !email) return res.status(400).json({ error: 'code et email requis' });

    const cleanCode = code.toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (cleanCode.length < 3) return res.status(400).json({ error: 'Code trop court' });

    const existing = await prisma.user.findUnique({ where: { referralCode: cleanCode } });
    if (existing) return res.status(409).json({ error: 'Ce code existe déjà' });

    let user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      const bcrypt = require('bcryptjs');
      const tempPassword = await bcrypt.hash(Math.random().toString(36).slice(2), 10);
      user = await prisma.user.create({
        data: {
          email, passwordHash: tempPassword, role: 'USER', isVerified: true,
          referralCode: cleanCode,
          profile: { create: { displayName: displayName || email.split('@')[0], city: 'Cotonou', age: 25, status: 'ACTIVE' } }
        }
      });
    } else {
      await prisma.user.update({ where: { id: user.id }, data: { referralCode: cleanCode } });
    }

    res.json({
      success: true, code: cleanCode,
      link: `${process.env.CLIENT_URL}/auth/register?ref=${cleanCode}`,
      userId: user.id, email: user.email,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /referral/partner/:code — supprimer un code partenaire (admin)
router.delete('/partner/:code', authenticate, requireRole('ADMIN'), async (req, res) => {
  try {
    const code = req.params.code.toUpperCase();
    await prisma.user.updateMany({ where: { referralCode: code }, data: { referralCode: null } });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
