const { Review, reviewStatus, flagReasons } = require('../../models/Review');
const { ErrorResponse } = require('../../utils/errorResponse');
const asyncHandler = require('../../middlewares/async');

// @desc    Get all reviews with filtering
// @route   GET /api/admin/reviews
// @access  Private/Admin
exports.getReviews = asyncHandler(async (req, res, next) => {
  const { status, gigId, userId, flagged, sort, page = 1, limit = 20 } = req.query;
  
  // Build query
  const query = {};
  
  // Filter by status
  if (status && Object.values(reviewStatus).includes(status)) {
    query.status = status;
  }
  
  // Filter by gig
  if (gigId) {
    query.gig = gigId;
  }
  
  // Filter by user
  if (userId) {
    query.buyer = userId;
  }
  
  // Filter flagged reviews
  if (flagged === 'true') {
    query.flagCount = { $gt: 0 };
  }
  
  // Pagination
  const pageInt = parseInt(page, 10);
  const limitInt = parseInt(limit, 10);
  const startIndex = (pageInt - 1) * limitInt;
  
  // Get total count for pagination
  const total = await Review.countDocuments(query);
  
  // Build sort
  let sortBy = { createdAt: -1 }; // Default sort by newest
  if (sort === 'oldest') {
    sortBy = { createdAt: 1 };
  } else if (sort === 'highest') {
    sortBy = { rating: -1 };
  } else if (sort === 'lowest') {
    sortBy = { rating: 1 };
  } else if (sort === 'most-flagged') {
    sortBy = { flagCount: -1 };
  }
  
  // Execute query
  const reviews = await Review.find(query)
    .populate('buyer', 'name username avatar')
    .populate('gig', 'title images')
    .populate('adminResponse.adminId', 'name username')
    .sort(sortBy)
    .skip(startIndex)
    .limit(limitInt);
    
  // Create pagination result
  const pagination = {};
  const totalPages = Math.ceil(total / limitInt);
  
  if (endIndex < total) {
    pagination.next = {
      page: pageInt + 1,
      limit: limitInt
    };
  }
  
  if (startIndex > 0) {
    pagination.prev = {
      page: pageInt - 1,
      limit: limitInt
    };
  }
  
  res.status(200).json({
    success: true,
    count: reviews.length,
    total,
    totalPages,
    pagination,
    data: reviews
  });
});

// @desc    Get single review
// @route   GET /api/admin/reviews/:id
// @access  Private/Admin
exports.getReview = asyncHandler(async (req, res, next) => {
  const review = await Review.findById(req.params.id)
    .populate('buyer', 'name username avatar')
    .populate('gig', 'title images')
    .populate('adminResponse.adminId', 'name username')
    .populate('flags.userId', 'name username');
    
  if (!review) {
    return next(new ErrorResponse(`Review not found with id of ${req.params.id}`, 404));
  }
  
  res.status(200).json({
    success: true,
    data: review
  });
});

// @desc    Approve a review
// @route   PUT /api/admin/reviews/:id/approve
// @access  Private/Admin
exports.approveReview = asyncHandler(async (req, res, next) => {
  const review = await Review.findById(req.params.id);
  
  if (!review) {
    return next(new ErrorResponse(`Review not found with id of ${req.params.id}`, 404));
  }
  
  await review.approve(req.user.id);
  
  res.status(200).json({
    success: true,
    data: review
  });
});

// @desc    Reject a review
// @route   PUT /api/admin/reviews/:id/reject
// @access  Private/Admin
exports.rejectReview = asyncHandler(async (req, res, next) => {
  const { reason } = req.body;
  
  if (!reason) {
    return next(new ErrorResponse('Please provide a reason for rejection', 400));
  }
  
  const review = await Review.findById(req.params.id);
  
  if (!review) {
    return next(new ErrorResponse(`Review not found with id of ${req.params.id}`, 404));
  }
  
  await review.reject(req.user.id, reason);
  
  res.status(200).json({
    success: true,
    data: review
  });
});

// @desc    Flag a review
// @route   POST /api/admin/reviews/:id/flag
// @access  Private/Admin
exports.flagReview = asyncHandler(async (req, res, next) => {
  const { reason, comment } = req.body;
  
  if (!reason || !Object.values(flagReasons).includes(reason)) {
    return next(new ErrorResponse('Please provide a valid flag reason', 400));
  }
  
  const review = await Review.findById(req.params.id);
  
  if (!review) {
    return next(new ErrorResponse(`Review not found with id of ${req.params.id}`, 404));
  }
  
  const flagData = {
    userId: req.user.id,
    reason,
    comment
  };
  
  await review.addFlag(flagData);
  
  res.status(200).json({
    success: true,
    data: review
  });
});

// @desc    Update review status
// @route   PUT /api/admin/reviews/:id/status
// @access  Private/Admin
exports.updateReviewStatus = asyncHandler(async (req, res, next) => {
  const { status, reason } = req.body;
  
  if (!status || !Object.values(reviewStatus).includes(status)) {
    return next(new ErrorResponse('Please provide a valid status', 400));
  }
  
  const review = await Review.findById(req.params.id);
  
  if (!review) {
    return next(new ErrorResponse(`Review not found with id of ${req.params.id}`, 404));
  }
  
  review.status = status;
  
  if (status === reviewStatus.REJECTED && !reason) {
    return next(new ErrorResponse('Please provide a reason for rejection', 400));
  }
  
  if (status === reviewStatus.REJECTED) {
    review.adminResponse = {
      content: reason,
      adminId: req.user.id,
      respondedAt: Date.now()
    };
  } else if (status === reviewStatus.APPROVED) {
    review.adminResponse = {
      adminId: req.user.id,
      respondedAt: Date.now()
    };
  }
  
  await review.save();
  
  res.status(200).json({
    success: true,
    data: review
  });
});

// @desc    Add admin response to review
// @route   POST /api/admin/reviews/:id/response
// @access  Private/Admin
exports.addAdminResponse = asyncHandler(async (req, res, next) => {
  const { content } = req.body;
  
  if (!content) {
    return next(new ErrorResponse('Please provide response content', 400));
  }
  
  const review = await Review.findById(req.params.id);
  
  if (!review) {
    return next(new ErrorResponse(`Review not found with id of ${req.params.id}`, 404));
  }
  
  review.adminResponse = {
    content,
    adminId: req.user.id,
    respondedAt: Date.now()
  };
  
  await review.save();
  
  res.status(200).json({
    success: true,
    data: review
  });
});

// @desc    Delete a review
// @route   DELETE /api/admin/reviews/:id
// @access  Private/Admin
exports.deleteReview = asyncHandler(async (req, res, next) => {
  const review = await Review.findById(req.params.id);
  
  if (!review) {
    return next(new ErrorResponse(`Review not found with id of ${req.params.id}`, 404));
  }
  
  await review.remove();
  
  res.status(200).json({
    success: true,
    data: {}
  });
});
