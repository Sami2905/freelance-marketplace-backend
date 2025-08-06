const mongoose = require('mongoose');

const gigSimpleSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100
  },
  description: {
    type: String,
    required: true,
    maxlength: 2000
  },
  category: {
    type: String,
    required: true
  },
  subcategory: {
    type: String,
    required: true
  },
  price: {
    type: Number,
    required: true,
    min: 5
  },
  deliveryTime: {
    type: Number,
    required: true,
    min: 1,
    max: 30
  },
  revisions: {
    type: Number,
    default: 0,
    min: 0,
    max: 10
  },
  tags: [{
    type: String,
    trim: true
  }],
  requirements: [{
    type: String,
    trim: true
  }],
  status: {
    type: String,
    enum: ['draft', 'pending', 'active', 'paused', 'rejected'],
    default: 'draft'
  },
  seller: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('GigSimple', gigSimpleSchema); 