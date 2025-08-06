const mongoose = require('mongoose');

const gigSchema = new mongoose.Schema({
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
    required: true,
    enum: [
      'Graphics & Design',
      'Digital Marketing', 
      'Writing & Translation',
      'Video & Animation',
      'Music & Audio',
      'Programming & Tech',
      'Business',
      'Lifestyle',
      'Data',
      'Photography'
    ]
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
  images: [{
    url: {
      type: String
    },
    filename: {
      type: String
    },
    originalName: {
      type: String
    },
    size: {
      type: Number
    },
    mimetype: {
      type: String
    },
    isPrimary: {
      type: Boolean,
      default: false
    },
    uploadedAt: {
      type: Date,
      default: Date.now
    }
  }],
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
  },
  rating: {
    type: Number,
    default: 0,
    min: 0,
    max: 5
  },
  totalReviews: {
    type: Number,
    default: 0
  },
  totalOrders: {
    type: Number,
    default: 0
  },
  totalViews: {
    type: Number,
    default: 0
  },
  totalEarnings: {
    type: Number,
    default: 0
  },
  featured: {
    type: Boolean,
    default: false
  },
  featuredUntil: {
    type: Date
  },
  // SEO and discovery fields
  slug: {
    type: String,
    unique: true,
    sparse: true
  },
  metaDescription: {
    type: String,
    maxlength: 160
  },
  // Approval and moderation
  approvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  approvedAt: {
    type: Date
  },
  rejectionReason: {
    type: String
  },
  // Analytics
  lastViewedAt: {
    type: Date
  }
}, {
  timestamps: true
});

// Generate slug from title
gigSchema.pre('save', function(next) {
  if (this.isModified('title')) {
    try {
      const baseSlug = this.title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '');
      
      // Add timestamp to ensure uniqueness
      this.slug = `${baseSlug}-${Date.now()}`;
    } catch (error) {
      console.error('Slug generation error:', error);
      // Generate a fallback slug
      this.slug = `gig-${Date.now()}`;
    }
  }
  next();
});

// Virtual for primary image
gigSchema.virtual('primaryImage').get(function() {
  if (!this.images || !Array.isArray(this.images)) {
    return null;
  }
  const primary = this.images.find(img => img.isPrimary);
  return primary ? primary.url : (this.images[0] ? this.images[0].url : null);
});

// Virtual for image count
gigSchema.virtual('imageCount').get(function() {
  return (this.images && Array.isArray(this.images)) ? this.images.length : 0;
});

// Method to add image
gigSchema.methods.addImage = function(imageData) {
  // Initialize images array if it doesn't exist
  if (!this.images || !Array.isArray(this.images)) {
    this.images = [];
  }
  // If this is the first image, make it primary
  if (this.images.length === 0) {
    imageData.isPrimary = true;
  }
  this.images.push(imageData);
  return this.save();
};

// Method to set primary image
gigSchema.methods.setPrimaryImage = function(imageIndex) {
  if (!this.images || !Array.isArray(this.images)) {
    throw new Error('No images available');
  }
  if (imageIndex >= 0 && imageIndex < this.images.length) {
    this.images.forEach((img, index) => {
      img.isPrimary = index === imageIndex;
    });
    return this.save();
  }
  throw new Error('Invalid image index');
};

// Method to remove image
gigSchema.methods.removeImage = function(imageIndex) {
  if (!this.images || !Array.isArray(this.images)) {
    throw new Error('No images available');
  }
  if (imageIndex >= 0 && imageIndex < this.images.length) {
    const removedImage = this.images.splice(imageIndex, 1)[0];
    
    // If we removed the primary image and there are other images, make the first one primary
    if (removedImage.isPrimary && this.images.length > 0) {
      this.images[0].isPrimary = true;
    }
    
    return this.save();
  }
  throw new Error('Invalid image index');
};

// Indexes for better performance
gigSchema.index({ status: 1, category: 1 });
gigSchema.index({ seller: 1, status: 1 });
// Temporarily disable text index to debug
// gigSchema.index({ title: 'text', description: 'text', tags: 'text' });
// Slug index automatically created by unique: true in schema
gigSchema.index({ featured: 1, status: 1 });
gigSchema.index({ rating: -1, totalOrders: -1 });

// Ensure virtuals are included in JSON output
gigSchema.set('toJSON', { virtuals: true });
gigSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Gig', gigSchema); 