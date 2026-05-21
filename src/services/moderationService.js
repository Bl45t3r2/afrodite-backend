const cloudinary = require('cloudinary').v2;
const prisma = require('../lib/prisma');
const { sendPushToUser } = require('./pushService');
const { createNotification } = require('./notificationService');

/**
 * Analyse une image via Cloudinary AI moderation
 * Retourne { safe: bool, reason: string|null }
 */
exports.analyzeImage = async (publicId) => {
  try {
    // Cloudinary Add-on "AWS Rekognition" ou "Google AI" (si activé)
    // Fallback : moderation manuelle uniquement
    if (!process.env.CLOUDINARY_MODERATION_ADDON) {
      return { safe: null, reason: null, manual: true }; // Pas d'addon → modération manuelle
    }

    const result = await cloudinary.api.resource(publicId, {
      moderation: process.env.CLOUDINARY_MODERATION_ADDON // ex: 'aws_rek' ou 'google_video_moderation'
    });

    const mod = result.moderation?.[0];
    if (!mod) return { safe: null, reason: null, manual: true };

    const safe = mod.status === 'approved';
    const reason = !safe ? (mod.response?.moderation_labels?.map(l => l.name).join(', ') || 'Contenu inapproprié') : null;

    return { safe, reason, manual: false };
  } catch (err) {
    console.error('Moderation analyze error:', err.message);
    return { safe: null, reason: null, manual: true };
  }
};

/**
 * Approuver une photo manuellement
 */
exports.approvePhoto = async (photoId, adminId) => {
  const photo = await prisma.photo.update({
    where: { id: photoId },
    data: { moderationStatus: 'APPROVED', moderationNote: null },
    include: { profile: { select: { userId: true, displayName: true } } }
  });

  // Notifier le profil
  await createNotification({
    userId: photo.profile.userId,
    type: 'SYSTEM',
    title: '📸 Photo approuvée',
    body: 'Votre photo a été validée par notre équipe.',
    link: '/dashboard',
  });

  return photo;
};

/**
 * Rejeter une photo manuellement
 */
exports.rejectPhoto = async (photoId, note, adminId) => {
  const photo = await prisma.photo.update({
    where: { id: photoId },
    data: { moderationStatus: 'REJECTED', moderationNote: note || 'Contenu non conforme à nos règles.' },
    include: { profile: { select: { userId: true } } }
  });

  // Notifier le profil
  await createNotification({
    userId: photo.profile.userId,
    type: 'SYSTEM',
    title: '⚠️ Photo refusée',
    body: note || 'Votre photo n\'est pas conforme à nos règles. Veuillez en uploader une nouvelle.',
    link: '/dashboard',
  });

  return photo;
};

/**
 * Approuver une vidéo manuellement
 */
exports.approveVideo = async (videoId) => {
  const video = await prisma.video.update({
    where: { id: videoId },
    data: { moderationStatus: 'APPROVED' },
    include: { profile: { select: { userId: true } } }
  });
  await createNotification({
    userId: video.profile.userId,
    type: 'SYSTEM',
    title: '🎥 Vidéo approuvée',
    body: 'Votre vidéo a été validée.',
    link: '/dashboard',
  });
  return video;
};

/**
 * Rejeter une vidéo
 */
exports.rejectVideo = async (videoId, note) => {
  const video = await prisma.video.update({
    where: { id: videoId },
    data: { moderationStatus: 'REJECTED', moderationNote: note || 'Contenu non conforme.' },
    include: { profile: { select: { userId: true } } }
  });
  await createNotification({
    userId: video.profile.userId,
    type: 'SYSTEM',
    title: '⚠️ Vidéo refusée',
    body: note || 'Votre vidéo n\'est pas conforme à nos règles.',
    link: '/dashboard',
  });
  return video;
};

/**
 * Approuver une vérification d'identité
 */
exports.approveIdentity = async (verificationId, adminId) => {
  const verif = await prisma.identityVerification.update({
    where: { id: verificationId },
    data: { status: 'APPROVED', reviewedAt: new Date(), reviewedBy: adminId },
    include: { profile: { select: { id: true, userId: true } } }
  });

  // Attribuer le badge vérifié
  await prisma.profile.update({
    where: { id: verif.profile.id },
    data: { isVerified: true }
  });

  await createNotification({
    userId: verif.profile.userId,
    type: 'SYSTEM',
    title: '✅ Identité vérifiée !',
    body: 'Félicitations ! Votre badge "Vérifié" est maintenant actif sur votre profil.',
    link: '/dashboard',
  });

  return verif;
};

/**
 * Rejeter une vérification d'identité
 */
exports.rejectIdentity = async (verificationId, note, adminId) => {
  const verif = await prisma.identityVerification.update({
    where: { id: verificationId },
    data: { status: 'REJECTED', note, reviewedAt: new Date(), reviewedBy: adminId },
    include: { profile: { select: { userId: true } } }
  });

  await createNotification({
    userId: verif.profile.userId,
    type: 'SYSTEM',
    title: '❌ Vérification refusée',
    body: note || 'Votre demande de vérification n\'a pas pu être validée. Vérifiez les documents envoyés.',
    link: '/dashboard',
  });

  return verif;
};
