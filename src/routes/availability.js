const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const prisma = require('../lib/prisma');

const DAYS = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];

// GET /availability/:profileId — public, pour la page profil
router.get('/:profileId', async (req, res) => {
  try {
    const slots = await prisma.availability.findMany({
      where: { profileId: req.params.profileId, isActive: true },
      orderBy: { dayOfWeek: 'asc' },
    });
    res.json(slots);
  } catch (err) {
    console.error('get availability error:', err.message);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// GET /availability/me — mon propre agenda (authentifié)
router.get('/me/slots', authenticate, async (req, res) => {
  try {
    const profile = await prisma.profile.findUnique({ where: { userId: req.user.id } });
    if (!profile) return res.status(404).json({ error: 'Profil introuvable' });

    const slots = await prisma.availability.findMany({
      where: { profileId: profile.id },
      orderBy: { dayOfWeek: 'asc' },
    });
    res.json(slots);
  } catch (err) {
    console.error('get my availability error:', err.message);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// PUT /availability/me — sauvegarder tout l'agenda (upsert par jour)
router.put('/me', authenticate, async (req, res) => {
  try {
    const profile = await prisma.profile.findUnique({ where: { userId: req.user.id } });
    if (!profile) return res.status(404).json({ error: 'Profil introuvable' });

    const { slots } = req.body; // [{ dayOfWeek, startTime, endTime, isActive }]
    if (!Array.isArray(slots)) return res.status(400).json({ error: 'Format invalide' });

    // Upsert chaque créneau
    const results = await Promise.all(
      slots.map(slot =>
        prisma.availability.upsert({
          where: { profileId_dayOfWeek: { profileId: profile.id, dayOfWeek: slot.dayOfWeek } },
          update: {
            startTime: slot.startTime,
            endTime: slot.endTime,
            isActive: slot.isActive,
          },
          create: {
            profileId: profile.id,
            dayOfWeek: slot.dayOfWeek,
            startTime: slot.startTime,
            endTime: slot.endTime,
            isActive: slot.isActive,
          },
        })
      )
    );

    res.json(results);
  } catch (err) {
    console.error('save availability error:', err.message);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

module.exports = router;
