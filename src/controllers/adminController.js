const prisma = require('../lib/prisma');

exports.getStats = async (req, res) => {
  const now = new Date();
  const startOfToday = new Date(now); startOfToday.setHours(0,0,0,0);
  const startOf7Days = new Date(now - 7 * 24 * 60 * 60 * 1000);
  const startOf30Days = new Date(now - 30 * 24 * 60 * 60 * 1000);

  const [
    totalUsers, totalProfiles, activeProfiles, pendingProfiles, totalMessages,
    newUsersToday, newUsers7Days, newUsers30Days,
    messagesToday, messages7Days,
    premiumUsers, onlineProfiles,
    pendingMedia, pendingVerifs,
    revenueData, topCities,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.profile.count(),
    prisma.profile.count({ where: { status: 'ACTIVE' } }),
    prisma.profile.count({ where: { status: 'PENDING' } }),
    prisma.message.count(),
    prisma.user.count({ where: { createdAt: { gte: startOfToday } } }),
    prisma.user.count({ where: { createdAt: { gte: startOf7Days } } }),
    prisma.user.count({ where: { createdAt: { gte: startOf30Days } } }),
    prisma.message.count({ where: { createdAt: { gte: startOfToday } } }),
    prisma.message.count({ where: { createdAt: { gte: startOf7Days } } }),
    prisma.user.count({ where: { role: 'PREMIUM' } }),
    prisma.profile.count({ where: { isOnline: true, status: 'ACTIVE' } }),
    prisma.photo.count({ where: { moderationStatus: 'PENDING' } }),
    prisma.identityVerification.count({ where: { status: 'PENDING' } }),
    prisma.payment.groupBy({ by: ['status'], _sum: { amount: true } }),
    prisma.profile.groupBy({ by: ['city'], _count: { city: true }, orderBy: { _count: { city: 'desc' } }, take: 5, where: { status: 'ACTIVE' } }),
  ]);

  // Inscription par jour sur 7 jours
  const registrationsPerDay = [];
  for (let i = 6; i >= 0; i--) {
    const start = new Date(now - i * 24 * 60 * 60 * 1000); start.setHours(0,0,0,0);
    const end = new Date(start); end.setHours(23,59,59,999);
    const count = await prisma.user.count({ where: { createdAt: { gte: start, lte: end } } });
    registrationsPerDay.push({ date: start.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric' }), count });
  }

  // Revenu total complété
  const totalRevenueFcfa = revenueData.find(r => r.status === 'COMPLETED')?._sum?.amount || 0;

  res.json({
    totalUsers, totalProfiles, activeProfiles, pendingProfiles, totalMessages,
    newUsersToday, newUsers7Days, newUsers30Days,
    messagesToday: messagesToday || 0, messages7Days,
    premiumUsers, onlineProfiles,
    pendingMedia, pendingVerifs,
    totalRevenueFcfa,
    topCities: topCities.map(c => ({ city: c.city, count: c._count.city })),
    registrationsPerDay,
    revenuePerDay,
    revenueByPlan: revenueByPlan.map(r => ({ plan: r.plan || 'N/A', amount: r._sum.amount || 0, count: r._count.plan })),
    revenueByProvider: revenueByProvider.map(r => ({ provider: r.provider, amount: r._sum.amount || 0, count: r._count.provider })),
    revenueThisMonth: revenueThisMonth._sum.amount || 0,
    revenueLastMonth: revenueLastMonth._sum.amount || 0,
    conversionRate: totalUsers > 0 ? Math.round((premiumUsers / totalUsers) * 100) : 0,
  });
};

exports.getPendingProfiles = async (req, res) => {
  const profiles = await prisma.profile.findMany({
    where: { status: 'PENDING' },
    include: { photos: true, user: { select: { email: true } } },
    orderBy: { createdAt: 'asc' }
  });
  res.json(profiles);
};

exports.moderateProfile = async (req, res) => {
  const { id } = req.params;
  const { action } = req.body; // 'approve' | 'reject' | 'suspend' | 'ban'

  const statusMap = {
    approve: 'ACTIVE',
    reject: 'PENDING',
    suspend: 'SUSPENDED',
    ban: 'BANNED'
  };

  const verifiedMap = { approve: true };

  const profile = await prisma.profile.update({
    where: { id },
    data: {
      status: statusMap[action] || 'PENDING',
      isVerified: verifiedMap[action] || false
    }
  });

  res.json(profile);
};

exports.getAllUsers = async (req, res) => {
  const { page = 1, search } = req.query;
  const where = search ? { email: { contains: search, mode: 'insensitive' } } : {};

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      skip: (parseInt(page) - 1) * 20,
      take: 20,
      include: { profile: { select: { displayName: true, status: true } }, subscription: true },
      orderBy: { createdAt: 'desc' }
    }),
    prisma.user.count({ where })
  ]);

  res.json({ users, total });
};

exports.updateUserRole = async (req, res) => {
  const { role } = req.body;
  const user = await prisma.user.update({
    where: { id: req.params.id },
    data: { role }
  });
  res.json(user);
};

const {
  approvePhoto, rejectPhoto, approveVideo, rejectVideo,
  approveIdentity, rejectIdentity
} = require('../services/moderationService');

// ── Modération médias ──

exports.getPendingMedia = async (req, res) => {
  try {
    const [photos, videos] = await Promise.all([
      prisma.photo.findMany({
        where: { moderationStatus: 'PENDING' },
        include: { profile: { select: { id: true, displayName: true, city: true, user: { select: { email: true } } } } },
        orderBy: { createdAt: 'asc' },
        take: 50,
      }),
      prisma.video.findMany({
        where: { moderationStatus: 'PENDING' },
        include: { profile: { select: { id: true, displayName: true, city: true, user: { select: { email: true } } } } },
        orderBy: { createdAt: 'asc' },
        take: 20,
      }),
    ]);
    res.json({ photos, videos });
  } catch (err) {
    console.error('getPendingMedia error:', err.message);
    res.status(500).json({ error: 'Erreur serveur' });
  }
};

exports.approvePhoto = async (req, res) => {
  try {
    const photo = await approvePhoto(req.params.id, req.user.id);
    res.json(photo);
  } catch (err) { res.status(500).json({ error: err.message }); }
};

exports.rejectPhoto = async (req, res) => {
  try {
    const photo = await rejectPhoto(req.params.id, req.body.note, req.user.id);
    res.json(photo);
  } catch (err) { res.status(500).json({ error: err.message }); }
};

exports.approveVideo = async (req, res) => {
  try {
    const video = await approveVideo(req.params.id);
    res.json(video);
  } catch (err) { res.status(500).json({ error: err.message }); }
};

exports.rejectVideo = async (req, res) => {
  try {
    const video = await rejectVideo(req.params.id, req.body.note);
    res.json(video);
  } catch (err) { res.status(500).json({ error: err.message }); }
};

// ── Vérification d'identité ──

exports.getPendingVerifications = async (req, res) => {
  try {
    const verifications = await prisma.identityVerification.findMany({
      where: { status: 'PENDING' },
      include: { profile: { select: { displayName: true, city: true, age: true, user: { select: { email: true } } } } },
      orderBy: { submittedAt: 'asc' },
    });
    res.json(verifications);
  } catch (err) { res.status(500).json({ error: 'Erreur serveur' }); }
};

exports.approveVerification = async (req, res) => {
  try {
    const verif = await approveIdentity(req.params.id, req.user.id);
    res.json(verif);
  } catch (err) { res.status(500).json({ error: err.message }); }
};

exports.rejectVerification = async (req, res) => {
  try {
    const verif = await rejectIdentity(req.params.id, req.body.note, req.user.id);
    res.json(verif);
  } catch (err) { res.status(500).json({ error: err.message }); }
};

// ── Activité récente ──
exports.getRecentActivity = async (req, res) => {
  try {
    const [recentUsers, recentMessages, recentPayments, recentReports] = await Promise.all([
      prisma.user.findMany({
        take: 5,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          email: true,
          role: true,
          createdAt: true,
          profile: { select: { displayName: true, city: true } }
        }
      }),
      prisma.message.findMany({
        take: 5,
        orderBy: { createdAt: 'desc' },
        include: {
          sender: { select: { profile: { select: { displayName: true } } } },
          receiver: { select: { profile: { select: { displayName: true } } } }
        }
      }),
      prisma.payment.findMany({
        take: 5,
        orderBy: { createdAt: 'desc' },
        include: { user: { select: { email: true, profile: { select: { displayName: true } } } } }
      }),
      prisma.report.findMany({
        take: 5,
        orderBy: { createdAt: 'desc' },
        include: {
          profile: { select: { displayName: true } },
          reporter: { select: { email: true } }
        }
      }),
    ]);

    res.json({ recentUsers, recentMessages, recentPayments, recentReports });
  } catch (err) {
    console.error('getRecentActivity error:', err.message);
    res.status(500).json({ error: 'Erreur serveur' });
  }
};

// ── Bannir un utilisateur ──
exports.banUser = async (req, res) => {
  try {
    await prisma.profile.updateMany({
      where: { userId: req.params.id },
      data: { status: 'BANNED' }
    });
    await prisma.user.update({
      where: { id: req.params.id },
      data: { role: 'USER' }
    });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ── Supprimer un profil ──
exports.deleteProfile = async (req, res) => {
  try {
    await prisma.profile.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
