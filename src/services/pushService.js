const webpush = require('web-push');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Configurer VAPID (les clés sont dans .env)
if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(
    `mailto:${process.env.VAPID_EMAIL || 'contact@afrodite.com'}`,
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  );
}

/**
 * Envoyer une push notification à tous les appareils d'un utilisateur
 */
exports.sendPushToUser = async (userId, { title, body, icon, badge, url }) => {
  if (!process.env.VAPID_PUBLIC_KEY) return; // Push non configuré

  try {
    const subs = await prisma.pushSubscription.findMany({ where: { userId } });
    if (!subs.length) return;

    const payload = JSON.stringify({
      title,
      body,
      icon: icon || '/icon-192.png',
      badge: badge || '/badge-72.png',
      url: url || '/',
      timestamp: Date.now(),
    });

    const results = await Promise.allSettled(
      subs.map(sub =>
        webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          payload
        ).catch(async (err) => {
          // Abonnement expiré → supprimer
          if (err.statusCode === 410 || err.statusCode === 404) {
            await prisma.pushSubscription.deleteMany({ where: { endpoint: sub.endpoint } });
          }
          throw err;
        })
      )
    );

    const sent = results.filter(r => r.status === 'fulfilled').length;
    console.log(`Push envoyé à ${sent}/${subs.length} appareils (userId: ${userId})`);
  } catch (err) {
    console.error('Push error:', err.message);
  }
};

/**
 * Sauvegarder un abonnement push
 */
exports.saveSubscription = async (userId, subscription, userAgent) => {
  const { endpoint, keys: { p256dh, auth } } = subscription;
  return prisma.pushSubscription.upsert({
    where: { endpoint },
    update: { userId, p256dh, auth, userAgent },
    create: { userId, endpoint, p256dh, auth, userAgent },
  });
};

/**
 * Supprimer un abonnement push
 */
exports.removeSubscription = async (endpoint) => {
  await prisma.pushSubscription.deleteMany({ where: { endpoint } });
};

exports.getVapidPublicKey = () => process.env.VAPID_PUBLIC_KEY || null;
