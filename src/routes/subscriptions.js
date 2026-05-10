const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const ctrl = require('../controllers/subscriptionController');

// Webhooks (pas d'auth — appelés par Stripe/FedaPay)
router.post('/webhook/stripe', express.raw({ type: 'application/json' }), ctrl.stripeWebhook);
router.post('/webhook/fedapay', express.json(), ctrl.fedapayWebhook);

// Routes authentifiées
router.use(authenticate);
router.get('/', ctrl.getSubscription);
router.get('/payments', ctrl.getPayments);
router.post('/checkout/stripe', ctrl.stripeCheckout);
router.post('/checkout/mobile-money', ctrl.mobileMoneyCheckout);
router.post('/cancel', ctrl.cancelSubscription);

module.exports = router;
