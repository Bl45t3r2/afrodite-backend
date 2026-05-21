const prisma = require('../lib/prisma');
const {
  createStripeCheckout,
  createFedapayTransaction,
  handleStripeWebhook,
  handleFedapayWebhook,
  getUserPayments,
} = require('../services/paymentService');


// POST /subscriptions/checkout/stripe
exports.stripeCheckout = async (req, res) => {
  try {
    const { plan } = req.body;
    if (!['premium', 'vip'].includes(plan)) {
      return res.status(400).json({ error: 'Plan invalide' });
    }
    const result = await createStripeCheckout({
      userId: req.user.id,
      purpose: 'SUBSCRIPTION',
      plan,
      successUrl: `${process.env.CLIENT_URL}/dashboard`,
      cancelUrl: `${process.env.CLIENT_URL}/tarifs`,
    });
    res.json(result);
  } catch (err) {
    console.error('stripeCheckout error:', err.message);
    res.status(500).json({ error: err.message });
  }
};

// POST /subscriptions/checkout/mobile-money
exports.mobileMoneyCheckout = async (req, res) => {
  try {
    const { plan, phoneNumber, operator } = req.body;
    if (!['premium', 'vip'].includes(plan)) return res.status(400).json({ error: 'Plan invalide' });
    if (!phoneNumber) return res.status(400).json({ error: 'Numéro de téléphone requis' });

    const result = await createFedapayTransaction({
      userId: req.user.id,
      purpose: 'SUBSCRIPTION',
      plan,
      phoneNumber,
      operator,
    });
    res.json(result);
  } catch (err) {
    console.error('mobileMoneyCheckout error:', err.message);
    res.status(500).json({ error: err.message });
  }
};

// POST /subscriptions/webhook/stripe (raw body)
exports.stripeWebhook = async (req, res) => {
  try {
    const sig = req.headers['stripe-signature'];
    const result = await handleStripeWebhook(req.body, sig);
    res.json(result);
  } catch (err) {
    console.error('stripeWebhook error:', err.message);
    res.status(400).json({ error: err.message });
  }
};

// POST /subscriptions/webhook/fedapay
exports.fedapayWebhook = async (req, res) => {
  try {
    await handleFedapayWebhook(req.body);
    res.json({ received: true });
  } catch (err) {
    console.error('fedapayWebhook error:', err.message);
    res.status(500).json({ error: err.message });
  }
};

// GET /subscriptions — abonnement actuel
exports.getSubscription = async (req, res) => {
  const sub = await prisma.subscription.findUnique({ where: { userId: req.user.id } });
  res.json(sub);
};

// POST /subscriptions/cancel
exports.cancelSubscription = async (req, res) => {
  try {
    const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
    const sub = await prisma.subscription.findUnique({ where: { userId: req.user.id } });
    if (sub?.stripeSubscriptionId) {
      await stripe.subscriptions.update(sub.stripeSubscriptionId, { cancel_at_period_end: true });
    }
    await prisma.subscription.update({
      where: { userId: req.user.id },
      data: { status: 'CANCELLED' }
    });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// GET /subscriptions/payments — historique paiements
exports.getPayments = async (req, res) => {
  const payments = await getUserPayments(req.user.id);
  res.json(payments);
};
