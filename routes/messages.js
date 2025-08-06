const express = require('express');
const { body } = require('express-validator');
const { 
  getConversations, 
  getMessages, 
  sendMessage, 
  markAsRead,
  createConversation
} = require('../controllers/messageController');
const { protect } = require('../middlewares/auth');

const router = express.Router();

// All routes are protected
router.use(protect);

// Get user's conversations
router.get('/conversations', getConversations);

// Create new conversation
router.post('/conversations', [
  body('participantId').isMongoId().withMessage('Valid participant ID is required'),
  body('orderId').optional().isMongoId().withMessage('Valid order ID is required'),
  body('gigId').optional().isMongoId().withMessage('Valid gig ID is required')
], createConversation);

// Get messages for a conversation
router.get('/conversations/:conversationId/messages', getMessages);

// Send a message
router.post('/conversations/:conversationId/messages', [
  body('content').notEmpty().withMessage('Message content is required').isLength({ max: 2000 }).withMessage('Message too long')
], sendMessage);

// Mark messages as read
router.patch('/conversations/:conversationId/read', markAsRead);

module.exports = router; 