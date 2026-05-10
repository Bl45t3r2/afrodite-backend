const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const ctrl = require('../controllers/profileController');

router.get('/', ctrl.getProfiles);
router.get('/favorites', authenticate, ctrl.getMyFavorites);
router.get('/me/stats', authenticate, ctrl.getMyStats);
router.get('/tags/popular', ctrl.getPopularTags);
router.get('/:id', ctrl.getProfile);
router.put('/me', authenticate, ctrl.updateProfile);
router.post('/:profileId/favorite', authenticate, ctrl.toggleFavorite);
router.get('/:id/can-review', authenticate, ctrl.canReview);
router.post('/:id/review', authenticate, ctrl.addReview);

module.exports = router;
