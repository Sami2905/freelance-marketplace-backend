const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const UserSchema = new mongoose.Schema({
  name: { 
    type: String, 
    required: true, 
    trim: true 
  },
  email: { 
    type: String, 
    required: true, 
    unique: true, 
    lowercase: true, 
    trim: true, 
    index: true 
  },
  password: { 
    type: String, 
    required: true 
  },
  role: { 
    type: String, 
    enum: ['client', 'freelancer', 'admin'], 
    required: true 
  },
  profilePicture: { 
    type: String, 
    default: '' 
  },
  // Profile information
  bio: {
    type: String,
    maxlength: 500
  },
  location: {
    type: String,
    trim: true
  },
  phone: {
    type: String,
    trim: true
  },
  website: {
    type: String,
    trim: true
  },
  skills: [{
    type: String,
    trim: true
  }],
  hourlyRate: {
    type: Number,
    min: 5
  },
  // Freelancer specific fields
  totalEarnings: {
    type: Number,
    default: 0
  },
  totalOrders: {
    type: Number,
    default: 0
  },
  averageRating: {
    type: Number,
    default: 0,
    min: 0,
    max: 5
  },
  totalReviews: {
    type: Number,
    default: 0
  },
  responseTime: {
    type: Number, // in hours
    default: 24
  },
  completionRate: {
    type: Number,
    default: 100,
    min: 0,
    max: 100
  },
  // Account status
  isVerified: {
    type: Boolean,
    default: false
  },
  isActive: {
    type: Boolean,
    default: true
  },
  isSuspended: {
    type: Boolean,
    default: false
  },
  suspensionReason: {
    type: String
  },
  suspensionEndDate: {
    type: Date
  },
  // Social links
  socialLinks: {
    linkedin: String,
    twitter: String,
    github: String,
    portfolio: String
  },
  // Preferences
  emailNotifications: {
    newOrders: { type: Boolean, default: true },
    messages: { type: Boolean, default: true },
    reviews: { type: Boolean, default: true },
    marketing: { type: Boolean, default: false }
  },
  // Verification
  emailVerified: {
    type: Boolean,
    default: false
  },
  emailVerificationToken: String,
  emailVerificationExpires: Date,
  // Password reset
  passwordResetToken: String,
  passwordResetExpires: Date,
  // Last activity
  lastActive: {
    type: Date,
    default: Date.now
  }
}, { 
  timestamps: true 
});

UserSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

module.exports = mongoose.model('User', UserSchema); 