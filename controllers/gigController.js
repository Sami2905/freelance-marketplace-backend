const { validationResult } = require('express-validator');
const Gig = require('../models/Gig');
const User = require('../models/User');
const { processUploadedFiles } = require('../middlewares/upload');
const fs = require('fs');
const path = require('path');

// @desc    Create a new gig
// @route   POST /api/gigs
// @access  Private (Freelancer)
exports.createGig = async (req, res) => {
  try {
    console.log('=== GIG CREATION DEBUG ===');
    console.log('Request body:', req.body);
    console.log('Request user:', req.user);
    console.log('Request files:', req.files);
    
    // Manual validation for FormData
    const validationErrors = [];
    
    if (!req.body.title || req.body.title.trim().length === 0) {
      validationErrors.push({ type: 'field', value: req.body.title, msg: 'Title is required', path: 'title', location: 'body' });
    } else if (req.body.title.trim().length < 10 || req.body.title.trim().length > 100) {
      validationErrors.push({ type: 'field', value: req.body.title, msg: 'Title must be between 10 and 100 characters', path: 'title', location: 'body' });
    }
    
    if (!req.body.description || req.body.description.trim().length === 0) {
      validationErrors.push({ type: 'field', value: req.body.description, msg: 'Description is required', path: 'description', location: 'body' });
    } else if (req.body.description.trim().length < 50 || req.body.description.trim().length > 2000) {
      validationErrors.push({ type: 'field', value: req.body.description, msg: 'Description must be between 50 and 2000 characters', path: 'description', location: 'body' });
    }
    
    if (!req.body.category || req.body.category.trim().length === 0) {
      validationErrors.push({ type: 'field', value: req.body.category, msg: 'Category is required', path: 'category', location: 'body' });
    }
    
    if (!req.body.subcategory || req.body.subcategory.trim().length === 0) {
      validationErrors.push({ type: 'field', value: req.body.subcategory, msg: 'Subcategory is required', path: 'subcategory', location: 'body' });
    }
    
    if (!req.body.price || isNaN(parseFloat(req.body.price)) || parseFloat(req.body.price) < 5) {
      validationErrors.push({ type: 'field', value: req.body.price, msg: 'Price must be a number and at least $5', path: 'price', location: 'body' });
    }
    
    if (!req.body.deliveryTime || isNaN(parseInt(req.body.deliveryTime)) || parseInt(req.body.deliveryTime) < 1 || parseInt(req.body.deliveryTime) > 30) {
      validationErrors.push({ type: 'field', value: req.body.deliveryTime, msg: 'Delivery time must be between 1 and 30 days', path: 'deliveryTime', location: 'body' });
    }
    
    if (validationErrors.length > 0) {
      console.log('Validation errors:', validationErrors);
      return res.status(400).json({ errors: validationErrors });
    }

    const {
      title,
      description,
      category,
      subcategory,
      price,
      deliveryTime,
      revisions = 0,
      tags: tagsString = '',
      requirements: requirementsString = ''
    } = req.body;

    // Parse tags and requirements from strings to arrays
    const tags = tagsString ? tagsString.split(',').map(tag => tag.trim()).filter(tag => tag) : [];
    const requirements = requirementsString ? requirementsString.split('\n').map(req => req.trim()).filter(req => req) : [];

    // Process uploaded images
    let images = [];
    if (req.files && req.files.length > 0) {
      images = processUploadedFiles(req.files);
      // Set first image as primary if images exist
      if (images.length > 0) {
        images[0].isPrimary = true;
      }
    }

    console.log('Creating gig with data:', {
      title,
      description,
      category,
      subcategory,
      price,
      deliveryTime,
      revisions,
      tags,
      requirements,
      seller: req.user._id,
      status: 'draft'
    });

    const gig = new Gig({
      title,
      description,
      category,
      subcategory,
      price,
      deliveryTime,
      revisions,
      tags,
      requirements,
      images,
      seller: req.user._id,
      status: 'draft'
    });

    console.log('Gig object created, attempting to save...');
    await gig.save();
    console.log('Gig saved successfully');

    // Populate seller info for response
    await gig.populate('seller', 'name profilePicture averageRating totalReviews');

    res.status(201).json({
      success: true,
      data: gig
    });
  } catch (error) {
    console.error('Create gig error:', error);
    console.error('Error stack:', error.stack);
    console.error('Request body:', req.body);
    console.error('Request user:', req.user);
    console.error('Error name:', error.name);
    console.error('Error message:', error.message);
    
    // Check if it's a validation error
    if (error.name === 'ValidationError') {
      const validationErrors = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: validationErrors
      });
    }
    
    // Check if it's a duplicate key error
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'Duplicate field value'
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// @desc    Add images to existing gig
// @route   POST /api/gigs/:id/images
// @access  Private (Gig Owner)
exports.addImages = async (req, res) => {
  try {
    const gig = await Gig.findById(req.params.id);
    
    if (!gig) {
      return res.status(404).json({
        success: false,
        message: 'Gig not found'
      });
    }

    // Check ownership
    if (gig.seller.toString() !== req.user._id && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to modify this gig'
      });
    }

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No images provided'
      });
    }

    const newImages = processUploadedFiles(req.files);
    
    // Add images to gig
    gig.images.push(...newImages);
    await gig.save();

    res.json({
      success: true,
      data: gig.images,
      message: `${newImages.length} image(s) added successfully`
    });
  } catch (error) {
    console.error('Add images error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// @desc    Set primary image for gig
// @route   PATCH /api/gigs/:id/images/primary
// @access  Private (Gig Owner)
exports.setPrimaryImage = async (req, res) => {
  try {
    const { imageIndex } = req.body;
    
    if (imageIndex === undefined || imageIndex < 0) {
      return res.status(400).json({
        success: false,
        message: 'Valid image index required'
      });
    }

    const gig = await Gig.findById(req.params.id);
    
    if (!gig) {
      return res.status(404).json({
        success: false,
        message: 'Gig not found'
      });
    }

    // Check ownership
    if (gig.seller.toString() !== req.user._id && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to modify this gig'
      });
    }

    if (imageIndex >= gig.images.length) {
      return res.status(400).json({
        success: false,
        message: 'Invalid image index'
      });
    }

    await gig.setPrimaryImage(imageIndex);

    res.json({
      success: true,
      data: gig.images,
      message: 'Primary image updated successfully'
    });
  } catch (error) {
    console.error('Set primary image error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// @desc    Remove image from gig
// @route   DELETE /api/gigs/:id/images/:imageIndex
// @access  Private (Gig Owner)
exports.removeImage = async (req, res) => {
  try {
    const { imageIndex } = req.params;
    const index = parseInt(imageIndex);
    
    if (isNaN(index) || index < 0) {
      return res.status(400).json({
        success: false,
        message: 'Valid image index required'
      });
    }

    const gig = await Gig.findById(req.params.id);
    
    if (!gig) {
      return res.status(404).json({
        success: false,
        message: 'Gig not found'
      });
    }

    // Check ownership
    if (gig.seller.toString() !== req.user._id && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to modify this gig'
      });
    }

    if (index >= gig.images.length) {
      return res.status(400).json({
        success: false,
        message: 'Invalid image index'
      });
    }

    // Get the image to be removed for file deletion
    const imageToRemove = gig.images[index];
    
    // Remove image from database
    await gig.removeImage(index);

    // Delete file from filesystem
    if (imageToRemove && imageToRemove.filename) {
      const filePath = path.join(__dirname, '../uploads', imageToRemove.filename);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }

    res.json({
      success: true,
      data: gig.images,
      message: 'Image removed successfully'
    });
  } catch (error) {
    console.error('Remove image error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// @desc    Get all gigs
// @route   GET /api/gigs
// @access  Public
exports.getGigs = async (req, res) => {
  try {
    const {
      category,
      minPrice,
      maxPrice,
      rating,
      deliveryTime,
      sortBy = 'createdAt',
      sortOrder = 'desc',
      page = 1,
      limit = 12,
      search,
      seller
    } = req.query;

    // Build filter object
    const filter = { status: 'active' };
    
    if (category) filter.category = category;
    if (seller) filter.seller = seller;
    
    // Handle price filtering
    const priceFilter = {};
    if (minPrice && !isNaN(parseFloat(minPrice))) priceFilter.$gte = parseFloat(minPrice);
    if (maxPrice && !isNaN(parseFloat(maxPrice))) priceFilter.$lte = parseFloat(maxPrice);
    if (Object.keys(priceFilter).length > 0) {
      filter.price = priceFilter;
    }
    
    if (rating && !isNaN(parseFloat(rating))) filter.rating = { $gte: parseFloat(rating) };
    if (deliveryTime && !isNaN(parseInt(deliveryTime))) filter.deliveryTime = { $lte: parseInt(deliveryTime) };
    
    // Text search
    if (search && search.trim()) {
      filter.$text = { $search: search };
    }

    // Build sort object
    const sort = {};
    if (search && search.trim()) {
      sort.score = { $meta: 'textScore' };
    }
    sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

    // Pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const gigs = await Gig.find(filter)
      .populate('seller', 'name profilePicture averageRating totalReviews')
      .sort(sort)
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Gig.countDocuments(filter);

    res.json({
      success: true,
      data: gigs,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Get gigs error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// @desc    Get single gig
// @route   GET /api/gigs/:id
// @access  Public
exports.getGig = async (req, res) => {
  try {
    const gig = await Gig.findById(req.params.id)
      .populate('seller', 'name profilePicture bio location averageRating totalReviews totalOrders responseTime completionRate');

    if (!gig) {
      return res.status(404).json({
        success: false,
        message: 'Gig not found'
      });
    }

    // Increment view count
    gig.totalViews += 1;
    await gig.save();

    res.json({
      success: true,
      data: gig
    });
  } catch (error) {
    console.error('Get gig error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// @desc    Update gig
// @route   PUT /api/gigs/:id
// @access  Private (Freelancer - Owner)
exports.updateGig = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    let gig = await Gig.findById(req.params.id);

    if (!gig) {
      return res.status(404).json({
        success: false,
        message: 'Gig not found'
      });
    }

    // Check ownership
    if (gig.seller.toString() !== req.user._id) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to update this gig'
      });
    }

    gig = await Gig.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true
    });

    res.json({
      success: true,
      data: gig
    });
  } catch (error) {
    console.error('Update gig error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// @desc    Delete gig
// @route   DELETE /api/gigs/:id
// @access  Private (Freelancer - Owner)
exports.deleteGig = async (req, res) => {
  try {
    const gig = await Gig.findById(req.params.id);

    if (!gig) {
      return res.status(404).json({
        success: false,
        message: 'Gig not found'
      });
    }

    // Check ownership
    if (gig.seller.toString() !== req.user._id) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to delete this gig'
      });
    }

    await gig.remove();

    res.json({
      success: true,
      message: 'Gig deleted successfully'
    });
  } catch (error) {
    console.error('Delete gig error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// @desc    Get user's gigs
// @route   GET /api/gigs/user/me
// @access  Private (Freelancer)
exports.getUserGigs = async (req, res) => {
  try {
    const gigs = await Gig.find({ seller: req.user._id })
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      data: gigs
    });
  } catch (error) {
    console.error('Get user gigs error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// @desc    Search gigs
// @route   GET /api/gigs/search
// @access  Public
exports.searchGigs = async (req, res) => {
  try {
    const { q, category, minPrice, maxPrice, rating, sortBy = 'relevance', page = 1, limit = 12 } = req.query;

    let filter = { status: 'active' };
    let sort = {};

    // Text search
    if (q) {
      filter.$text = { $search: q };
    }

    // Category filter
    if (category) {
      filter.category = category;
    }

    // Price filter
    if (minPrice || maxPrice) {
      filter.price = {};
      if (minPrice) filter.price.$gte = parseFloat(minPrice);
      if (maxPrice) filter.price.$lte = parseFloat(maxPrice);
    }

    // Rating filter
    if (rating) {
      filter.rating = { $gte: parseFloat(rating) };
    }

    // Sort options
    switch (sortBy) {
      case 'price_low':
        sort.price = 1;
        break;
      case 'price_high':
        sort.price = -1;
        break;
      case 'rating':
        sort.rating = -1;
        break;
      case 'orders':
        sort.totalOrders = -1;
        break;
      case 'newest':
        sort.createdAt = -1;
        break;
      case 'oldest':
        sort.createdAt = 1;
        break;
      default:
        if (q) {
          sort.score = { $meta: 'textScore' };
        } else {
          sort.createdAt = -1;
        }
    }

    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    // Get total count for pagination
    const total = await Gig.countDocuments(filter);

    const gigs = await Gig.find(filter)
      .populate('seller', 'name profilePicture averageRating totalReviews')
      .sort(sort)
      .skip(skip)
      .limit(limitNum);

    const totalPages = Math.ceil(total / limitNum);

    res.json({
      success: true,
      data: gigs,
      total,
      totalPages,
      currentPage: pageNum,
      hasNextPage: pageNum < totalPages,
      hasPrevPage: pageNum > 1
    });
  } catch (error) {
    console.error('Search gigs error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// @desc    Update gig status
// @route   PATCH /api/gigs/:id/status
// @access  Private (Freelancer - Owner)
exports.updateGigStatus = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { status } = req.body;

    let gig = await Gig.findById(req.params.id);

    if (!gig) {
      return res.status(404).json({
        success: false,
        message: 'Gig not found'
      });
    }

    // Check ownership (unless admin)
    if (req.user.role !== 'admin' && gig.seller.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to update this gig'
      });
    }

    gig.status = status;
    await gig.save();

    res.json({
      success: true,
      data: gig
    });
  } catch (error) {
    console.error('Update gig status error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
}; 