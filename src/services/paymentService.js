const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const prisma = require('../lib/prisma');
const { createNotification } = require('./notificationService');
const { activateReferralRewards } = require('./referralService');

const axios = require('axios');

// FedaPay via API REST (pas de SDK npm)
const FEDAPAY_BASE_URL = process.env.FEDAPAY_ENV === 'live'
  ? 'https://api.fedapay.com/v1'
  : 'https://sandbox-api.fedapay.com/v1';

const fedapayRequest = async (method, path, data) => {
  const res = await axios({
    method,
    url: `${FEDAPAY_BASE_URL}${path}`,
    headers: {
      'Authorization': `Bearer ${process.env.FEDAPAY_SECRET_KEY}`,
      'Content-Type': 'application/json',
    },
    data,
  });
  return res.data;
};

// Prix en FCFA
const SUBSCRIPTION_PRICES = {
  premium: { fcfa: 9990,  stripe_price_id: process.env.STRIPE_PRICE_PREMIUM, label: 'Premium' },
  vip:     { fcfa: 24990, stripe_price_id: process.env.STRIPE_PRICE_VIP,     label: 'VIP' },
};

const BOOST_PRICES = {
  DAY:   { fcfa: 1000,  label: 'Boost 24h' },
  WEEK:  { fcfa: 5000,  label: 'Boost 7 jours' },
  MONTH: { fcfa: 15000, label: 'Boost 30 jours' },
};

// ─── STRIPE ──────────────────────────────────────────

exports.createStripeCheckout = async ({ userId, purpose, plan, successUrl, cancelUrl }) => {
  const user = await prisma.user.findUnique({ where: { id: userId } });

  let customerId = user.stripeCustomerId;
  if (!customerId) {
    const customer = await stripe.customers.create({ email: user.email, metadata: { userId } });
    customerId = customer.id;
    await prisma.user.update({ where: { id: userId }, data: { stripeCustomerId: customerId } });
  }

  let sessionConfig;

  if (purpose === 'SUBSCRIPTION') {
    const planData = SUBSCRIPTION_PRICES[plan];
    if (!planData?.stripe_price_id) throw new Error(`Price ID Stripe manquant pour ${plan}`);

    sessionConfig = {
      customer: customerId,
      mode: 'subscription',
      line_items: [{ price: planData.stripe_price_id, quantity: 1 }],
      success_url: `${successUrl}?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: cancelUrl,
      metadata: { userId, purpose, plan },
      locale: 'fr',
    };
  } else if (purpose === 'BOOST') {
    const boostData = BOOST_PRICES[plan];
    if (!boostData) throw new Error(`Plan boost invalide : ${plan}`);

    sessionConfig = {
      customer: customerId,
      mode: 'payment',
      line_items: [{
        price_data: {
          currency: 'xof',
          unit_amount: boostData.fcfa,
          product_data: { name: `Afrodite — ${boostData.label}` },
        },
        quantity: 1,
      }],
      success_url: `${successUrl}?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: cancelUrl,
      metadata: { userId, purpose, plan },
      locale: 'fr',
    };
  }

  const session = await stripe.checkout.sessions.create(sessionConfig);

  // Créer l'enregistrement paiement
  await prisma.payment.create({
    data: {
      userId,
      amount: purpose === 'SUBSCRIPTION' ? SUBSCRIPTION_PRICES[plan]?.fcfa : BOOST_PRICES[plan]?.fcfa,
      provider: 'STRIPE',
      providerRef: session.id,
      purpose,
      plan,
      status: 'PENDING',
    }
  });

  return { url: session.url, sessionId: session.id };
};

// ─── FEDAPAY (Mobile Money) ───────────────────────────

exports.createFedapayTransaction = async ({ userId, purpose, plan, phoneNumber, operator }) => {
  if (!process.env.FEDAPAY_SECRET_KEY) throw new Error('FedaPay non configuré (clé manquante)');

  const user = await prisma.user.findUnique({ where: { id: userId } });
  const amount = purpose === 'SUBSCRIPTION'
    ? SUBSCRIPTION_PRICES[plan]?.fcfa
    : BOOST_PRICES[plan]?.fcfa;

  if (!amount) throw new Error('Plan invalide');

  const label = purpose === 'SUBSCRIPTION'
    ? SUBSCRIPTION_PRICES[plan]?.label
    : BOOST_PRICES[plan]?.label;

  // 1. Créer la transaction via API REST FedaPay
  const txData = await fedapayRequest('POST', '/transactions', {
    description: `Afrodite — ${label}`,
    amount,
    currency: { iso: 'XOF' },
    callback_url: `${process.env.CLIENT_URL}/payment/success?purpose=${purpose}&plan=${plan}`,
    customer: {
      firstname: user.email.split('@')[0],
      lastname: 'Client',
      email: user.email,
      phone_number: { number: phoneNumber, country: 'BJ' },
    },
    metadata: JSON.stringify({ userId, purpose, plan }),
  });

  const transactionId = txData.v1?.transaction?.id || txData.transaction?.id;
  if (!transactionId) throw new Error('FedaPay: transaction ID manquant');

  // 2. Générer le token de paiement
  const tokenData = await fedapayRequest('GET', `/transactions/${transactionId}/token`, null);
  const paymentUrl = tokenData.token?.token
    ? `https://checkout.fedapay.com/${tokenData.token.token}`
    : tokenData.url;

  if (!paymentUrl) throw new Error('FedaPay: URL de paiement manquante');

  // 3. Enregistrer le paiement en attente
  await prisma.payment.create({
    data: {
      userId,
      amount,
      provider: 'FEDAPAY',
      providerRef: String(transactionId),
      purpose,
      plan,
      status: 'PENDING',
    }
  });

  return { url: paymentUrl, transactionId };
};

// ─── WEBHOOKS ────────────────────────────────────────

exports.handleStripeWebhook = async (rawBody, signature) => {
  const event = stripe.webhooks.constructEvent(
    rawBody, signature, process.env.STRIPE_WEBHOOK_SECRET
  );

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object;
      const { userId, purpose, plan } = session.metadata;

      // Marquer le paiement comme complété
      await prisma.payment.updateMany({
        where: { providerRef: session.id },
        data: { status: 'COMPLETED' }
      });

      await fulfillPurchase({ userId, purpose, plan, providerRef: session.id });
      break;
    }

    case 'customer.subscription.deleted': {
      const sub = event.data.object;
      const user = await prisma.user.findFirst({ where: { stripeCustomerId: String(sub.customer) } });
      if (user) {
        await prisma.subscription.update({ where: { userId: user.id }, data: { status: 'CANCELLED' } });
        await prisma.user.update({ where: { id: user.id }, data: { role: 'USER' } });
        await createNotification({
          userId: user.id,
          type: 'SYSTEM',
          title: '⚠️ Abonnement annulé',
          body: 'Votre abonnement a pris fin. Passez à nouveau Premium pour conserver vos avantages.',
          link: '/tarifs',
        });
      }
      break;
    }

    case 'invoice.payment_failed': {
      const invoice = event.data.object;
      const user = await prisma.user.findFirst({ where: { stripeCustomerId: String(invoice.customer) } });
      if (user) {
        await createNotification({
          userId: user.id,
          type: 'SYSTEM',
          title: '💳 Paiement échoué',
          body: 'Le renouvellement de votre abonnement a échoué. Mettez à jour votre moyen de paiement.',
          link: '/dashboard',
        });
      }
      break;
    }
  }

  return { received: true };
};

exports.handleFedapayWebhook = async (payload) => {
  const { transaction } = payload;
  if (!transaction) return;

  const payment = await prisma.payment.findFirst({
    where: { providerRef: String(transaction.id), provider: 'FEDAPAY' }
  });
  if (!payment) return;

  if (transaction.status === 'approved') {
    await prisma.payment.update({ where: { id: payment.id }, data: { status: 'COMPLETED' } });
    await fulfillPurchase({ userId: payment.userId, purpose: payment.purpose, plan: payment.plan, providerRef: String(transaction.id) });
  } else if (['declined', 'canceled'].includes(transaction.status)) {
    await prisma.payment.update({ where: { id: payment.id }, data: { status: 'FAILED' } });
  }
};

// ─── FULFILLMENT (actions après paiement réussi) ─────

async function fulfillPurchase({ userId, purpose, plan, providerRef }) {
  if (purpose === 'SUBSCRIPTION') {
    const roleMap = { premium: 'PREMIUM', vip: 'PREMIUM' };
    await prisma.user.update({ where: { id: userId }, data: { role: roleMap[plan] || 'PREMIUM' } });
    await prisma.subscription.upsert({
      where: { userId },
      update: { status: 'ACTIVE', plan, currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) },
      create: { userId, status: 'ACTIVE', plan, currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) },
    });
    await createNotification({
      userId,
      type: 'SYSTEM',
      title: '🎉 Abonnement activé !',
      body: `Bienvenue en ${plan.toUpperCase()} ! Vos avantages sont maintenant actifs.`,
      link: '/dashboard',
    });
    // Activer les récompenses de parrainage du parrain
    await activateReferralRewards(userId).catch(() => {});
  } else if (purpose === 'BOOST') {
    const profile = await prisma.profile.findUnique({ where: { userId } });
    if (!profile) return;

    const DAYS_MAP = { DAY: 1, WEEK: 7, MONTH: 30 };
    const days = DAYS_MAP[plan] || 1;
    const endAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000);

    // Désactiver les boosts existants
    await prisma.boost.updateMany({ where: { profileId: profile.id, active: true }, data: { active: false } });
    await prisma.boost.create({ data: { profileId: profile.id, plan, endAt, active: true } });

    await createNotification({
      userId,
      type: 'SYSTEM',
      title: '⚡ Boost activé !',
      body: `Votre profil est maintenant mis en avant pour ${DAYS_MAP[plan]} jour${days > 1 ? 's' : ''}.`,
      link: '/dashboard',
    });
  }
}

exports.getUserPayments = async (userId) => {
  return prisma.payment.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: 20,
  });
};
