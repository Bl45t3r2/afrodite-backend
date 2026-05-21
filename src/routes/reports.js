const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const prisma = require('../lib/prisma');
const { sendNotification } = require('../socket');

const REASON_LABELS = {
  FAKE_PROFILE: 'Faux profil',
  INAPPROPRIATE_CONTENT: 'Contenu inapproprié',
  SCAM: 'Arnaque',
  UNDERAGE: 'Personne mineure',
  SPAM: 'Spam',
  OTHER: 'Autre',
};

// POST /reports — soumettre un signalement
router.post('/', authenticate, async (req, res) => {
  const { profileId, reason, details } = req.body;
  if (!profileId || !reason) return res.status(400).json({ error: 'Profil et raison requis' });

  try {
    // Vérifier si déjà signalé par cet utilisateur
    const existing = await prisma.report.findFirst({
      where: { reporterId: req.user.id, profileId, status: 'PENDING' }
    });
    if (existing) return res.status(409).json({ error: 'Vous avez déjà signalé ce profil' });

    const report = await prisma.report.create({
      data: {
        reporterId: req.user.id,
        profileId,
        reason,
        details: details || null,
        status: 'PENDING',
      },
      include: {
        profile: { select: { displayName: true } },
        reporter: { select: { email: true } }
      }
    });

    // Notifier tous les admins
    const admins = await prisma.user.findMany({ where: { role: 'ADMIN' } });
    for (const admin of admins) {
      await sendNotification({
        userId: admin.id,
        type: 'SYSTEM',
        title: '🚨 Nouveau signalement',
        body: `${report.profile.displayName} signalé pour : ${REASON_LABELS[reason]}`,
        link: '/admin?tab=reports',
      });
    }

    res.status(201).json({ success: true, message: 'Signalement envoyé. Notre équipe va examiner ce profil.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// GET /reports — liste pour admin
router.get('/', authenticate, async (req, res) => {
  if (req.user.role !== 'ADMIN') return res.status(403).json({ error: 'Non autorisé' });

  const { status = 'PENDING' } = req.query;
  try {
    const reports = await prisma.report.findMany({
      where: status !== 'ALL' ? { status } : {},
      include: {
        reporter: { select: { email: true, profile: { select: { displayName: true } } } },
        profile: { select: { id: true, displayName: true, city: true, photos: { where: { isMain: true }, take: 1 } } },
      },
      orderBy: { createdAt: 'desc' },
    });
    const counts = await prisma.report.groupBy({
      by: ['status'],
      _count: true,
    });
    res.json({ reports, counts });
  } catch {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// PATCH /reports/:id — traiter un signalement
router.patch('/:id', authenticate, async (req, res) => {
  if (req.user.role !== 'ADMIN') return res.status(403).json({ error: 'Non autorisé' });

  const { status, action } = req.body;
  try {
    await prisma.report.update({
      where: { id: req.params.id },
      data: { status }
    });

    // Si action = suspendre le profil signalé
    if (action === 'suspend') {
      const report = await prisma.report.findUnique({ where: { id: req.params.id } });
      await prisma.profile.update({
        where: { id: report.profileId },
        data: { status: 'SUSPENDED' }
      });
    }

    res.json({ success: true });
  } catch {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

module.exports = router;
