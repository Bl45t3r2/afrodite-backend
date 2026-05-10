// routes/messages.js
const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const ctrl = require('../controllers/messageController');

router.get('/conversations', authenticate, ctrl.getConversations);
router.get('/quota', authenticate, ctrl.getMessageQuota);
router.get('/:otherId', authenticate, ctrl.getMessages);
router.post('/', authenticate, ctrl.sendMessage);
router.patch('/:otherId/read', authenticate, ctrl.markAsRead);
router.delete('/:id', authenticate, ctrl.deleteMessage);

module.exports = router;
