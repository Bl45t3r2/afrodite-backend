const { PrismaClient } = require('@prisma/client');
const { createNotification } = require('./notificationService');
const prisma = new PrismaClient();

// Générer un code unique (6 caractères alphanumériques lisibles)
function generateCode(displayName = '') {
  const base = displayName.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, 3) || 'AFR';
  const rand = Math.random().toString(36).toUpperCase().slice(2, 5);
  return `${base}${rand}`;
}

// S'assurer que le code est unique en base
async function uniqueCode(displayName) {
  let code, exists;
  let attempts = 0;
  do {
    code = generateCode(displayName);
    exists = await prisma.user.findUnique({ where: { referralCode: code } });
    attempts++;
  } while (exists && attempts < 10);
  return code;
}

/**
 * Créer ou récupérer le code de parrainage d'un utilisateur
 */
exports.getOrCreateReferralCode = async (userId) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { profile: { select: { displayName: true } } }
  });
  if (!user) throw new Error('Utilisateur introuvable');
  if (user.referralCode) return user.referralCode;

  const code = await uniqueCode(user.profile?.displayName || '');
  await prisma.user.update({ where: { id: userId }, data: { referralCode: code } });
  return code;
};

/**
 * Appliquer un code de parrainage lors de l'inscription
 */
exports.applyReferralCode = async (newUserId, code) => {
  if (!code) return null;

  const referrer = await prisma.user.findUnique({
    where: { referralCode: code.toUpperCase() },
    include: { profile: { select: { displayName: true } } }
  });

  if (!referrer || referrer.id === newUserId) return null;

  // Lier le filleul au parrain
  await prisma.user.update({
    where: { id: newUserId },
    data: { referredById: referrer.id }
  });

  // Créer une récompense PENDING pour le parrain (activée quand le filleul s'abonne)
  const reward = await prisma.referralReward.create({
    data: {
      userId: referrer.id,
      referredId: newUserId,
      type: 'FREE_BOOST_DAY',
      status: 'PENDING',
      description: '1 jour de boost offert quand votre filleul prend un abonnement',
    }
  });

  // Notifier le parrain
  await createNotification({
    userId: referrer.id,
    type: 'SYSTEM',
    title: '🎉 Nouveau filleul !',
    body: 'Quelqu\'un a rejoint Afrodite avec votre code. Vous recevrez votre récompense dès son premier abonnement.',
    link: '/dashboard?tab=referral',
  });

  return reward;
};

/**
 * Activer les récompenses quand un filleul souscrit un abonnement
 */
exports.activateReferralRewards = async (newSubscriberId) => {
  const newUser = await prisma.user.findUnique({
    where: { id: newSubscriberId },
    include: { profile: { select: { displayName: true } } }
  });
  if (!newUser?.referredById) return;

  // Chercher les récompenses PENDING liées à ce filleul
  const pendingRewards = await prisma.referralReward.findMany({
    where: { referredId: newSubscriberId, status: 'PENDING' }
  });
  if (!pendingRewards.length) return;

  for (const reward of pendingRewards) {
    // Activer la récompense
    await prisma.referralReward.update({
      where: { id: reward.id },
      data: { status: 'APPLIED', appliedAt: new Date() }
    });

    // Appliquer selon le type
    if (reward.type === 'FREE_BOOST_DAY') {
      const profile = await prisma.profile.findUnique({ where: { userId: reward.userId } });
      if (profile) {
        // Désactiver les boosts existants
        await prisma.boost.updateMany({
          where: { profileId: profile.id, active: true },
          data: { active: false }
        });
        // Créer 1 jour de boost gratuit
        const endAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
        await prisma.boost.create({
          data: { profileId: profile.id, plan: 'DAY', endAt, active: true }
        });
      }
    } else if (reward.type === 'FREE_PREMIUM_DAY') {
      // Prolonger l'abonnement d'un jour
      const sub = await prisma.subscription.findUnique({ where: { userId: reward.userId } });
      if (sub) {
        const newEnd = new Date(Math.max(Date.now(), sub.currentPeriodEnd?.getTime() || 0) + 24 * 60 * 60 * 1000);
        await prisma.subscription.update({ where: { id: sub.id }, data: { currentPeriodEnd: newEnd } });
      }
    }

    // Notifier le parrain
    const filleulName = newUser.profile?.displayName || 'Votre filleul';
    await createNotification({
      userId: reward.userId,
      type: 'SYSTEM',
      title: '🎁 Récompense de parrainage activée !',
      body: `${filleulName} vient de souscrire un abonnement. Votre récompense est maintenant active !`,
      link: '/dashboard?tab=referral',
    });
  }
};

/**
 * Statistiques de parrainage d'un utilisateur
 */
exports.getReferralStats = async (userId) => {
  const [user, referrals, rewards] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { referralCode: true, referredById: true }
    }),
    // Liste des filleuls
    prisma.user.findMany({
      where: { referredById: userId },
      select: {
        id: true,
        createdAt: true,
        subscription: { select: { status: true, plan: true } },
        profile: { select: { displayName: true, city: true, photos: { where: { isMain: true }, take: 1 } } }
      },
      orderBy: { createdAt: 'desc' }
    }),
    // Récompenses
    prisma.referralReward.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' }
    })
  ]);

  const totalReferrals = referrals.length;
  const convertedReferrals = referrals.filter(r =>
    r.subscription && ['ACTIVE', 'TRIAL'].includes(r.subscription.status)
  ).length;
  const pendingRewards = rewards.filter(r => r.status === 'PENDING').length;
  const appliedRewards = rewards.filter(r => r.status === 'APPLIED').length;

  return {
    referralCode: user?.referralCode || null,
    referralLink: `${process.env.CLIENT_URL}/auth/register?ref=${user?.referralCode}`,
    totalReferrals,
    convertedReferrals,
    conversionRate: totalReferrals > 0 ? Math.round((convertedReferrals / totalReferrals) * 100) : 0,
    pendingRewards,
    appliedRewards,
    referrals,
    rewards,
  };
};
