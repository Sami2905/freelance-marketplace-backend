const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
  gig: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Gig',
    required: true
  },
  buyer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  seller: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  amount: {
    type: Number,
    required: true,
    min: 5
  },
  status: {
    type: String,
    enum: ['pending', 'accepted', 'in_progress', 'delivered', 'completed', 'cancelled', 'disputed'],
    default: 'pending'
  },
  requirements: {
    type: [String],
    required: true
  },
  deliveryFiles: [{
    filename: String,
    url: String,
    uploadedAt: {
      type: Date,
      default: Date.now
    }
  }],
  deliveryMessage: {
    type: String
  },
  deliveryDate: {
    type: Date
  },
  completedDate: {
    type: Date
  },
  cancelledDate: {
    type: Date
  },
  cancelledBy: {
    type: String,
    enum: ['buyer', 'seller', 'admin']
  },
  cancellationReason: {
    type: String
  },
  revisionRequests: [{
    message: String,
    requestedAt: {
      type: Date,
      default: Date.now
    },
    status: {
      type: String,
      enum: ['pending', 'completed'],
      default: 'pending'
    }
  }],
  messages: [{
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    content: {
      type: String,
      required: true
    },
    timestamp: {
      type: Date,
      default: Date.now
    },
    read: {
      type: Boolean,
      default: false
    }
  }],
  rating: {
    type: Number,
    min: 1,
    max: 5
  },
  review: {
    type: String,
    maxlength: 1000
  },
  reviewDate: {
    type: Date
  }
}, {
  timestamps: true
});

// Indexes for better performance
orderSchema.index({ buyer: 1, status: 1 });
orderSchema.index({ seller: 1, status: 1 });
orderSchema.index({ gig: 1, status: 1 });
orderSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Order', orderSchema); 