const { validationResult } = require('express-validator');
const Review = require('../models/Review');
const Order = require('../models/Order');
const Gig = require('../models/Gig');
const User = require('../models/User');

// @desc    Create a review
// @route   POST /api/reviews
// @access  Private (Client)
exports.createReview = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { orderId, rating, comment } = req.body;

    // Check if order exists and belongs to user
    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    if (order.buyer.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to review this order'
      });
    }

    if (order.status !== 'completed') {
      return res.status(400).json({
        success: false,
        message: 'Order must be completed before reviewing'
      });
    }

    // Check if review already exists
    const existingReview = await Review.findOne({ order: orderId });
    if (existingReview) {
      return res.status(400).json({
        success: false,
        message: 'Review already exists for this order'
      });
    }

    // Create review
    const review = new Review({
      order: orderId,
      gig: order.gig,
      reviewer: req.user.id,
      reviewee: order.seller,
      rating,
      comment,
      status: 'pending'
    });

    await review.save();

    await review.populate('reviewer', 'name profilePicture');
    await review.populate('reviewee', 'name profilePicture');

    res.status(201).json({
      success: true,
      data: review
    });
  } catch (error) {
    console.error('Create review error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// @desc    Get reviews for a gig
// @route   GET /api/reviews/gig/:gigId
// @access  Public
exports.getGigReviews = async (req, res) => {
  try {
    const { gigId } = req.params;
    const { page = 1, limit = 10 } = req.query;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const reviews = await Review.find({
      gig: gigId,
      status: 'approved'
    })
    .populate('reviewer', 'name profilePicture')
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(parseInt(limit));

    const total = await Review.countDocuments({
      gig: gigId,
      status: 'approved'
    });

    res.json({
      success: true,
      data: reviews,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Get gig reviews error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// @desc    Get reviews for a user
// @route   GET /api/reviews/user/:userId
// @access  Public
exports.getUserReviews = async (req, res) => {
  try {
    const { userId } = req.params;
    const { page = 1, limit = 10 } = req.query;

    // Validate userId
    if (!userId || userId === 'undefined') {
      return res.status(400).json({
        success: false,
        message: 'Valid user ID is required'
      });
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const reviews = await Review.find({
      reviewee: userId,
      status: 'approved'
    })
    .populate('reviewer', 'name profilePicture')
    .populate('gig', 'title images')
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(parseInt(limit));

    const total = await Review.countDocuments({
      reviewee: userId,
      status: 'approved'
    });

    res.json({
      success: true,
      data: reviews,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Get user reviews error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// @desc    Update review
// @route   PUT /api/reviews/:id
// @access  Private (Client - Owner)
exports.updateReview = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { rating, comment } = req.body;

    const review = await Review.findById(req.params.id);

    if (!review) {
      return res.status(404).json({
        success: false,
        message: 'Review not found'
      });
    }

    // Check if user is the reviewer
    if (review.reviewer.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to update this review'
      });
    }

    // Update review
    if (rating !== undefined) review.rating = rating;
    if (comment !== undefined) review.comment = comment;

    await review.save();

    await review.populate('reviewer', 'name profilePicture');
    await review.populate('reviewee', 'name profilePicture');

    res.json({
      success: true,
      data: review
    });
  } catch (error) {
    console.error('Update review error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// @desc    Delete review
// @route   DELETE /api/reviews/:id
// @access  Private (Client - Owner)
exports.deleteReview = async (req, res) => {
  try {
    const review = await Review.findById(req.params.id);

    if (!review) {
      return res.status(404).json({
        success: false,
        message: 'Review not found'
      });
    }

    // Check if user is the reviewer
    if (review.reviewer.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to delete this review'
      });
    }

    await review.remove();

    res.json({
      success: true,
      message: 'Review deleted successfully'
    });
  } catch (error) {
    console.error('Delete review error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// @desc    Report review
// @route   POST /api/reviews/:id/report
// @access  Private
exports.reportReview = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { reason } = req.body;

    const review = await Review.findById(req.params.id);

    if (!review) {
      return res.status(404).json({
        success: false,
        message: 'Review not found'
      });
    }

    // Check if user is not the reviewer
    if (review.reviewer.toString() === req.user.id) {
      return res.status(400).json({
        success: false,
        message: 'You cannot report your own review'
      });
    }

    review.reported = true;
    review.reportReason = reason;
    await review.save();

    res.json({
      success: true,
      message: 'Review reported successfully'
    });
  } catch (error) {
    console.error('Report review error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
}; 