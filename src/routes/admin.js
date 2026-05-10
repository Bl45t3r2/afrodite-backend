const express = require('express');
const router = express.Router();
const { authenticate, requireRole } = require('../middleware/auth');
const ctrl = require('../controllers/adminController');

router.use(authenticate, requireRole('ADMIN'));

router.get('/stats', ctrl.getStats);
router.get('/profiles/pending', ctrl.getPendingProfiles);
router.patch('/profiles/:id/moderate', ctrl.moderateProfile);
router.get('/users', ctrl.getAllUsers);
router.patch('/users/:id/role', ctrl.updateUserRole);

// ── Modération médias ──
router.get('/media/pending', ctrl.getPendingMedia);
router.patch('/photos/:id/approve', ctrl.approvePhoto);
router.patch('/photos/:id/reject', ctrl.rejectPhoto);
router.patch('/videos/:id/approve', ctrl.approveVideo);
router.patch('/videos/:id/reject', ctrl.rejectVideo);

// ── Vérification d'identité ──
router.get('/verifications/pending', ctrl.getPendingVerifications);
router.patch('/verifications/:id/approve', ctrl.approveVerification);
router.patch('/verifications/:id/reject', ctrl.rejectVerification);

// ── Activité récente ──
router.get('/activity', ctrl.getRecentActivity);

// ── Gestion utilisateurs avancée ──
router.patch('/users/:id/ban', ctrl.banUser);
router.delete('/profiles/:id', ctrl.deleteProfile);

module.exports = router;
