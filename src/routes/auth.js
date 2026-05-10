const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/authController');
const { authenticate } = require('../middleware/auth');

router.post('/register', ctrl.register);
router.post('/login', ctrl.login);
router.post('/refresh', ctrl.refresh);
router.get('/me', authenticate, ctrl.me);
router.get('/verify-email', ctrl.verifyEmail);
router.post('/resend-verification', ctrl.resendVerification);
router.post('/forgot-password', ctrl.forgotPassword);
router.get('/reset-password/validate', ctrl.validateResetToken);
router.post('/reset-password', ctrl.resetPassword);
router.post('/change-password', authenticate, ctrl.changePassword);
router.delete('/account', authenticate, ctrl.deleteAccount);

module.exports = router;
