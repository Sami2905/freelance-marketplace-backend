const { validationResult } = require('express-validator');
const Message = require('../models/Message');
const Conversation = require('../models/Conversation');
const User = require('../models/User');

// @desc    Get user's conversations
// @route   GET /api/messages/conversations
// @access  Private
exports.getConversations = async (req, res) => {
  try {
    const conversations = await Conversation.find({
      participants: req.user.id,
      status: { $ne: 'blocked' }
    })
    .populate('participants', 'name profilePicture')
    .populate('lastMessage')
    .populate('order', 'gig')
    .populate('gig', 'title images')
    .sort({ lastMessageAt: -1 });

    // Calculate unread counts
    const conversationsWithUnread = conversations.map(conv => {
      const unreadCount = conv.unreadCount.get(req.user.id) || 0;
      return {
        ...conv.toObject(),
        unreadCount
      };
    });

    res.json({
      success: true,
      data: conversationsWithUnread
    });
  } catch (error) {
    console.error('Get conversations error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// @desc    Create new conversation
// @route   POST /api/messages/conversations
// @access  Private
exports.createConversation = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { participantId, orderId, gigId } = req.body;

    // Check if participant exists
    const participant = await User.findById(participantId);
    if (!participant) {
      return res.status(404).json({
        success: false,
        message: 'Participant not found'
      });
    }

    // Check if conversation already exists
    const existingConversation = await Conversation.findOne({
      participants: { $all: [req.user.id, participantId] },
      status: { $ne: 'blocked' }
    });

    if (existingConversation) {
      return res.json({
        success: true,
        data: existingConversation
      });
    }

    // Create new conversation
    const conversation = new Conversation({
      participants: [req.user.id, participantId],
      order: orderId,
      gig: gigId,
      status: 'active'
    });

    await conversation.save();

    await conversation.populate('participants', 'name profilePicture');
    await conversation.populate('order', 'gig');
    await conversation.populate('gig', 'title images');

    res.status(201).json({
      success: true,
      data: conversation
    });
  } catch (error) {
    console.error('Create conversation error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// @desc    Get messages for a conversation
// @route   GET /api/messages/conversations/:conversationId/messages
// @access  Private
exports.getMessages = async (req, res) => {
  try {
    const { conversationId } = req.params;
    const { page = 1, limit = 50 } = req.query;

    // Check if user is part of the conversation
    const conversation = await Conversation.findById(conversationId);
    if (!conversation) {
      return res.status(404).json({
        success: false,
        message: 'Conversation not found'
      });
    }

    if (!conversation.participants.includes(req.user.id)) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to view this conversation'
      });
    }

    // Get messages
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const messages = await Message.find({
      conversation: conversationId,
      deleted: false,
      'deletedBy.user': { $ne: req.user.id }
    })
    .populate('sender', 'name profilePicture')
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(parseInt(limit));

    const total = await Message.countDocuments({
      conversation: conversationId,
      deleted: false,
      'deletedBy.user': { $ne: req.user.id }
    });

    res.json({
      success: true,
      data: messages.reverse(), // Return in chronological order
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Get messages error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// @desc    Send a message
// @route   POST /api/messages/conversations/:conversationId/messages
// @access  Private
exports.sendMessage = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { conversationId } = req.params;
    const { content, messageType = 'text', attachments = [] } = req.body;

    // Check if user is part of the conversation
    const conversation = await Conversation.findById(conversationId);
    if (!conversation) {
      return res.status(404).json({
        success: false,
        message: 'Conversation not found'
      });
    }

    if (!conversation.participants.includes(req.user.id)) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to send messages in this conversation'
      });
    }

    if (conversation.status === 'blocked') {
      return res.status(403).json({
        success: false,
        message: 'Conversation is blocked'
      });
    }

    // Create message
    const message = new Message({
      conversation: conversationId,
      sender: req.user.id,
      content,
      messageType,
      attachments
    });

    await message.save();

    // Update conversation
    conversation.lastMessage = message._id;
    conversation.lastMessageAt = new Date();
    
    // Increment unread count for other participants
    conversation.participants.forEach(participantId => {
      if (participantId.toString() !== req.user.id) {
        const currentCount = conversation.unreadCount.get(participantId.toString()) || 0;
        conversation.unreadCount.set(participantId.toString(), currentCount + 1);
      }
    });

    await conversation.save();

    await message.populate('sender', 'name profilePicture');

    res.status(201).json({
      success: true,
      data: message
    });
  } catch (error) {
    console.error('Send message error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// @desc    Mark messages as read
// @route   PATCH /api/messages/conversations/:conversationId/read
// @access  Private
exports.markAsRead = async (req, res) => {
  try {
    const { conversationId } = req.params;

    // Check if user is part of the conversation
    const conversation = await Conversation.findById(conversationId);
    if (!conversation) {
      return res.status(404).json({
        success: false,
        message: 'Conversation not found'
      });
    }

    if (!conversation.participants.includes(req.user.id)) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to access this conversation'
      });
    }

    // Mark unread messages as read
    await Message.updateMany(
      {
        conversation: conversationId,
        sender: { $ne: req.user.id },
        read: false
      },
      {
        read: true,
        readAt: new Date()
      }
    );

    // Reset unread count for this user
    conversation.unreadCount.set(req.user.id.toString(), 0);
    await conversation.save();

    res.json({
      success: true,
      message: 'Messages marked as read'
    });
  } catch (error) {
    console.error('Mark as read error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
}; 