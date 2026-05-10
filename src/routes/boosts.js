const cache = require('../services/cacheService');
const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const BOOST_PLANS = {
  DAY:   { duration: 1,  days: 1,  price: 1000,  label: '24 heures' },
  WEEK:  { duration: 7,  days: 7,  price: 5000,  label: '7 jours' },
  MONTH: { duration: 30, days: 30, price: 15000, label: '30 jours' },
};

// GET /boosts/plans — tarifs disponibles
router.get('/plans', (req, res) => {
  res.json(Object.entries(BOOST_PLANS).map(([key, val]) => ({ plan: key, ...val })));
});

// GET /boosts/my — boost actif du profil connecté
router.get('/my', authenticate, async (req, res) => {
  try {
    const profile = await prisma.profile.findUnique({ where: { userId: req.user.id } });
    if (!profile) return res.status(404).json({ error: 'Profil introuvable' });

    const boost = await prisma.boost.findFirst({
      where: { profileId: profile.id, active: true, endAt: { gt: new Date() } },
      orderBy: { endAt: 'desc' },
    });

    res.json(boost || null);
  } catch {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// POST /boosts/checkout/stripe — payer un boost par carte
router.post('/checkout/stripe', authenticate, async (req, res) => {
  const { plan } = req.body;
  if (!BOOST_PLANS[plan]) return res.status(400).json({ error: 'Plan invalide' });
  try {
    const { createStripeCheckout } = require('../services/paymentService');
    const result = await createStripeCheckout({
      userId: req.user.id,
      purpose: 'BOOST',
      plan,
      successUrl: `${process.env.CLIENT_URL}/dashboard/boost`,
      cancelUrl: `${process.env.CLIENT_URL}/dashboard/boost`,
    });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /boosts/checkout/mobile-money — payer un boost par Mobile Money
router.post('/checkout/mobile-money', authenticate, async (req, res) => {
  const { plan, phoneNumber, operator } = req.body;
  if (!BOOST_PLANS[plan]) return res.status(400).json({ error: 'Plan invalide' });
  if (!phoneNumber) return res.status(400).json({ error: 'Numéro requis' });
  try {
    const { createFedapayTransaction } = require('../services/paymentService');
    const result = await createFedapayTransaction({
      userId: req.user.id,
      purpose: 'BOOST',
      plan,
      phoneNumber,
      operator,
    });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /boosts/featured — profils boostés pour la page d'accueil
router.get('/featured', async (req, res) => {
  try {
    const cached = await cache.get('boosts:featured');
    if (cached) return res.json(cached);
    const boosts = await prisma.boost.findMany({
      where: { active: true, endAt: { gt: new Date() } },
      include: {
        profile: {
          include: {
            photos: { where: { isMain: true, isPrivate: false }, take: 1 },
            videos: { where: { isPrivate: false, isMain: true }, take: 1 },
            _count: { select: { reviews: true, favoritedBy: true } }
          }
        }
      },
      orderBy: { startAt: 'desc' },
      take: 8,
    });

    const profiles = boosts
      .map(b => b.profile)
      .filter(p => p && p.status === 'ACTIVE');

    await cache.set('boosts:featured', profiles, cache.TTL.BOOSTS_FEATURED);
    res.json(profiles);
  } catch {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Admin — liste tous les boosts
router.get('/admin', authenticate, async (req, res) => {
  if (req.user.role !== 'ADMIN') return res.status(403).json({ error: 'Non autorisé' });
  const boosts = await prisma.boost.findMany({
    include: { profile: { select: { displayName: true, city: true } } },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });
  res.json(boosts);
});

module.exports = router;
