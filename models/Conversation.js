const mongoose = require('mongoose');

const conversationSchema = new mongoose.Schema({
  participants: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }],
  lastMessage: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Message'
  },
  lastMessageAt: {
    type: Date
  },
  unreadCount: {
    type: Map,
    of: Number,
    default: new Map()
  },
  order: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Order'
  },
  gig: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Gig'
  },
  status: {
    type: String,
    enum: ['active', 'archived', 'blocked'],
    default: 'active'
  },
  blockedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  blockedAt: {
    type: Date
  }
}, {
  timestamps: true
});

// Indexes for better performance
conversationSchema.index({ participants: 1 });
conversationSchema.index({ lastMessageAt: -1 });
conversationSchema.index({ order: 1 });
conversationSchema.index({ gig: 1 });

module.exports = mongoose.model('Conversation', conversationSchema); 